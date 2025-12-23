# Dataset Gallery View - Implementation Plan

## Overview

A new gallery view accessible via `?view=gallery` URL parameter that displays a grid of 64x64 thumbnails with annotation type counts. Features infinite scroll with prefetching, filtering (all/annotated/unannotated), and sorting options.

## Design Decisions

1. **Navigation**: Persistent nav bar on both views, URL query param determines active view
2. **Click behavior**: Clicking anywhere on grid item navigates to editor
3. **Loading state**: Show spinner placeholder while thumbnails load
4. **Annotation counts**: Abbreviated names with counts (e.g., `ObjDet:5 Cap:2`)
5. **URL persistence**: Filter/sort/page stored in URL params
6. **Layout**: Grid layout with responsive columns
7. **Pagination**: Infinite scroll, 50 items per page, prefetch next page
8. **Thumbnail caching**: Disk cache at `~/.cache/coco-label-tool/thumbnails/`
9. **Annotation counting**: Lazy, computed on-demand per page

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Navigation Bar                               │
│  [Editor] [Gallery]                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Filter: [All ▼]  Sort: [Index ▼]           Showing 150 of 5,000     │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ [thumb] │ │ [thumb] │ │ [thumb] │ │ [thumb] │ │ [thumb] │        │
│ │  64x64  │ │  64x64  │ │  64x64  │ │  64x64  │ │  64x64  │        │
│ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤        │
│ │img1.jpg │ │img2.jpg │ │img3.jpg │ │img4.jpg │ │img5.jpg │        │
│ │ObjDet:5 │ │(none)   │ │ObjDet:12│ │ObjDet:3 │ │(none)   │        │
│ │Cap:2    │ │         │ │         │ │Keypt:1  │ │         │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                        ... infinite scroll ...                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## URL Format

```
/?view=gallery&page=0&filter=unannotated&sort=annotations_desc
```

| Param    | Values                                                     | Default  |
| -------- | ---------------------------------------------------------- | -------- |
| `view`   | `editor`, `gallery`                                        | `editor` |
| `page`   | `0`, `1`, `2`, ...                                         | `0`      |
| `filter` | `all`, `annotated`, `unannotated`                          | `all`    |
| `sort`   | `index`, `filename`, `annotations_asc`, `annotations_desc` | `index`  |
| `index`  | (editor only) image index                                  | `0`      |

---

## Annotation Type Detection

Detect COCO annotation type by examining structure (first match wins):

1. `caption` field → **captioning**
2. `dp_I` or `dp_masks` → **densepose**
3. `keypoints` field → **keypoint**
4. `segments_info` field → **panoptic**
5. Default (segmentation/bbox/category_id) → **object_detection**

### Display Abbreviations

| Full Name        | Abbreviation |
| ---------------- | ------------ |
| object_detection | ObjDet       |
| keypoint         | Keypt        |
| panoptic         | Panop        |
| captioning       | Cap          |
| densepose        | Dense        |

---

## File Changes

### New Files (9)

| File                                        | Purpose                                     | Est. Lines |
| ------------------------------------------- | ------------------------------------------- | ---------- |
| `coco_label_tool/app/thumbnail_cache.py`    | Lazy thumbnail generation with disk caching | ~80        |
| `coco_label_tool/app/annotation_types.py`   | Annotation type detection and counting      | ~70        |
| `coco_label_tool/static/js/gallery.js`      | Gallery view logic                          | ~180       |
| `coco_label_tool/static/js/view-manager.js` | URL-based view switching                    | ~80        |
| `tests/test_thumbnail_cache.py`             | Thumbnail cache tests                       | ~150       |
| `tests/test_annotation_types.py`            | Annotation type tests                       | ~200       |
| `tests/test_gallery_routes.py`              | Gallery API tests                           | ~180       |
| `tests/gallery.test.js`                     | Gallery UI tests                            | ~280       |
| `tests/view-manager.test.js`                | View manager tests                          | ~150       |

### Modified Files (6)

| File                                    | Changes                                | Est. Lines Added |
| --------------------------------------- | -------------------------------------- | ---------------- |
| `coco_label_tool/app/routes.py`         | Add thumbnail + gallery-data endpoints | +70              |
| `coco_label_tool/app/models.py`         | Add gallery request/response models    | +30              |
| `coco_label_tool/app/dataset.py`        | Add `get_gallery_page()` function      | +60              |
| `coco_label_tool/templates/index.html`  | Add nav bar + gallery view container   | +60              |
| `coco_label_tool/static/css/styles.css` | Add nav + gallery styles               | ~180             |
| `coco_label_tool/static/js/app.js`      | Integrate view manager                 | +40              |

---

## Implementation Details

### 1. Thumbnail Cache (`thumbnail_cache.py`)

```python
"""Lazy thumbnail generation with disk caching."""

import hashlib
from pathlib import Path
from typing import Optional, Tuple

CACHE_DIR = Path.home() / ".cache" / "coco-label-tool" / "thumbnails"
DEFAULT_SIZE = 64
JPEG_QUALITY = 85

class ThumbnailCache:
    """Manages cached thumbnails on disk."""

    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_cache_key(self, image_path: str, size: int) -> str:
        """Generate unique cache key from image path and size."""
        ...

    def get_cached_thumbnail(self, image_path: str, size: int) -> Optional[bytes]:
        """Return cached thumbnail if exists, None otherwise."""
        ...

    def save_thumbnail(self, image_path: str, size: int, data: bytes) -> Path:
        """Save thumbnail to cache, return cache path."""
        ...

    def generate_thumbnail(self, image_source, size: int) -> Tuple[bytes, str]:
        """Generate thumbnail using resize_image_if_needed()."""
        ...

    def get_or_generate(self, image_path: str, size: int) -> Tuple[bytes, str]:
        """Get from cache or generate and cache."""
        ...

# Singleton instance
thumbnail_cache = ThumbnailCache()
```

### 2. Annotation Types (`annotation_types.py`)

```python
"""COCO annotation type detection and counting."""

from typing import Dict, List, Set
from enum import Enum

class AnnotationType(str, Enum):
    OBJECT_DETECTION = "object_detection"
    KEYPOINT = "keypoint"
    PANOPTIC = "panoptic"
    CAPTIONING = "captioning"
    DENSEPOSE = "densepose"

def detect_annotation_type(annotation: dict) -> AnnotationType:
    """Detect COCO annotation type by examining structure."""
    ...

def count_annotation_types_for_image(
    annotations: List[dict]
) -> Dict[str, int]:
    """Count annotations by type for a single image."""
    ...

def count_annotation_types_batch(
    annotations_by_image: Dict[int, List[dict]],
    image_ids: Set[int]
) -> Dict[int, Dict[str, int]]:
    """Batch count annotation types for multiple images."""
    ...

def get_total_annotation_count(type_counts: Dict[str, int]) -> int:
    """Sum all annotation counts."""
    ...
```

### 3. New Pydantic Models (`models.py` additions)

```python
class GalleryImageData(BaseModel):
    """Single image data for gallery view."""
    id: int
    index: int
    file_name: str
    width: int
    height: int
    annotation_counts: Dict[str, int]  # {"object_detection": 5, ...}
    total_annotations: int

class GalleryDataRequest(BaseModel):
    """Request parameters for gallery data."""
    page: int = 0
    page_size: int = 50
    filter: str = "all"  # "all" | "annotated" | "unannotated"
    sort: str = "index"  # "index" | "filename" | "annotations_asc" | "annotations_desc"

class GalleryDataResponse(BaseModel):
    """Response for gallery data endpoint."""
    images: List[GalleryImageData]
    total_images: int
    total_filtered: int  # Total matching filter
    page: int
    page_size: int
    has_more: bool
```

### 4. New API Endpoints (`routes.py` additions)

```python
@app.get("/api/thumbnail/{image_id}")
async def get_thumbnail(image_id: int, size: int = 64):
    """Serve cached thumbnail for an image.

    - Returns cached thumbnail if available
    - Generates and caches on first request
    - Default size: 64x64
    - Supports S3 images
    """
    ...

@app.post("/api/gallery-data")
async def get_gallery_data(request: GalleryDataRequest):
    """Get paginated gallery data with annotation counts.

    Features:
    - Pagination (page, page_size)
    - Filtering (all/annotated/unannotated)
    - Sorting (index/filename/annotations_asc/annotations_desc)
    - Prefetches next page's annotation counts
    """
    ...
```

### 5. Gallery Data Function (`dataset.py` addition)

```python
def get_gallery_page(
    page: int,
    page_size: int,
    filter_type: str,
    sort_by: str,
    prefetch_next: bool = True
) -> Tuple[List[Dict], int, int, bool]:
    """Get paginated gallery data with annotation counts.

    Args:
        page: Page number (0-indexed)
        page_size: Items per page
        filter_type: "all" | "annotated" | "unannotated"
        sort_by: "index" | "filename" | "annotations_asc" | "annotations_desc"
        prefetch_next: If True, also compute counts for next page

    Returns:
        Tuple of:
        - List of image data with annotation counts
        - Total images in dataset
        - Total images matching filter
        - has_more flag
    """
    ...
```

### 6. View Manager (`view-manager.js`)

```javascript
/**
 * Manages view switching based on URL parameters.
 */

export const ViewType = {
  EDITOR: "editor",
  GALLERY: "gallery",
};

export function getCurrentView() {
  /** Read ?view= param, default to 'editor' */
}

export function getViewParams() {
  /** Get all URL params as object */
}

export function switchToView(view, params = {}) {
  /** Update URL and trigger view change */
}

export function initViewManager(onViewChange) {
  /** Initialize and set up popstate listener */
}

export function updateUrlParams(params) {
  /** Update URL params without full navigation */
}
```

### 7. Gallery Module (`gallery.js`)

```javascript
/**
 * Gallery view for browsing dataset images.
 */

import { apiPost } from './api.js';
import { switchToView, updateUrlParams } from './view-manager.js';

// State
let currentPage = 0;
let currentFilter = 'all';
let currentSort = 'index';
let isLoading = false;
let hasMore = true;
let loadedImages = [];

// Constants
const PAGE_SIZE = 50;
const SCROLL_THRESHOLD = 200;

const TYPE_ABBREVIATIONS = {
  object_detection: 'ObjDet',
  keypoint: 'Keypt',
  panoptic: 'Panop',
  captioning: 'Cap',
  densepose: 'Dense'
};

export function initGallery() { ... }
export function resetGallery() { ... }
async function loadNextPage() { ... }
function renderGalleryItem(imageData) { ... }
function handleImageClick(imageIndex) { ... }
function setupInfiniteScroll() { ... }
function formatAnnotationCounts(counts) { ... }
```

### 8. HTML Structure (`index.html` additions)

```html
<!-- Navigation bar -->
<nav class="main-nav">
  <div class="nav-brand">COCO Labeling</div>
  <div class="nav-links">
    <a href="/?view=editor" id="nav-editor" class="nav-link">Editor</a>
    <a href="/?view=gallery" id="nav-gallery" class="nav-link">Gallery</a>
  </div>
</nav>

<!-- Editor view (existing content wrapped) -->
<div id="editor-view" class="view-container">
  <!-- All existing editor HTML -->
</div>

<!-- Gallery view (new) -->
<div id="gallery-view" class="view-container" style="display: none;">
  <div class="gallery-toolbar">
    <div class="gallery-filters">
      <label>Filter:</label>
      <select id="gallery-filter">
        <option value="all">All Images</option>
        <option value="annotated">Annotated</option>
        <option value="unannotated">Unannotated</option>
      </select>
      <label>Sort:</label>
      <select id="gallery-sort">
        <option value="index">Index</option>
        <option value="filename">Filename</option>
        <option value="annotations_desc">Most Annotations</option>
        <option value="annotations_asc">Least Annotations</option>
      </select>
    </div>
    <div class="gallery-stats">
      <span id="gallery-count">Loading...</span>
    </div>
  </div>

  <div id="gallery-grid" class="gallery-grid"></div>

  <div id="gallery-loading" class="gallery-loading" style="display: none;">
    Loading more images...
  </div>

  <div id="gallery-empty" class="gallery-empty" style="display: none;">
    No images match your filter.
  </div>
</div>
```

### 9. Gallery Item HTML Structure

```html
<div class="gallery-item" data-index="5" data-image-id="123">
  <div class="gallery-thumbnail-container">
    <div class="gallery-thumbnail-spinner"></div>
    <img
      class="gallery-thumbnail"
      src="/api/thumbnail/123?size=64"
      alt="image_001.jpg"
      style="display: none;"
    />
  </div>
  <div class="gallery-item-info">
    <div class="gallery-item-filename" title="image_001.jpg">image_001.jpg</div>
    <div class="gallery-item-counts">ObjDet:5 Cap:2</div>
  </div>
</div>
```

### 10. CSS Additions (`styles.css`)

```css
/* Navigation Bar */
.main-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  margin: calc(-1 * var(--spacing-md));
  margin-bottom: var(--spacing-lg);
}

.nav-brand {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-white);
}

.nav-links {
  display: flex;
  gap: var(--spacing-md);
}

.nav-link {
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--btn-secondary-hover);
}

.nav-link.active {
  color: var(--text-primary);
  background: rgba(72, 209, 204, 0.15);
  border: 1px solid var(--border-accent);
}

/* Gallery Toolbar */
.gallery-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);
}

.gallery-filters {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.gallery-filters label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.gallery-filters select {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  color: var(--text-white);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  font-family: var(--font-family);
}

.gallery-stats {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

/* Grid Layout */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

/* Gallery Item */
.gallery-item {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gallery-item:hover {
  border-color: var(--border-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.gallery-item.unannotated {
  opacity: 0.6;
}

.gallery-item.unannotated:hover {
  opacity: 1;
}

/* Thumbnail Container */
.gallery-thumbnail-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-thumbnail-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--border-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.gallery-thumbnail {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Gallery Item Info */
.gallery-item-info {
  padding: var(--spacing-sm);
}

.gallery-item-filename {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--spacing-xs);
}

.gallery-item-counts {
  font-size: var(--font-size-xs);
  color: var(--text-primary);
  min-height: 1.2em;
}

.gallery-item-counts:empty::after {
  content: "No annotations";
  color: var(--text-disabled);
  font-style: italic;
}

/* Loading & Empty States */
.gallery-loading,
.gallery-empty {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
}

.gallery-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.gallery-loading::before {
  content: "";
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## Implementation Order

### Step 1: Backend Core

1. `annotation_types.py` + `test_annotation_types.py`
2. `thumbnail_cache.py` + `test_thumbnail_cache.py`

### Step 2: Backend API

3. `models.py` additions
4. `dataset.py` - add `get_gallery_page()`
5. `routes.py` additions + `test_gallery_routes.py`

### Step 3: Frontend Core

6. `view-manager.js` + `view-manager.test.js`
7. `styles.css` additions
8. `index.html` modifications

### Step 4: Frontend Gallery

9. `gallery.js` + `gallery.test.js`
10. `app.js` integration

### Step 5: Final

11. Run `./scripts/check.sh`
12. Manual testing

---

## Test Coverage

| File                       | Tests    | Description                         |
| -------------------------- | -------- | ----------------------------------- |
| `test_annotation_types.py` | ~25      | Type detection, counting, batch ops |
| `test_thumbnail_cache.py`  | ~15      | Cache key, hit/miss, generation     |
| `test_gallery_routes.py`   | ~20      | Endpoints, pagination, filter, sort |
| `view-manager.test.js`     | ~15      | URL parsing, view switching         |
| `gallery.test.js`          | ~25      | Rendering, scroll, filter/sort      |
| **Total**                  | **~100** |                                     |

---

## Summary

- **New code**: ~1,400 lines
- **New tests**: ~900 lines
- **New files**: 9
- **Modified files**: 6
- **Total new tests**: ~100
