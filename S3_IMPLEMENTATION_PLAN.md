# S3 URI Support Implementation Plan

## 🎯 Overview

Add support for loading COCO JSON datasets from S3 URIs with disk caching, smart invalidation, and write-back capability.

### **Core Features**

1. ✅ Disk caching for S3 datasets (always enabled)
2. ✅ ETag-based cache invalidation
3. ✅ "Save to S3" button (only visible for S3 datasets)
4. ✅ Standard AWS credentials
5. ✅ Configurable AWS region
6. ✅ Stream images from S3 on-demand (with true streaming, not full download)
7. ✅ Retry logic with exponential backoff for S3 operations
8. ✅ Dirty state tracking to prevent race conditions
9. ✅ Progress indicators for large operations

---

## 📋 Requirements

### **User Workflow**

```
1. User sets: export DATASET_PATH=s3://bucket/coco.json
2. Server starts → Downloads JSON → Caches locally
3. User edits annotations → Saves to local cache
4. User clicks "Save to S3" → Uploads cache to S3
5. Server restart → Checks ETag → Uses cache if unchanged
```

### **Environment Variables**

**Required for S3**:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export DATASET_PATH=s3://bucket/datasets/coco.json
```

**Optional**:

```bash
# Specify AWS region (defaults to us-east-1)
export AWS_REGION=us-west-2
# OR
export AWS_DEFAULT_REGION=us-west-2
```

### **Cache Structure**

```
~/.cache/label-tool/datasets/
  a344459a7d9517ac2031c935849ea175.json       # Cached COCO JSON
  a344459a7d9517ac2031c935849ea175.metadata   # Cache metadata (ETag, timestamp)
```

**Cache Key**: MD5 hash of S3 URI (collision-free, deterministic)

---

## 📁 Files to Create/Modify

### **New Files** (2)

- `app/uri_utils.py` - S3 utilities and caching logic (~250 lines)
- `app/s3_state.py` - S3 state management class (~80 lines) - avoids global mutable state

### **Modified Files** (8)

- `app/config.py` - Detect S3 URIs and configure (NO circular imports)
- `app/__init__.py` - Fix static file mounting for S3 datasets
- `app/dataset.py` - Use S3State class, add S3 save function
- `app/routes.py` - Add S3 endpoints and true streaming image serving
- `templates/index.html` - Add "Save to S3" button, banner, and progress indicator
- `static/js/app.js` - Handle S3 save UI with dirty state tracking
- `static/css/styles.css` - Style S3 UI elements
- `pyproject.toml` - Add boto3 dependency

### **Test Files** (4)

- `tests/test_uri_utils.py` - Core URI utility tests (~350 lines, 30+ tests)
- `tests/test_s3_state.py` - S3 state management tests (~100 lines, 10+ tests)
- `tests/test_dataset_s3.py` - Dataset S3 operations (~200 lines, 12+ tests)
- `tests/test_s3_integration.py` - Integration tests (~150 lines, 10+ tests)

---

## 🔧 Implementation Details

### **Phase 1: Create URI Utilities Module**

#### **File**: `app/uri_utils.py` (NEW - ~250 lines)

**IMPORTANT**: This module must have NO imports from other app modules to avoid circular imports.
The `detect_uri_type()` function is intentionally simple and self-contained.

**Functions to implement**:

1. **URI Detection** (NO DEPENDENCIES - safe to import anywhere)
   - `detect_uri_type(uri: str) -> str` - Returns "s3" or "local"
   - `parse_s3_uri(uri: str) -> Tuple[str, str]` - Returns (bucket, key)

2. **Cache Management** (uses XDG_CACHE_HOME on Linux)
   - `get_cache_dir() -> Path` - Returns platform-appropriate cache dir
   - `get_cache_key(uri: str) -> str` - MD5 hash of URI
   - `get_cached_json_path(uri: str) -> Path` - Path to cached JSON
   - `get_cache_metadata_path(uri: str) -> Path` - Path to metadata file

3. **Metadata Operations**
   - `load_cache_metadata(uri: str) -> Optional[Dict]` - Load metadata JSON
   - `save_cache_metadata(uri: str, s3_metadata: Dict) -> None` - Save metadata

4. **Cache Validation**
   - `is_cache_valid(uri: str) -> bool` - Compare ETag with S3 (HEAD request)

5. **S3 Client** (cached singleton for connection pooling)
   - `get_s3_client() -> boto3.client` - Get or create cached S3 client

6. **JSON Operations** (with retry logic)
   - `load_json_from_uri(uri: str) -> Tuple[Dict, Path]` - Load with caching
   - `_load_json_from_s3_cached(s3_uri: str) -> Tuple[Dict, Path]` - S3 download
   - `_download_json_from_s3(s3_uri: str) -> Tuple[Dict, Dict]` - Raw download with retry
   - `upload_json_to_s3(s3_uri: str, local_path: Path) -> Dict` - Upload with retry

7. **Image URI Resolution**
   - `resolve_image_uri(file_name: str, dataset_uri: str) -> str` - Resolve relative paths

**Key Logic**:

```python
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

# Cached S3 client (singleton for connection pooling)
_s3_client = None

def detect_uri_type(uri: str) -> str:
    """Detect URI type. NO EXTERNAL DEPENDENCIES - safe to import anywhere."""
    if uri is None:
        return "local"
    uri_lower = uri.lower()
    if uri_lower.startswith("s3://") or uri_lower.startswith("s3a://"):
        return "s3"
    return "local"

def parse_s3_uri(uri: str) -> Tuple[str, str]:
    """Parse S3 URI into (bucket, key). Raises ValueError if invalid."""
    if not uri:
        raise ValueError("Empty URI")
    s3_path = uri.replace("s3://", "").replace("s3a://", "")
    if "/" not in s3_path:
        raise ValueError(f"Invalid S3 URI (no key): {uri}")
    bucket, key = s3_path.split("/", 1)
    if not bucket:
        raise ValueError(f"Invalid S3 URI (empty bucket): {uri}")
    if not key:
        raise ValueError(f"Invalid S3 URI (empty key): {uri}")
    return bucket, key

def get_cache_dir() -> Path:
    """Get platform-appropriate cache directory."""
    # Use XDG_CACHE_HOME on Linux, fallback to ~/.cache
    if os.name == "posix":
        cache_base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    else:
        # Windows: use LOCALAPPDATA or fallback
        cache_base = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache"))

    cache_dir = cache_base / "label-tool" / "datasets"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir

def get_s3_client():
    """Get or create cached S3 client (singleton for connection pooling)."""
    global _s3_client
    if _s3_client is None:
        import boto3

        # Region priority: AWS_REGION > AWS_DEFAULT_REGION > us-east-1
        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"

        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=region,
        )
    return _s3_client

def _retry_with_backoff(func, max_retries: int = 3, base_delay: float = 1.0):
    """Execute function with exponential backoff retry."""
    last_exception = None
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                print(f"⚠️  Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                time.sleep(delay)
    raise last_exception

def is_cache_valid(uri: str) -> bool:
    """Check if cached file is up-to-date by comparing ETag."""
    cached_json = get_cached_json_path(uri)
    if not cached_json.exists():
        return False

    metadata = load_cache_metadata(uri)
    if not metadata:
        return False

    try:
        bucket, key = parse_s3_uri(uri)

        # Get current ETag from S3 (HEAD request only)
        s3_client = get_s3_client()
        s3_metadata = s3_client.head_object(Bucket=bucket, Key=key)
        current_etag = s3_metadata.get("ETag", "").strip('"')

        # Compare
        if current_etag != metadata.get("etag"):
            print(f"ℹ️  S3 file changed (ETag mismatch), cache invalidated")
            return False

        print(f"✓ Cache valid (ETag: {current_etag[:8]}...)")
        return True
    except Exception as e:
        # If we can't verify, warn user but DON'T silently use stale cache
        print(f"⚠️  Cannot verify cache: {e}")
        print(f"⚠️  Re-downloading to ensure fresh data...")
        return False  # Force re-download on error
```

---

### **Phase 2: Update Configuration**

#### **File**: `app/config.py` (MODIFY)

**CRITICAL**: To avoid circular imports, we inline the simple `detect_uri_type()` logic here
instead of importing from `uri_utils.py`. This is intentional - the function is trivial
and having it duplicated is better than circular import hell.

**Changes**:

```python
"""Application configuration."""

import os
from pathlib import Path

# Dataset URI - can be S3 or local path
DATASET_URI = os.environ.get(
    "DATASET_PATH",
    "/Users/carl/cardbook-private/data/dev-dataset/dataset.json",
)

# Detect if remote (INLINED to avoid circular import with uri_utils)
def _is_s3_uri(uri: str) -> bool:
    """Check if URI is an S3 path. Inlined to avoid circular imports."""
    if uri is None:
        return False
    uri_lower = uri.lower()
    return uri_lower.startswith("s3://") or uri_lower.startswith("s3a://")

DATASET_IS_S3 = _is_s3_uri(DATASET_URI)

# For local paths, validate existence
if not DATASET_IS_S3:
    DATASET_JSON_PATH = Path(DATASET_URI)
    if not DATASET_JSON_PATH.exists():
        raise RuntimeError(f"Error: COCO JSON file does not exist: {DATASET_JSON_PATH}")
    if not DATASET_JSON_PATH.is_file():
        raise RuntimeError(f"Error: DATASET_PATH must point to a file: {DATASET_JSON_PATH}")
    DATASET_DIR = DATASET_JSON_PATH.parent
else:
    # S3 path - DATASET_DIR set to None, handled specially in __init__.py
    DATASET_JSON_PATH = None
    DATASET_DIR = None
    print(f"📍 Using S3 dataset: {DATASET_URI}")

# ... rest of config unchanged ...
```

**New Variables**:

- `DATASET_URI` - Original URI (S3 or local)
- `DATASET_IS_S3` - Boolean flag for easy checks
- `_is_s3_uri()` - Inlined helper to avoid circular imports

---

### **Phase 2b: Create S3 State Management Class**

#### **File**: `app/s3_state.py` (NEW - ~80 lines)

**Purpose**: Encapsulate S3-related state to avoid module-level mutable globals.
This follows the existing pattern of `ImageCache` class in `cache.py`.

```python
"""S3 state management - avoids module-level mutable globals."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import threading


@dataclass
class S3State:
    """Manages S3 dataset state. Thread-safe singleton pattern."""

    # Path to the local working copy (cache file or original local file)
    local_json_path: Optional[Path] = None

    # Whether there are unsaved local changes (dirty flag)
    is_dirty: bool = False

    # Lock for thread-safe operations
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def set_local_path(self, path: Path) -> None:
        """Set the local JSON path after loading."""
        with self._lock:
            self.local_json_path = path
            self.is_dirty = False

    def mark_dirty(self) -> None:
        """Mark dataset as having unsaved changes."""
        with self._lock:
            self.is_dirty = True

    def mark_clean(self) -> None:
        """Mark dataset as saved (no unsaved changes)."""
        with self._lock:
            self.is_dirty = False

    def get_dirty_status(self) -> bool:
        """Get current dirty status (thread-safe)."""
        with self._lock:
            return self.is_dirty

    def get_local_path(self) -> Optional[Path]:
        """Get current local path (thread-safe)."""
        with self._lock:
            return self.local_json_path


# Singleton instance - matches pattern used by ImageCache
s3_state = S3State()
```

**Usage in dataset.py**:

```python
from .s3_state import s3_state

def _save_dataset_json(data: Dict) -> None:
    """Save dataset JSON to local file and mark dirty."""
    local_path = s3_state.get_local_path()
    if local_path is None:
        raise RuntimeError("No dataset loaded")

    with open(local_path, "w") as f:
        json.dump(data, f, indent=2)

    # Mark as dirty (has unsaved changes if S3 dataset)
    if DATASET_IS_S3:
        s3_state.mark_dirty()
```

---

### **Phase 2c: Fix Static File Mounting**

#### **File**: `app/__init__.py` (MODIFY)

**Problem**: Current code crashes when `DATASET_DIR` is `None` (S3 datasets):

```python
if DATASET_DIR.exists():  # AttributeError: 'NoneType' has no attribute 'exists'
    app.mount("/dataset", StaticFiles(...))
```

**Fix**:

```python
# Mount static files for local datasets only
# S3 images are served via /api/image/{id} endpoint
if DATASET_DIR is not None and DATASET_DIR.exists():
    app.mount("/dataset", StaticFiles(directory=str(DATASET_DIR)), name="dataset")
elif DATASET_IS_S3:
    print("📦 S3 mode: Images served via /api/image/{id} endpoint")
```

---

### **Phase 3: Update Dataset Module**

#### **File**: `app/dataset.py` (MODIFY)

**IMPORTANT**: We use the `S3State` class instead of module-level globals to maintain
the existing architecture pattern (see `cache.py` for precedent).

**Changes**:

1. **Import S3State instead of using globals**:

```python
from .config import DATASET_URI, DATASET_IS_S3
from .s3_state import s3_state
from .uri_utils import load_json_from_uri, resolve_image_uri, upload_json_to_s3, save_cache_metadata
```

2. **Replace file I/O with URI utilities using S3State**:

```python
def _load_dataset_json() -> Dict:
    """Load dataset JSON from URI with caching."""
    data, local_path = load_json_from_uri(DATASET_URI)
    s3_state.set_local_path(local_path)  # Thread-safe, marks clean
    return data

def _save_dataset_json(data: Dict) -> None:
    """Save dataset JSON to local file and track dirty state."""
    local_path = s3_state.get_local_path()
    if local_path is None:
        raise RuntimeError("No dataset loaded - call _load_dataset_json() first")

    # Always save to local path (cache or original file)
    with open(local_path, "w") as f:
        json.dump(data, f, indent=2)

    # Mark as dirty if S3 dataset (has unsaved remote changes)
    if DATASET_IS_S3:
        s3_state.mark_dirty()
```

3. **Replace all `with open(DATASET_JSON, "r")` with `_load_dataset_json()`**

4. **Replace all `with open(DATASET_JSON, "w")` with `_save_dataset_json()`**

5. **Add S3 save function with dirty state management**:

```python
def save_dataset_to_s3() -> Dict:
    """Upload local cached JSON back to S3.

    Returns:
        Upload status with ETag

    Raises:
        ValueError: If not an S3 dataset or no dataset loaded
        RuntimeError: If upload fails
    """
    if not DATASET_IS_S3:
        raise ValueError("Cannot save to S3: dataset is not from S3")

    local_path = s3_state.get_local_path()
    if local_path is None:
        raise ValueError("No local dataset loaded")

    # Upload to S3 (with retry logic in uri_utils)
    s3_metadata = upload_json_to_s3(DATASET_URI, local_path)

    # Update cache metadata with new ETag
    save_cache_metadata(DATASET_URI, s3_metadata)

    # Mark as clean (no more unsaved changes)
    s3_state.mark_clean()

    return {
        "status": "success",
        "s3_uri": DATASET_URI,
        "etag": s3_metadata.get("ETag", "").strip('"'),
        "size": s3_metadata.get("ContentLength"),
    }

def get_s3_dirty_status() -> bool:
    """Check if there are unsaved changes for S3 dataset."""
    return s3_state.get_dirty_status()
```

6. **Update image path resolution**:

```python
def resolve_image_path(file_name: str) -> str:
    """Resolve image path/URI from file_name."""
    return resolve_image_uri(file_name, DATASET_URI)
```

---

### **Phase 4: Update Routes**

#### **File**: `app/routes.py` (MODIFY)

**Add new endpoints**:

```python
@app.get("/api/dataset-info")
async def get_dataset_info():
    """Get dataset source information including dirty state."""
    from .config import DATASET_URI, DATASET_IS_S3
    from . import dataset

    return {
        "source_uri": DATASET_URI,
        "is_s3": DATASET_IS_S3,
        "can_save_to_s3": DATASET_IS_S3,
        "is_dirty": dataset.get_s3_dirty_status() if DATASET_IS_S3 else False,
    }

@app.post("/api/save-to-s3")
async def save_to_s3():
    """Upload local cached dataset back to S3."""
    from .config import DATASET_IS_S3
    from . import dataset

    if not DATASET_IS_S3:
        raise HTTPException(
            status_code=400,
            detail="Cannot save to S3: dataset is not from S3"
        )

    try:
        result = dataset.save_dataset_to_s3()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save to S3: {str(e)}")
```

**Update image serving with TRUE streaming (not full download)**:

```python
from .uri_utils import detect_uri_type, parse_s3_uri, get_s3_client

@app.get("/api/image/{image_id}")
async def get_image(image_id: int):
    """Serve image file by ID (handles local paths and S3 URIs)."""
    image_data = cache.get_image_by_id(image_id)
    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")

    # Resolve to absolute path or URI
    image_uri = resolve_image_path(image_data["file_name"])
    uri_type = detect_uri_type(image_uri)

    if uri_type == "s3":
        return await serve_s3_image(image_uri)
    else:
        # Local file
        from pathlib import Path
        image_path = Path(image_uri)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image file not found")
        return FileResponse(image_path)

async def serve_s3_image(s3_uri: str):
    """Stream image from S3 using TRUE streaming (not full download to memory).

    This streams directly from S3 to the client without loading the full
    image into memory first, which is more efficient for large images.
    """
    from fastapi.responses import StreamingResponse

    try:
        bucket, key = parse_s3_uri(s3_uri)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid S3 URI: {e}")

    try:
        s3_client = get_s3_client()
        obj = s3_client.get_object(Bucket=bucket, Key=key)

        # Get content type, default to jpeg if not specified
        content_type = obj.get('ContentType', 'image/jpeg')
        content_length = obj.get('ContentLength')

        # TRUE streaming: pass the S3 body directly to StreamingResponse
        # This streams chunks as they arrive, without buffering the full image
        async def stream_s3_body():
            """Async generator that yields chunks from S3."""
            # Read in 64KB chunks for efficient memory usage
            chunk_size = 65536
            body = obj['Body']
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk
            body.close()

        headers = {}
        if content_length:
            headers['Content-Length'] = str(content_length)

        return StreamingResponse(
            stream_s3_body(),
            media_type=content_type,
            headers=headers
        )
    except s3_client.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail=f"S3 image not found: {s3_uri}")
    except s3_client.exceptions.NoSuchBucket:
        raise HTTPException(status_code=404, detail=f"S3 bucket not found in URI: {s3_uri}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch S3 image: {str(e)}")
```

---

### **Phase 5: Frontend UI Updates**

#### **File**: `templates/index.html` (MODIFY)

**Add S3 banner** (after opening `<div class="container">`):

```html
<!-- S3 Info Banner (hidden by default, shown for S3 datasets) -->
<div id="s3-banner" class="s3-info-banner" style="display: none;">
  <div class="s3-banner-header">
    <strong>📍 S3 Dataset:</strong> <span id="s3-source-uri"></span>
    <span id="s3-dirty-indicator" class="s3-dirty-badge" style="display: none;"
      >UNSAVED CHANGES</span
    >
  </div>
  <small>Local edits are cached. Click "Save to S3" to upload changes.</small>
</div>
```

**Add Save to S3 button with progress indicator** (in controls section, after other buttons):

```html
<!-- Save to S3 button (hidden by default, shown only for S3 datasets) -->
<button id="save-to-s3-btn" class="button-primary" style="display: none;">💾 Save to S3</button>

<div id="s3-save-status" style="display: none; margin-top: 8px;">
  <span id="s3-save-message"></span>
  <!-- Progress indicator for upload -->
  <div id="s3-progress-container" style="display: none; margin-top: 4px;">
    <div class="s3-progress-bar">
      <div id="s3-progress-fill" class="s3-progress-fill"></div>
    </div>
    <span id="s3-progress-text" class="s3-progress-text">Uploading...</span>
  </div>
</div>
```

---

#### **File**: `static/js/app.js` (MODIFY)

**Add global state**:

```javascript
// Global state for S3 support
let isS3Dataset = false;
let s3SourceUri = '';
let s3IsDirty = false; // Track unsaved changes
let s3UploadInProgress = false; // Prevent race conditions
```

**Add event listener** in `setupEventListeners()`:

```javascript
document.getElementById('save-to-s3-btn')?.addEventListener('click', saveToS3);
```

**Update `loadDataset()` function**:

```javascript
async function loadDataset() {
  try {
    // Get dataset info (check if S3)
    const info = await apiGet('/api/dataset-info');
    isS3Dataset = info.is_s3;
    s3SourceUri = info.source_uri;
    s3IsDirty = info.is_dirty || false;

    // Show/hide S3 UI elements
    updateS3UI();

    // ... rest of existing loadDataset() logic ...
  } catch (error) {
    showApiError(error);
  }
}
```

**Add new functions** (NOTE: JavaScript uses `//` comments, NOT Python `"""` docstrings):

```javascript
// Update S3-specific UI elements based on current state
function updateS3UI() {
  const s3SaveBtn = document.getElementById('save-to-s3-btn');
  const s3Banner = document.getElementById('s3-banner');
  const s3SourceUriSpan = document.getElementById('s3-source-uri');
  const s3DirtyIndicator = document.getElementById('s3-dirty-indicator');

  if (isS3Dataset) {
    // Show S3 button and banner
    if (s3SaveBtn) s3SaveBtn.style.display = 'block';
    if (s3Banner) {
      s3Banner.style.display = 'block';
      if (s3SourceUriSpan) s3SourceUriSpan.textContent = s3SourceUri;
    }
    // Show/hide dirty indicator
    if (s3DirtyIndicator) {
      s3DirtyIndicator.style.display = s3IsDirty ? 'inline-block' : 'none';
    }
  } else {
    // Hide S3 UI
    if (s3SaveBtn) s3SaveBtn.style.display = 'none';
    if (s3Banner) s3Banner.style.display = 'none';
  }
}

// Mark S3 dataset as dirty (has unsaved changes) - call after local saves
function markS3Dirty() {
  if (isS3Dataset && !s3IsDirty) {
    s3IsDirty = true;
    updateS3UI();
  }
}

// Upload local changes to S3 with progress indication
async function saveToS3() {
  if (!isS3Dataset) {
    alert('This dataset is not from S3');
    return;
  }

  // Prevent race condition: don't allow save while upload in progress
  if (s3UploadInProgress) {
    alert('Upload already in progress. Please wait.');
    return;
  }

  const btn = document.getElementById('save-to-s3-btn');
  const statusDiv = document.getElementById('s3-save-status');
  const statusMsg = document.getElementById('s3-save-message');
  const progressContainer = document.getElementById('s3-progress-container');
  const progressFill = document.getElementById('s3-progress-fill');
  const progressText = document.getElementById('s3-progress-text');

  // Confirm with dirty state info
  const confirmMsg = s3IsDirty
    ? 'Upload local changes to S3?\n\nThis will overwrite the remote file.'
    : 'No unsaved changes detected.\n\nUpload anyway?';

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    // Lock to prevent race conditions
    s3UploadInProgress = true;

    // Disable button and show progress
    btn.disabled = true;
    btn.textContent = '⏳ Uploading...';
    statusDiv.style.display = 'block';

    // Show indeterminate progress (we don't have real progress for small JSON files)
    if (progressContainer) {
      progressContainer.style.display = 'block';
      progressFill.style.width = '100%';
      progressFill.classList.add('s3-progress-indeterminate');
      progressText.textContent = 'Uploading to S3...';
    }

    // Upload
    const result = await apiPost('/api/save-to-s3');

    // Success - mark clean
    s3IsDirty = false;
    updateS3UI();

    // Show success message
    statusMsg.textContent = `✓ Saved to S3 (ETag: ${result.etag.substring(0, 8)}...)`;
    statusMsg.style.color = 'var(--accent-success)';

    if (progressContainer) {
      progressContainer.style.display = 'none';
      progressFill.classList.remove('s3-progress-indeterminate');
    }

    // Hide message after 5 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  } catch (error) {
    // Show error - dirty state remains true
    statusMsg.textContent = `✗ Failed to save: ${error.message}`;
    statusMsg.style.color = 'var(--accent-danger)';

    if (progressContainer) {
      progressContainer.style.display = 'none';
      progressFill.classList.remove('s3-progress-indeterminate');
    }

    showApiError(error);
  } finally {
    // Unlock and re-enable button
    s3UploadInProgress = false;
    btn.disabled = false;
    btn.textContent = '💾 Save to S3';
  }
}
```

**IMPORTANT**: Update `saveAnnotation()` to mark dirty after successful save:

```javascript
// In saveAnnotation() function, after successful POST /api/save-annotation:
markS3Dirty(); // Track that we have unsaved S3 changes
```

**IMPORTANT**: Update `deleteAnnotation()` to mark dirty after successful delete:

```javascript
// In deleteAnnotation() function, after successful DELETE:
markS3Dirty(); // Track that we have unsaved S3 changes
```

---

#### **File**: `static/css/styles.css` (ADD)

```css
/* S3 Info Banner */
.s3-info-banner {
  background: rgba(72, 209, 204, 0.1);
  border: 2px solid var(--border-accent);
  border-radius: 0px;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.s3-banner-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.s3-info-banner strong {
  color: var(--accent-success);
  text-transform: uppercase;
}

.s3-info-banner small {
  opacity: 0.7;
}

/* Dirty State Indicator (unsaved changes badge) */
.s3-dirty-badge {
  background: var(--accent-warning, #ffa500);
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  text-transform: uppercase;
  animation: s3-dirty-pulse 2s infinite;
}

@keyframes s3-dirty-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Save to S3 Button */
#save-to-s3-btn {
  background: transparent;
  border: 2px solid var(--accent-success);
  color: var(--accent-success);
  text-transform: uppercase;
  font-weight: bold;
  transition: all 0.2s;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  font-family: var(--font-family);
  font-size: var(--font-size-base);
}

#save-to-s3-btn:hover:not(:disabled) {
  background: var(--accent-success);
  color: var(--bg-primary);
  box-shadow: 0 0 10px rgba(72, 209, 204, 0.5);
}

#save-to-s3-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#s3-save-status {
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  margin-top: var(--spacing-sm);
}

/* S3 Progress Bar */
.s3-progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(72, 209, 204, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.s3-progress-fill {
  height: 100%;
  background: var(--accent-success);
  width: 0%;
  transition: width 0.3s ease;
}

/* Indeterminate progress animation */
.s3-progress-indeterminate {
  width: 30% !important;
  animation: s3-progress-slide 1.5s infinite ease-in-out;
}

@keyframes s3-progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}

.s3-progress-text {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 2px;
  display: block;
}
```

---

### **Phase 6: Add Dependency**

#### **File**: `pyproject.toml` (MODIFY)

```toml
dependencies = [
    # ... existing dependencies ...
    "boto3>=1.41.5",  # For S3 support
]
```

---

## 🧪 Testing Implementation

### **Test File 1**: `tests/test_uri_utils.py` (NEW - ~350 lines, 30+ tests)

**Test Classes**:

1. `TestURIDetection` (5 tests)
   - S3 URI detection (`s3://bucket/key`)
   - S3A URI detection (`s3a://bucket/key`)
   - Local path detection (absolute)
   - Local path detection (relative)
   - None/empty input handling

2. `TestS3URIParsing` (6 tests) - **NEW: Edge case coverage**
   - Valid S3 URI parsing
   - S3A URI parsing
   - Invalid URI (no key) raises ValueError
   - Invalid URI (empty bucket) raises ValueError
   - Invalid URI (empty key) raises ValueError
   - Empty/None URI raises ValueError

3. `TestCacheKeyGeneration` (4 tests)
   - Deterministic key generation
   - MD5 format validation (32 hex chars)
   - Uniqueness per URI
   - Different URIs produce different keys

4. `TestCachePaths` (3 tests)
   - Cached JSON path generation
   - Metadata path generation
   - XDG_CACHE_HOME respected on Linux

5. `TestCacheMetadata` (4 tests)
   - Save metadata creates file
   - Load existing metadata returns dict
   - Load non-existent metadata returns None
   - Corrupted metadata file returns None (graceful handling)

6. `TestCacheValidation` (4 tests)
   - Invalid when no cache file exists
   - Valid when ETag matches S3
   - Invalid when ETag mismatches S3
   - Returns False (re-download) when S3 check fails (network error)

7. `TestImageURIResolution` (6 tests)
   - Absolute S3 URI unchanged
   - Absolute local path unchanged
   - Relative path with S3 dataset → S3 URI
   - Nested directories preserved
   - Relative path with local dataset → local path
   - Tilde expansion for home directory

8. `TestJSONLoading` (3 tests)
   - Load from local path (no S3 call)
   - Load from S3 with caching (downloads + caches)
   - Load from S3 with valid cache (no download)

9. `TestS3Upload` (3 tests) - **NEW: Edge case coverage**
   - Successful upload returns metadata
   - Upload with retry on transient failure
   - Upload fails after max retries raises exception

10. `TestS3Client` (5 tests)
    - Default region (us-east-1)
    - AWS_REGION environment variable
    - AWS_DEFAULT_REGION environment variable
    - Region priority (AWS_REGION > AWS_DEFAULT_REGION)
    - Client is cached (singleton pattern)

11. `TestRetryLogic` (4 tests) - **NEW: Retry behavior**
    - Success on first attempt (no retry)
    - Success on second attempt after transient failure
    - Success on third attempt after two failures
    - Failure after max retries raises last exception

---

### **Test File 2**: `tests/test_s3_state.py` (NEW - ~100 lines, 10+ tests)

**Test Classes**:

1. `TestS3StateInitialization` (2 tests)
   - Initial state is clean (not dirty)
   - Initial local path is None

2. `TestS3StateLocalPath` (3 tests)
   - set_local_path stores path
   - set_local_path marks clean
   - get_local_path returns stored path

3. `TestS3StateDirtyTracking` (4 tests)
   - mark_dirty sets dirty flag
   - mark_clean clears dirty flag
   - get_dirty_status returns current state
   - Multiple dirty/clean cycles work correctly

4. `TestS3StateThreadSafety` (2 tests)
   - Concurrent mark_dirty calls don't corrupt state
   - Concurrent get operations are safe

---

### **Test File 3**: `tests/test_dataset_s3.py` (NEW - ~200 lines, 12+ tests)

**Test Classes**:

1. `TestS3DatasetLoading` (3 tests)
   - Load dataset JSON from S3 URI
   - Local path stored in S3State after load
   - State marked clean after load

2. `TestS3DatasetSaving` (5 tests)
   - Save to local cache marks dirty
   - Successful save to S3 marks clean
   - Save to S3 fails when not S3 dataset (ValueError)
   - Save to S3 fails when no local path (ValueError)
   - Save to S3 updates cache metadata with new ETag

3. `TestImagePathResolution` (4 tests)
   - Resolve relative path for S3 dataset
   - Resolve absolute S3 URI unchanged
   - Resolve relative path for local dataset
   - Resolve absolute local path unchanged

---

### **Test File 4**: `tests/test_s3_integration.py` (NEW - ~150 lines, 10+ tests)

**Test Classes**:

1. `TestDatasetInfoEndpoint` (4 tests)
   - Returns is_s3=true for S3 dataset
   - Returns is_s3=false for local dataset
   - Returns is_dirty status for S3 dataset
   - Returns can_save_to_s3 flag

2. `TestSaveToS3Endpoint` (4 tests)
   - Successful save returns ETag
   - Save clears dirty state
   - Returns 400 for local dataset
   - Returns 500 for S3 errors (with retry exhausted)

3. `TestS3ImageServing` (5 tests) - **NEW: Error case coverage**
   - Serve image from S3 URI streams correctly
   - Returns 404 for NoSuchKey error
   - Returns 404 for NoSuchBucket error
   - Returns 400 for invalid S3 URI format
   - Returns 500 for other S3 errors (network, permissions)

4. `TestS3BackwardCompatibility` (2 tests) - **NEW**
   - Local dataset works without boto3 import errors
   - S3 UI elements hidden for local dataset

---

## ✅ Implementation Checklist

### **Code Changes**

- [ ] Create `app/uri_utils.py` (~250 lines)
  - [ ] URI detection functions (NO external dependencies)
  - [ ] S3 URI parsing with validation
  - [ ] Cache management (XDG_CACHE_HOME support)
  - [ ] Metadata operations
  - [ ] Cache validation logic
  - [ ] S3 client (cached singleton)
  - [ ] Retry logic with exponential backoff
  - [ ] JSON loading/uploading
  - [ ] Image URI resolution

- [ ] Create `app/s3_state.py` (~80 lines)
  - [ ] S3State dataclass
  - [ ] Thread-safe local path tracking
  - [ ] Dirty state management
  - [ ] Singleton instance

- [ ] Modify `app/config.py` (~25 lines)
  - [ ] Add `DATASET_URI`, `DATASET_IS_S3`
  - [ ] Inline `_is_s3_uri()` to avoid circular import
  - [ ] Conditional validation for local vs S3

- [ ] Modify `app/__init__.py` (~5 lines)
  - [ ] Fix static file mounting for None DATASET_DIR
  - [ ] Add S3 mode message

- [ ] Modify `app/dataset.py` (~50 lines)
  - [ ] Import S3State (not global variable)
  - [ ] Replace file I/O with `_load_dataset_json()`
  - [ ] Replace saves with `_save_dataset_json()` (marks dirty)
  - [ ] Add `save_dataset_to_s3()` function (marks clean)
  - [ ] Add `get_s3_dirty_status()` function
  - [ ] Update `resolve_image_path()`

- [ ] Modify `app/routes.py` (~80 lines)
  - [ ] Add `/api/dataset-info` endpoint (includes dirty state)
  - [ ] Add `/api/save-to-s3` endpoint
  - [ ] Update `/api/image/{id}` for TRUE streaming
  - [ ] Add `serve_s3_image()` with chunked streaming

- [ ] Modify `templates/index.html` (~40 lines)
  - [ ] Add S3 info banner with dirty indicator
  - [ ] Add "Save to S3" button
  - [ ] Add status message div
  - [ ] Add progress bar container

- [ ] Modify `static/js/app.js` (~100 lines)
  - [ ] Add S3 state variables (including dirty, uploadInProgress)
  - [ ] Update `loadDataset()` to check S3 and dirty state
  - [ ] Add `updateS3UI()` function
  - [ ] Add `markS3Dirty()` function
  - [ ] Add `saveToS3()` function with race condition protection
  - [ ] Add event listener
  - [ ] Update `saveAnnotation()` to mark dirty
  - [ ] Update `deleteAnnotation()` to mark dirty

- [ ] Modify `static/css/styles.css` (~70 lines)
  - [ ] Style `.s3-info-banner`
  - [ ] Style `.s3-banner-header`
  - [ ] Style `.s3-dirty-badge` with pulse animation
  - [ ] Style `#save-to-s3-btn`
  - [ ] Style `#s3-save-status`
  - [ ] Style `.s3-progress-bar` and `.s3-progress-fill`
  - [ ] Style indeterminate progress animation

- [ ] Modify `pyproject.toml` (~1 line)
  - [ ] Add `boto3>=1.41.5` dependency

### **Test Implementation**

- [ ] Create `tests/test_uri_utils.py` (~350 lines, 30+ tests)
  - [ ] URI detection tests (5 tests)
  - [ ] S3 URI parsing tests (6 tests)
  - [ ] Cache key tests (4 tests)
  - [ ] Cache path tests (3 tests)
  - [ ] Metadata tests (4 tests)
  - [ ] Cache validation tests (4 tests)
  - [ ] Image URI resolution tests (6 tests)
  - [ ] JSON loading tests (3 tests)
  - [ ] S3 upload tests (3 tests)
  - [ ] S3 client tests (5 tests)
  - [ ] Retry logic tests (4 tests)

- [ ] Create `tests/test_s3_state.py` (~100 lines, 10+ tests)
  - [ ] Initialization tests (2 tests)
  - [ ] Local path tests (3 tests)
  - [ ] Dirty tracking tests (4 tests)
  - [ ] Thread safety tests (2 tests)

- [ ] Create `tests/test_dataset_s3.py` (~200 lines, 12+ tests)
  - [ ] S3 dataset loading tests (3 tests)
  - [ ] S3 save functionality tests (5 tests)
  - [ ] Image path resolution tests (4 tests)

- [ ] Create `tests/test_s3_integration.py` (~150 lines, 10+ tests)
  - [ ] Dataset info endpoint tests (4 tests)
  - [ ] Save to S3 endpoint tests (4 tests)
  - [ ] Image serving tests (5 tests)
  - [ ] Backward compatibility tests (2 tests)

### **Testing Execution**

- [ ] Run `pytest tests/test_uri_utils.py -v`
- [ ] Run `pytest tests/test_dataset_s3.py -v`
- [ ] Run `pytest tests/test_s3_integration.py -v`
- [ ] Run `pytest` (all tests, including existing)
- [ ] Check coverage: `pytest --cov=app --cov-report=html`
- [ ] Run `./scripts/check.sh` (format, lint, tests)
- [ ] Fix any issues with `./scripts/check-fix.sh`

### **Manual Testing**

**Local Dataset (Backward Compatibility)**:

- [ ] Local path loads normally
- [ ] Editing/saving works
- [ ] "Save to S3" button NOT visible
- [ ] No S3 banner shown
- [ ] No boto3 import errors if boto3 not installed

**S3 Dataset (New Feature)**:

- [ ] First load downloads and caches
- [ ] Second load uses cache (check logs for ETag validation)
- [ ] Edit annotations and save locally
- [ ] "Save to S3" button visible
- [ ] S3 banner shows source URI
- [ ] **Dirty indicator appears after local save** ← NEW
- [ ] Click "Save to S3" shows confirmation dialog
- [ ] **Progress bar shows during upload** ← NEW
- [ ] Upload succeeds and shows success message
- [ ] **Dirty indicator disappears after successful upload** ← NEW
- [ ] Change S3 file externally, restart server → cache invalidates

**Race Condition Testing**: ← NEW

- [ ] Cannot click "Save to S3" while upload in progress
- [ ] Editing during upload does not corrupt state
- [ ] Failed upload preserves dirty state

**Retry Testing**: ← NEW

- [ ] Transient network error retries automatically
- [ ] Retry messages appear in server logs
- [ ] Permanent failure shows error after max retries

**Region Testing**:

- [ ] Default region (us-east-1) works
- [ ] AWS_REGION env var works
- [ ] AWS_DEFAULT_REGION env var works
- [ ] AWS_REGION takes priority

**Image Loading**:

- [ ] Images with relative paths load from S3
- [ ] Images with absolute S3 URIs load
- [ ] Mixed local and S3 images work
- [ ] Missing images show clear 404 error
- [ ] **Invalid S3 URI shows clear 400 error** ← NEW
- [ ] **Network error shows clear 500 error** ← NEW

**Error Case Testing**: ← NEW

- [ ] Missing AWS credentials shows clear error
- [ ] Invalid bucket name shows clear error
- [ ] Permission denied (read-only) shows clear error
- [ ] Malformed S3 URI (no key) shows clear error

### **Documentation**

- [ ] Update `README.md` with S3 usage examples
- [ ] Update `AGENTS.md` with architecture details
- [ ] Verify all examples in docs work

---

## 📚 Usage Examples

### **Local Dataset** (existing behavior):

```bash
export DATASET_PATH=/data/coco.json
python server.py
# → Works as before, no S3 button
```

### **S3 Dataset** (new feature):

```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-west-2

# Point to S3 dataset
export DATASET_PATH=s3://my-bucket/datasets/coco.json

# Start server
python server.py

# Terminal output:
# 📍 Using S3 dataset: s3://my-bucket/datasets/coco.json
# 📥 Downloading from S3...
# 💾 Caching to: ~/.cache/label-tool/datasets/a344459.json
```

### **S3 Directory Structure**:

```
s3://my-bucket/
  datasets/
    coco.json              # COCO JSON file
    images/                # Images referenced in JSON
      001.jpg              # file_name: "images/001.jpg"
      002.jpg
      train2017/
        000001.jpg         # file_name: "images/train2017/000001.jpg"
```

### **COCO JSON with S3 Images**:

```json
{
  "images": [
    {"id": 1, "file_name": "images/001.jpg", ...},
    {"id": 2, "file_name": "s3://other-bucket/002.jpg", ...},
    {"id": 3, "file_name": "/local/path/003.jpg", ...}
  ]
}
```

### **Cache Management**:

```bash
# View cache
ls -lh ~/.cache/label-tool/datasets/

# Clear cache (force re-download)
rm -rf ~/.cache/label-tool/datasets/

# Clear specific dataset
python3 -c "import hashlib; print(hashlib.md5(b's3://bucket/coco.json').hexdigest())"
rm ~/.cache/label-tool/datasets/a344459a7d9517ac2031c935849ea175.*
```

---

## 🎯 Success Criteria

### **Functional Requirements**

- ✅ S3 datasets load and cache locally
- ✅ ETag validation prevents stale cache
- ✅ Local edits save to cache
- ✅ "Save to S3" uploads changes back
- ✅ Images stream from S3 on-demand
- ✅ AWS region configurable via env vars
- ✅ Backward compatible with local datasets

### **Quality Requirements**

- ✅ 90%+ test coverage on new code
- ✅ All existing tests pass (no regression)
- ✅ Code passes lint/format checks
- ✅ Clear error messages for common issues
- ✅ Performance acceptable (cache makes it fast)

### **User Experience**

- ✅ S3 banner clearly shows data source
- ✅ Confirmation dialog prevents accidental uploads
- ✅ Success/error messages are clear
- ✅ Button only visible when relevant
- ✅ Works seamlessly with existing UI

---

## 🚀 Future Enhancements (Out of Scope)

1. **Multi-Region Auto-Detection**
   - Detect bucket region automatically
   - Requires extra API call, added complexity

2. **Presigned URLs**
   - Generate presigned URLs for image serving
   - Reduces server load, better for CDN

3. **Incremental Sync**
   - Only upload changed annotations
   - Delta sync for large datasets

4. **Conflict Resolution**
   - Detect concurrent edits
   - Merge strategies

5. **Other Cloud Providers**
   - Azure Blob Storage
   - Google Cloud Storage
   - Generic HTTP/WebDAV

6. **Compression**
   - Compress cached JSON with gzip
   - Save disk space

---

## 🐛 Issues Addressed in This Plan

This plan was reviewed and updated to address the following issues:

### **Critical Issues (Would Cause Crashes)**

| Issue              | Problem                                                                     | Solution                                                                      |
| ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Circular Import    | `config.py` importing from `uri_utils.py` which may import from `config.py` | Inline `_is_s3_uri()` in config.py - trivial function, acceptable duplication |
| DATASET_DIR = None | `__init__.py` calls `DATASET_DIR.exists()` which crashes for None           | Add None check before accessing `.exists()`                                   |

### **High Severity Issues (Architecture Problems)**

| Issue                   | Problem                                                               | Solution                                               |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Global Mutable State    | `_LOCAL_JSON_PATH` as module-level global breaks architecture pattern | Created `S3State` class following `ImageCache` pattern |
| JavaScript Syntax Error | Python `"""docstrings"""` used in JS code                             | Changed to `//` comments                               |

### **Medium Severity Issues (Functional Problems)**

| Issue                 | Problem                                                      | Solution                                                 |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Inefficient Streaming | `obj['Body'].read()` loads full image to memory              | True streaming with chunked reads (64KB chunks)          |
| No Retry Logic        | S3 operations fail permanently on transient errors           | Added `_retry_with_backoff()` with exponential backoff   |
| Race Condition        | User can edit while upload in progress, corrupting ETag sync | Added `s3UploadInProgress` lock and dirty state tracking |

### **Low Severity Issues (Quality Improvements)**

| Issue                   | Problem                                           | Solution                                                 |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Missing Edge Case Tests | No tests for invalid URIs, network errors, etc.   | Added 15+ additional test cases                          |
| S3 Client Recreation    | New boto3 client on every call wastes connections | Cached singleton `_s3_client`                            |
| No Progress Indicators  | Users don't know upload status                    | Added progress bar with indeterminate animation          |
| Hardcoded Cache Path    | `~/.cache/` ignores XDG spec                      | Use `XDG_CACHE_HOME` on Linux, `LOCALAPPDATA` on Windows |

### **Test Coverage Improvements**

| Category    | Original      | Updated       |
| ----------- | ------------- | ------------- |
| URI Utils   | 25+ tests     | 30+ tests     |
| S3 State    | (none)        | 10+ tests     |
| Dataset S3  | 8+ tests      | 12+ tests     |
| Integration | 6+ tests      | 10+ tests     |
| **Total**   | **39+ tests** | **62+ tests** |

---

## 📊 Estimated Implementation Time

- **Code Implementation**: 5-7 hours (increased for S3State class and retry logic)
- **Test Writing**: 4-5 hours (increased for 62+ tests)
- **Testing & Debugging**: 2-3 hours
- **Documentation**: 1 hour
- **Total**: 12-16 hours

---

## 🔗 Related Documentation

- **AWS SDK for Python (Boto3)**: https://boto3.amazonaws.com/v1/documentation/api/latest/index.html
- **S3 Client API**: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html
- **FastAPI Streaming**: https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse
- **pytest Mocking**: https://docs.pytest.org/en/stable/how-to/monkeypatch.html

---

**End of Implementation Plan**
