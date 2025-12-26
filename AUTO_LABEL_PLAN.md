# Auto-Label Feature Implementation Plan

## Summary

Add an auto-labeling feature that allows users to connect to external object detection servers. The feature:

- Is configured via a YAML file passed at server startup
- Supports multiple endpoints with auth tokens and category mappings
- Integrates seamlessly with the existing unsaved mask workflow
- Silently skips unmapped categories
- Shows subtle notifications for success/errors

---

## 1. Dependencies

**Add to `pyproject.toml`:**

```toml
"pyyaml>=6.0",           # YAML parsing
"httpx>=0.28.1",         # Already present, async HTTP client
```

Note: Using `pyyaml` directly with Pydantic's built-in YAML support instead of `pydantic-yaml` (simpler, fewer dependencies).

---

## 2. Config File Schema

**Example: `auto_label_config.yaml`**

```yaml
# Auto-labeling configuration for coco-label-tool
# Each endpoint is an object detection server that returns COCO annotations

endpoints:
  # Endpoint name (used in UI dropdown)
  yolo-v8:
    url: "https://my-server.com/api/detect"
    auth_token: "Bearer sk-abc123..." # Optional - empty string if no auth
    category_mapping:
      # Server category ID -> Local COCO dataset category ID
      # Unmapped categories are silently skipped
      1: 5 # Server's "person" -> Dataset's category 5
      2: 12 # Server's "car" -> Dataset's category 12
      3: 12 # Server's "truck" -> Also maps to category 12

  florence-2:
    url: "https://florence.example.com/segment"
    auth_token: "" # No auth required
    category_mapping:
      0: 1
      1: 2
```

---

## 3. New Files

### 3.1 `app/auto_label.py` - Service Module

```python
"""Auto-labeling service for external object detection servers."""

import base64
import httpx
import yaml
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel


class EndpointConfig(BaseModel):
    """Configuration for a single auto-label endpoint."""
    url: str
    auth_token: str = ""
    category_mapping: Dict[int, int]  # server_cat_id -> local_cat_id


class AutoLabelConfig(BaseModel):
    """Top-level auto-label configuration."""
    endpoints: Dict[str, EndpointConfig]


class AutoLabelService:
    """Handles communication with external auto-labeling servers."""

    def __init__(self, config: AutoLabelConfig):
        self.config = config
        self.http_client = httpx.AsyncClient(timeout=60.0)

    def get_endpoint_names(self) -> List[str]:
        """Return list of configured endpoint names for UI."""
        return list(self.config.endpoints.keys())

    async def auto_label_image(
        self,
        endpoint_name: str,
        image_path: Path
    ) -> List[Dict]:
        """Send image to auto-label server and return mapped annotations."""
        if endpoint_name not in self.config.endpoints:
            raise ValueError(f"Unknown endpoint: {endpoint_name}")

        endpoint = self.config.endpoints[endpoint_name]

        # Read and encode image as base64
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        # Build request headers
        headers = {"Content-Type": "application/json"}
        if endpoint.auth_token:
            headers["Authorization"] = endpoint.auth_token

        # Send request
        response = await self.http_client.post(
            endpoint.url,
            json={"image": image_data},
            headers=headers
        )
        response.raise_for_status()

        # Parse response
        result = response.json()
        annotations = result.get("annotations", [])

        # Validate and map annotations
        mapped = []
        for ann in annotations:
            # Validate required fields
            self._validate_annotation(ann)

            # Map category (skip if unmapped)
            mapped_ann = self._map_annotation(ann, endpoint.category_mapping)
            if mapped_ann:
                mapped.append(mapped_ann)

        return mapped

    def _validate_annotation(self, ann: Dict) -> None:
        """Validate annotation has required COCO fields."""
        required = ["category_id", "segmentation", "bbox", "area"]
        for field in required:
            if field not in ann:
                raise ValueError(f"Invalid annotation: missing '{field}'")

        # Validate segmentation is polygon format
        seg = ann["segmentation"]
        if not isinstance(seg, list):
            raise ValueError("segmentation must be a list of polygons")

        if len(seg) == 0:
            raise ValueError("segmentation cannot be empty")

        # Each polygon needs at least 3 points (6 coordinates)
        for i, poly in enumerate(seg):
            if not isinstance(poly, list):
                raise ValueError(f"Polygon {i} must be a list of coordinates")
            if len(poly) < 6:
                raise ValueError(f"Polygon {i} needs at least 3 points (6 coords)")

    def _map_annotation(
        self,
        ann: Dict,
        mapping: Dict[int, int]
    ) -> Optional[Dict]:
        """Map server category ID to local. Returns None if unmapped."""
        server_cat = ann["category_id"]
        local_cat = mapping.get(server_cat)

        if local_cat is None:
            return None  # Silently skip unmapped categories

        return {
            "category_id": local_cat,
            "segmentation": ann["segmentation"],
            "bbox": ann["bbox"],
            "area": ann["area"],
        }

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()


def load_auto_label_config(path: str) -> AutoLabelConfig:
    """Load and validate auto-label config from YAML file."""
    with open(path, "r") as f:
        data = yaml.safe_load(f)
    return AutoLabelConfig(**data)


# Lazy singleton
_auto_label_service: Optional[AutoLabelService] = None


def get_auto_label_service() -> Optional[AutoLabelService]:
    """Get or create auto-label service singleton. Returns None if not configured."""
    global _auto_label_service
    from .config import AUTO_LABEL_CONFIG_PATH

    if AUTO_LABEL_CONFIG_PATH is None:
        return None

    if _auto_label_service is None:
        config = load_auto_label_config(AUTO_LABEL_CONFIG_PATH)
        _auto_label_service = AutoLabelService(config)

    return _auto_label_service


def clear_auto_label_service() -> None:
    """Clear the singleton (for testing)."""
    global _auto_label_service
    _auto_label_service = None
```

---

### 3.2 Updates to `app/config.py`

Add new config variable:

```python
# Auto-labeling configuration (optional)
AUTO_LABEL_CONFIG_PATH = os.environ.get("AUTO_LABEL_CONFIG", None)
```

---

### 3.3 Updates to `app/models.py`

Add new request model:

```python
class AutoLabelRequest(BaseModel):
    """Request to auto-label an image."""
    image_id: int
    endpoint_name: str
```

---

### 3.4 Updates to `app/routes.py`

Add new endpoints:

```python
from .auto_label import get_auto_label_service

@app.get("/api/auto-label-endpoints")
async def get_auto_label_endpoints():
    """Return list of configured auto-label endpoints."""
    service = get_auto_label_service()
    if service is None:
        return {"enabled": False, "endpoints": []}
    return {
        "enabled": True,
        "endpoints": service.get_endpoint_names()
    }


@app.post("/api/auto-label")
async def auto_label_image(request: AutoLabelRequest):
    """Send current image to auto-label server."""
    service = get_auto_label_service()
    if service is None:
        raise HTTPException(400, "Auto-labeling not configured")

    # Get image data
    image_data = cache.get_image_by_id(request.image_id)
    if not image_data:
        raise HTTPException(404, "Image not found")

    image_path = dataset.resolve_image_path(image_data["file_name"])

    try:
        annotations = await service.auto_label_image(
            request.endpoint_name,
            image_path
        )
        return {
            "success": True,
            "annotations": annotations,
            "count": len(annotations)
        }
    except ValueError as e:
        # Validation error from server response
        raise HTTPException(400, f"Invalid response: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Server error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Auto-label failed: {str(e)}")
```

---

### 3.5 Updates to `server.py`

Add CLI argument:

```python
parser.add_argument(
    "--auto-label-config",
    type=str,
    help="Path to auto-labeling YAML config file",
    default=None
)

# In main():
if args.auto_label_config:
    os.environ["AUTO_LABEL_CONFIG"] = args.auto_label_config
```

---

### 3.6 Updates to `templates/index.html`

Add UI elements right after the mode-select dropdown (line ~95):

```html
<!-- Auto-Label Section (hidden if not configured) -->
<div id="auto-label-section" style="display: none; margin-left: 10px;">
  <select
    id="auto-label-select"
    style="
      padding: 10px;
      background: #333;
      color: #48d1cc;
      border: 2px solid #48d1cc;
      border-radius: 4px;
    "
  >
    <!-- Populated dynamically -->
  </select>
  <button
    id="auto-label-btn"
    style="
      padding: 10px 15px;
      background: transparent;
      color: #48d1cc;
      border: 2px solid #48d1cc;
      border-radius: 4px;
      margin-left: 5px;
      cursor: pointer;
    "
  >
    AUTO LABEL
  </button>
</div>

<!-- Notification Toast (for subtle messages) -->
<div id="notification-toast"></div>
```

---

### 3.7 Updates to `static/js/app.js`

Add auto-label functionality:

```javascript
// === State ===
let autoLabelEndpoints = [];
let autoLabelEnabled = false;

// === Initialization ===
async function initAutoLabel() {
  try {
    const response = await apiGet("/api/auto-label-endpoints");
    autoLabelEnabled = response.enabled;
    autoLabelEndpoints = response.endpoints || [];

    if (autoLabelEnabled && autoLabelEndpoints.length > 0) {
      // Show UI
      document.getElementById("auto-label-section").style.display =
        "inline-flex";

      // Populate dropdown
      const select = document.getElementById("auto-label-select");
      select.innerHTML = autoLabelEndpoints
        .map((name) => `<option value="${name}">${name.toUpperCase()}</option>`)
        .join("");
    }
  } catch (e) {
    console.log("Auto-label not available:", e.message);
  }
}

// === Handler ===
async function handleAutoLabel() {
  const select = document.getElementById("auto-label-select");
  const endpointName = select.value;
  const imgData = images[currentIndex];

  if (!imgData || !endpointName) return;

  // Show loading state
  const btn = document.getElementById("auto-label-btn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "LABELING...";

  try {
    // Reset any existing prompts/unsaved masks
    resetPrompts();

    const result = await apiPost("/api/auto-label", {
      image_id: imgData.id,
      endpoint_name: endpointName,
    });

    if (result.annotations && result.annotations.length > 0) {
      // Convert annotations to currentSegmentation format
      // Each annotation has its own segmentation (possibly multi-polygon)
      const allSegmentations = [];
      const allCategoryIds = [];

      for (const ann of result.annotations) {
        // Each annotation's segmentation is an array of polygons
        // For simplicity, we treat each annotation as one "mask"
        // that may have multiple polygons
        allSegmentations.push(...ann.segmentation);
        // Repeat category ID for each polygon in this annotation
        for (let i = 0; i < ann.segmentation.length; i++) {
          allCategoryIds.push(ann.category_id);
        }
      }

      currentSegmentation = {
        segmentation: allSegmentations,
      };

      // Set mask category IDs for multi-mask save
      maskCategoryIds = allCategoryIds;

      // Draw the masks
      drawSegmentation(currentSegmentation.segmentation);

      // Render category dropdowns
      renderMaskCategoryDropdowns();

      // Update UI state
      updateSaveButtonState();
      updateMergeButtonState();

      showNotification(`Found ${result.count} objects`, "success");
    } else {
      showNotification("No objects detected", "info");
    }
  } catch (error) {
    // Show non-intrusive error
    showNotification(error.message || "Auto-label failed", "error");
    console.error("Auto-label error:", error);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// === Notification System ===
function showNotification(message, type = "info") {
  let notification = document.getElementById("notification-toast");

  notification.textContent = message;
  notification.className = `notification-toast ${type}`;
  notification.style.display = "block";

  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

// === Event Listeners (add to setupEventListeners) ===
document
  .getElementById("auto-label-btn")
  ?.addEventListener("click", handleAutoLabel);

// === Call during initialization ===
// Add initAutoLabel() call in the initialization section
```

---

### 3.8 Updates to `static/css/styles.css`

Add notification toast styles:

```css
/* Notification Toast */
#notification-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border: 2px solid var(--text-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 1px;
  z-index: 1000;
  display: none;
}

#notification-toast.success {
  border-color: #28a745;
  color: #28a745;
}

#notification-toast.error {
  border-color: #dc3545;
  color: #dc3545;
}

#notification-toast.info {
  border-color: var(--text-primary);
}

/* Auto-label button hover */
#auto-label-btn:hover:not(:disabled) {
  background: rgba(72, 209, 204, 0.1);
  box-shadow: 0 0 10px rgba(72, 209, 204, 0.3);
}

#auto-label-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## 4. Expected Server API

External auto-label servers must implement:

**Request:** `POST <endpoint_url>`

```json
{
  "image": "<base64-encoded-image-data>"
}
```

**Response:**

```json
{
  "annotations": [
    {
      "category_id": 1,
      "segmentation": [[x1, y1, x2, y2, x3, y3, ...]],
      "bbox": [x, y, width, height],
      "area": 12345.0
    }
  ]
}
```

**Required fields:** `category_id`, `segmentation`, `bbox`, `area`
**Optional fields:** `iscrowd`

**Note:** Any confidence filtering should be done by the external server before returning annotations.

---

## 5. Test Plan

### 5.1 Python Tests (`tests/test_auto_label.py`)

```python
# Config tests
def test_load_valid_config():
def test_load_config_missing_file():
def test_load_config_invalid_yaml():
def test_load_config_missing_endpoints():

# Validation tests
def test_validate_annotation_valid():
def test_validate_annotation_missing_category_id():
def test_validate_annotation_missing_segmentation():
def test_validate_annotation_missing_bbox():
def test_validate_annotation_missing_area():
def test_validate_annotation_empty_segmentation():
def test_validate_annotation_polygon_too_few_points():

# Mapping tests
def test_map_annotation_valid():
def test_map_annotation_unmapped_returns_none():
def test_map_annotation_preserves_fields():

# Integration tests (mocked HTTP)
def test_auto_label_success():
def test_auto_label_server_error():
def test_auto_label_connection_error():
def test_auto_label_invalid_response():
def test_auto_label_with_auth_token():
def test_auto_label_unknown_endpoint():

# Route tests
def test_get_endpoints_not_configured():
def test_get_endpoints_configured():
def test_auto_label_not_configured():
def test_auto_label_image_not_found():
def test_auto_label_success_route():
```

### 5.2 JavaScript Tests (`tests/auto-label.test.js`)

```javascript
// Initialization tests
test("initAutoLabel hides section when disabled");
test("initAutoLabel hides section when no endpoints");
test("initAutoLabel shows section and populates dropdown");

// Handler tests
test("handleAutoLabel calls resetPrompts");
test("handleAutoLabel sets currentSegmentation from response");
test("handleAutoLabel sets maskCategoryIds correctly");
test("handleAutoLabel shows success notification");
test("handleAutoLabel shows error notification on failure");
test("handleAutoLabel disables button during loading");

// Notification tests
test("showNotification displays message");
test("showNotification applies correct class for type");
test("showNotification auto-hides after timeout");
```

---

## 6. Usage

```bash
# Start server with auto-label config
python server.py /path/to/dataset.json --auto-label-config /path/to/auto_label_config.yaml

# Or via environment variable
AUTO_LABEL_CONFIG=/path/to/auto_label_config.yaml python server.py /path/to/dataset.json
```

---

## 7. File Changes Summary

| File                       | Change Type                                  |
| -------------------------- | -------------------------------------------- |
| `pyproject.toml`           | Add `pyyaml` dependency                      |
| `app/auto_label.py`        | **NEW** - Service, config models, validation |
| `app/config.py`            | Add `AUTO_LABEL_CONFIG_PATH`                 |
| `app/models.py`            | Add `AutoLabelRequest`                       |
| `app/routes.py`            | Add 2 endpoints                              |
| `server.py`                | Add CLI argument                             |
| `templates/index.html`     | Add UI elements                              |
| `static/js/app.js`         | Add state, handlers, init                    |
| `static/css/styles.css`    | Add notification styles                      |
| `tests/test_auto_label.py` | **NEW** - Python tests                       |
| `tests/auto-label.test.js` | **NEW** - JS tests                           |

---

## 8. Future Extensions (Designed For)

1. **Batch mode**: The backend can easily accept an array of image IDs
2. **Multiple detection types**: Config structure allows adding `type: "object_detection"` field for future segmentation-only or keypoint servers
3. **Progress tracking**: For batch mode, can add SSE or polling for progress
4. **Caching**: Could cache server responses to avoid re-labeling
