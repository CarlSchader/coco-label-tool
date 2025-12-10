# COCO Labeling Tool

A professional web-based annotation tool for COCO-format datasets with AI-powered segmentation via Meta's SAM2 (Segment Anything Model 2). Features a terminal-inspired interface for efficient image labeling and dataset management.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Dataset Format](#dataset-format)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

The COCO Labeling Tool is a modern, efficient solution for creating and managing image segmentation annotations in COCO format. Built with FastAPI and modular ES6 JavaScript, it combines the power of SAM2's AI-assisted segmentation with a streamlined interface optimized for annotation workflows.

**Key Capabilities:**

- AI-powered segmentation with point and box prompts (SAM2)
- Real-time annotation visualization with deterministic color-coded categories
- Efficient caching system for large datasets (1000+ images)
- Full CRUD operations for annotations and categories
- Terminal-aesthetic UI with monospace fonts and cyan accents
- Multi-select support for bulk operations
- Modular, testable architecture (both backend and frontend)
- Comprehensive validation (incomplete supercategories, nested masks)

## Features

### Core Functionality

#### 🤖 AI-Powered Segmentation

- **SAM2 Integration**: State-of-the-art segmentation model from Meta
- **Dual Prompt System**:
  - **Point Prompts**: Left-click for positive (include), right-click for negative (exclude)
  - **Box Prompts**: Drag to define bounding box region
  - **Combined Prompts**: Use both simultaneously for refined results
- **GPU/CPU Support**: Automatic device detection with CPU fallback

#### 🎨 Category Management

- **Two-Level Hierarchy**: Supercategories → Categories organization
- **Color Coding**: Deterministic color assignment per supercategory
  - 18 primary colors for supercategories
  - Brightness variations for categories within supercategories
- **Dynamic Management**: Add, edit, delete categories on-the-fly
- **Validation**: Prevents deletion of categories with existing annotations

#### 📊 Annotation Workflow

- **Multi-Select**: Ctrl/Cmd+click for bulk selection and deletion
- **Real-Time Preview**: Live segmentation overlay on canvas
- **Smart Save**: Button disabled until segmentation + category selected
- **Persistent Storage**: Direct writes to COCO JSON format
- **Annotation List**: Scrollable, filterable list with color indicators

#### ⚡ Performance Optimization

- **Smart Caching**:
  - 64-image sliding window cache (±32 from current)
  - Auto-refresh on navigation beyond 16-image threshold
  - Cache status display showing loaded range
- **Lazy Loading**: Images loaded on-demand
- **Efficient Updates**: Minimal re-renders with targeted DOM updates

#### 🎯 User Experience

- **Terminal Aesthetic**:
  - Monospace fonts (Cascadia Code, Source Code Pro, SF Mono)
  - Terminal green (#33ff00) color scheme
  - Sharp rectangular borders with glow effects
  - Dark background (#0a0e14)
- **Keyboard Navigation**: Arrow keys, shortcuts for common actions
- **Visual Feedback**: Hover effects, selection states, loading spinners
- **Responsive Canvas**: Scales to fit viewport while maintaining aspect ratio

### Additional Features

- **Image Deletion**: Remove images and associated annotations
- **Annotation Metadata**: Automatic bbox and area calculation
- **Real-Time Stats**: Image counter, cache info, dimension display
- **Error Handling**: User-friendly alerts with detailed error messages
- **Dataset Integrity**: Validates COCO format on load and save

## Screenshots

_(Terminal-style UI with green monospace text, dark backgrounds, and bordered buttons)_

## Installation

### Prerequisites

- **Python**: 3.12+ (uses `uv` for dependency management)
- **OS**: macOS, Linux, or Windows
- **Memory**: 2GB+ RAM (4GB+ recommended for GPU)
- **GPU** (optional): CUDA-compatible for faster inference

### Dependencies

Core dependencies (automatically installed):

- **FastAPI** (0.115+): Web framework
- **Uvicorn**: ASGI server
- **Transformers** (4.47+): SAM2 model loading
- **PyTorch** (2.5+): ML backend
- **OpenCV** (4.10+): Image processing
- **Pillow** (11.0+): Image I/O
- **NumPy**: Array operations

### Install Steps

1. **Clone or download** the repository:

   ```bash
   git clone <your-repo-url>
   cd label-tool
   ```

2. **Install `uv`** (if not already installed):

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **Install dependencies**:

   ```bash
   uv sync
   ```

   This creates a virtual environment and installs all packages from `pyproject.toml`.

4. **Verify installation**:
   ```bash
   uv run python -c "import transformers; print('OK')"
   ```

## Quick Start

### Basic Usage

1. **Prepare your dataset** in COCO format:

   ```
   your-dataset/
   ├── dataset.json       # COCO format annotations
   └── images/            # Image files (any directory structure)
       ├── image1.jpg     # Referenced as "images/image1.jpg" in JSON
       ├── image2.jpg     # Referenced as "images/image2.jpg" in JSON
       └── ...
   ```

   **Note**: The `file_name` field in the JSON can be:
   - **Relative path**: `images/image1.jpg` (relative to directory containing `dataset.json`)
   - **Absolute path**: `/absolute/path/to/image.jpg` or `~/user/path/image.jpg`

2. **Run the server**:

   ```bash
   ./run-server.sh /path/to/your-dataset/dataset.json
   ```

   Or manually:

   ```bash
   export DATASET_PATH=/path/to/your-dataset/dataset.json
   python server.py
   ```

3. **Open browser**:
   - Navigate to `http://localhost:8000`
   - Wait for SAM2 model to load (first run downloads ~156MB model)

4. **Start annotating**:
   - Use Previous/Next to navigate images
   - Draw box or click points to segment
   - Select category from dropdowns
   - Click "Save Annotation"

### Example Workflow

```bash
# Terminal 1: Start server
./run-server.sh ../data/my-dataset/dataset.json

# Terminal 2: Monitor logs (optional)
tail -f server.log

# Browser: http://localhost:8000
# 1. Click on object → SAM2 segments it
# 2. Select "Animal" → "Dog" from dropdowns
# 3. Click "Save Annotation"
# 4. Press → (right arrow) for next image
```

## Usage Guide

### Navigation

| Action         | Method                               |
| -------------- | ------------------------------------ |
| Next image     | Click "Next" button or press `→`     |
| Previous image | Click "Previous" button or press `←` |
| Jump to image  | Enter index in counter               |
| Refresh cache  | Automatic on 16-image threshold      |

### Segmentation

#### Point Prompts

1. **Left-click** on object to include area (green dot)
2. **Right-click** to exclude area (red dot)
3. Multiple points refine segmentation
4. SAM2 updates mask in real-time

#### Box Prompts

1. **Click and drag** to draw bounding box
2. Release to generate segmentation
3. Box persists until reset

#### Combined Prompts

- Use both box + points for complex objects
- Box defines region, points refine boundaries
- Order doesn't matter (commutative)

#### Reset Prompts

- Click "Reset Prompts" button
- Clears all points, boxes, and segmentation
- Does not affect saved annotations

#### Merge Masks

For images with multiple separate masks (e.g., from SAM3 PCS or multiple boxes):

1. **Create multiple masks** using any segmentation method
2. **Click "Merge Masks"** button to combine all masks into one
3. **Result**: Single annotation with all polygons preserved
   - Maintains non-contiguous regions (COCO-compliant)
   - All polygons drawn in same color (unified object)
   - Combined bounding box and total area
   - Single category dropdown for merged mask
4. **Save** as usual - creates one annotation with multiple polygons

**Use cases**:

- Merging body parts into single person annotation
- Combining fragmented objects
- Grouping related regions as single semantic object

### Category Selection

1. **Choose Supercategory** (top-level):
   - Select from dropdown (e.g., "Animal", "Vehicle")
   - Filters category dropdown

2. **Choose Category** (specific):
   - Select from filtered list (e.g., "Dog", "Cat")
   - Required before saving

3. **Manage Categories**:
   - Click "Manage Categories" button
   - Add: Enter name + supercategory → "Add"
   - Delete: Click trash icon (fails if annotations exist)

### Saving Annotations

1. **Create segmentation** (points/box)
2. **Select category** (both dropdowns)
3. **Click "Save Annotation"** (enabled when both complete)
4. Annotation appears in list below image

**Auto-calculated fields:**

- `bbox`: [x, y, width, height] from segmentation
- `area`: Pixel count of mask
- `segmentation`: Polygon coordinates

### Managing Annotations

#### View Annotations

- List appears below image (if any exist)
- Shows: Supercategory > Category (ID: #)
- Color indicator matches visualization

#### Select Annotations

- **Single**: Click annotation item
- **Multiple**: Ctrl/Cmd+click items
- Selected items highlighted with green glow

#### Delete Annotations

1. Select annotation(s) from list
2. Click "Delete Selected" button
3. Confirm deletion (irreversible)
4. Visual overlay updates immediately

### Image Deletion

1. Click "Delete Image" button (red)
2. Review confirmation modal:
   - Image ID
   - Filename
   - Warning message
3. Click "Delete" to confirm
4. Removes from dataset and annotations.json
5. Navigates to next image

### Keyboard Shortcuts

| Key                | Action                   |
| ------------------ | ------------------------ |
| `←`                | Previous image           |
| `→`                | Next image               |
| `Ctrl/Cmd + Click` | Multi-select annotations |
| `Esc`              | Close modals             |

## Architecture

**Note**: Both backend and frontend have been refactored for modularity and testability. See `AGENTS.md` for comprehensive development guidelines and architecture details.

### Design Principles

**Modularity**: Each module has a single, clear responsibility

- Backend: `dataset.py` (COCO operations), `sam2.py` (ML inference), `exceptions.py` (error types)
- Frontend: `app.js` (main), `config.js`, `api.js`, `modals.js`, `utils/*`, `validation/*`

**Testability**: Pure functions and clear interfaces enable comprehensive testing

- Backend: pytest tests for dataset operations
- Frontend: Jest tests for utilities and validation logic

**Maintainability**: Self-documenting code with type hints (Python) and consistent patterns

- No comments required - code names are clear
- Type hints throughout Python code
- Consistent error handling with custom exceptions

### Project Structure

```
label-tool/
├── app/                      # Backend application package
│   ├── __init__.py          # FastAPI app factory
│   ├── cache.py             # ImageCache class for state management
│   ├── config.py            # Configuration constants
│   ├── dataset.py           # COCO JSON operations (pure functions)
│   ├── exceptions.py        # Custom exception types
│   ├── helpers.py           # Route handler utilities
│   ├── models.py            # Pydantic request/response models
│   ├── routes.py            # API endpoint handlers (thin controllers)
│   └── sam2.py              # SAM2 model inference (SAM2Service class)
├── static/                   # Frontend static assets
│   ├── css/
│   │   └── styles.css       # Terminal-themed styles (CSS variables)
│   └── js/
│       ├── app.js           # Main application (1,618 lines)
│       ├── api.js           # API utilities and error handling
│       ├── config.js        # Centralized configuration
│       ├── modals.js        # Modal management utilities
│       ├── utils/           # Utility modules
│       │   ├── colors.js    # Color generation
│       │   └── geometry.js  # Polygon operations
│       └── validation/      # Validation modules
│           ├── incomplete.js # Incomplete supercategory validation
│           └── nested.js     # Nested mask validation
├── templates/
│   └── index.html           # Single-page application template
├── tests/                    # Unit tests
│   ├── test_dataset.py      # Python dataset tests
│   ├── utils/               # JS utility tests
│   └── validation/          # JS validation tests
├── server.py                # Application entry point
├── run-server.sh            # Convenience launch script
├── pyproject.toml           # Python dependencies (uv format)
├── package.json             # JavaScript dependencies and test config
├── uv.lock                  # Python locked dependencies
├── README.md                # This file
├── AGENTS.md                # Development guidelines and architecture
└── .gitignore               # Git exclusions
```

### Backend Architecture (FastAPI)

#### `app/config.py` - Configuration Management

```python
DATASET_PATH: str           # From env var or CLI arg
SAM2_MODEL_ID: str         # Hugging Face model identifier
USE_GPU: bool              # Device selection
CACHE_SIZE: int            # Image cache capacity
CACHE_MARGIN: int          # Pre-load buffer
```

#### `app/models.py` - Pydantic Models

- `SegmentRequest`: SAM2 inference inputs
- `SaveAnnotationRequest`: New annotation data
- `DeleteAnnotationRequest`: Annotation IDs to remove
- `Category`: Category schema
- `DeleteImageRequest`: Image deletion

#### `app/dataset.py` - COCO JSON Operations

Pure functions for dataset manipulation:

```python
load_full_metadata()         # Load dataset metadata
load_images_range(start, end) # Load image range + annotations
get_categories()             # Get all categories
add_category(name, super)    # Create category
update_category(id, ...)     # Update category
delete_category(id)          # Remove if unused
add_annotation(...)          # Add annotation to JSON
update_annotation(id, ...)   # Update annotation category
delete_annotation(id)        # Remove annotation
delete_image(id)             # Remove image + annotations
```

#### `app/sam2.py` - SAM2 Model Inference

**SAM2Service** (stateful class):

```python
__init__(model_id, device)   # Load model from HuggingFace
reload_model(model_id)       # Switch model size
segment_image(path, points, labels, box)  # Run inference
```

#### `app/exceptions.py` - Custom Exceptions

```python
ImageNotFoundError           # Image not in dataset
AnnotationNotFoundError      # Annotation doesn't exist
CategoryInUseError           # Cannot delete category with annotations
SegmentationError            # SAM2 inference failed
```

#### `app/routes.py` - API Endpoints

Thin controllers that delegate to `dataset` and `sam2_service`:

```python
from . import dataset
from .sam2 import sam2_service
from .cache import cache     # ImageCache instance
```

Endpoints follow RESTful conventions (see [API Reference](#api-reference))

### Frontend Architecture (Modular ES6 JavaScript)

#### Module Structure

**Core modules**:

- `app.js` (1,618 lines) - Main application with global state
- `config.js` - Centralized configuration (colors, sizes, thresholds)
- `api.js` - API utilities (`apiGet()`, `apiPost()`, error handling)
- `modals.js` - Modal management (`ModalManager` class)

**Utility modules** (`utils/`):

- `colors.js` - Deterministic color generation
- `geometry.js` - Polygon/point operations (`isPolygonInsidePolygon()`, etc.)

**Validation modules** (`validation/`):

- `incomplete.js` - Check incomplete supercategories
- `nested.js` - Check nested mask mismatches

#### State Management

```javascript
// Global state (top of app.js)
let images = []; // Current cache
let currentIndex = 0; // Active image
let totalImages = 0; // Dataset size
let clickPoints = []; // SAM2 point prompts
let clickLabels = []; // Point labels (1=pos, 0=neg)
let currentBox = null; // Bounding box
let currentSegmentation = null; // Active mask
let categories = []; // Available categories
let selectedCategoryId = null; // Chosen category
let annotationsByImage = {}; // Pre-loaded annotations
```

#### Key Functions

**Navigation**:

- `loadDataset()`: Fetch dataset + categories
- `showImage(index)`: Display image, clear state
- `ensureImageLoaded(index)`: Check cache, load if needed
- `navigateToImage(index)`: Check validation, show warnings if needed

**Segmentation**:

- `runSegmentation()`: Call API with prompts (points/box)
- `drawSegmentation(mask)`: Render on canvas
- `resetPrompts()`: Clear all inputs
- `handleImageClick()`: Add positive/negative points

**Annotations**:

- `saveAnnotation()`: POST to API, reload dataset
- `deleteSelectedAnnotations()`: Bulk delete
- `drawExistingAnnotations()`: Render saved masks
- `selectAnnotation()`: Multi-select support

**Validation**:

- `checkIncompleteSupercategoriesLocal()`: Warn on incomplete supercategories
- `checkNestedMaskSupercategoryMismatchLocal()`: Warn on nested mismatches

**UI Updates**:

- `updateSaveButtonState()`: Enable/disable based on state
- `populateCategoryBadges()`: Render category badges with colors
- `drawAllPrompts()`: Render points and boxes with hover effects

#### Color System (Deterministic)

From `utils/colors.js`:

```javascript
// 18 primary colors for supercategories
const CONFIG.primaryColors = [[255,50,50], [50,150,255], ...];

export function getSupercategoryColor(supercategory, categories, cache) {
  const hash = hashString(supercategory);
  return CONFIG.primaryColors[hash % CONFIG.primaryColors.length];
}

export function getCategoryColor(category, categories, superCache, catCache) {
  const baseColor = getSupercategoryColor(category.supercategory, ...);
  const brightness = 0.6 + (hashString(category.name) % 5) * 0.1;
  return baseColor.map(c => Math.floor(c * brightness));
}
```

### Frontend Styling (CSS)

#### CSS Variables (`:root`)

- **Colors**: `--text-primary`, `--bg-primary`, `--accent-success`
- **Spacing**: `--spacing-xs` through `--spacing-xl`
- **Typography**: `--font-family`, `--font-size-*`
- **Borders**: `--border-color`, `--border-accent`

Easy theme customization: change `:root` values to restyle entire app.

#### Terminal Aesthetic

- Monospace fonts: `Cascadia Code`, `Source Code Pro`, `SF Mono`
- Green-on-black: `#33ff00` on `#0a0e14`
- Sharp borders: `border-radius: 0px`
- Glow effects: `box-shadow: 0 0 10px rgba(51, 255, 0, 0.3)`
- Uppercase labels: `text-transform: uppercase`

## API Reference

### GET `/`

Serve main HTML page.

**Response**: `text/html`

---

### GET `/api/dataset`

Get current cached dataset.

**Response**:

```json
{
  "images": [{"id": 1, "file_name": "img.jpg", ...}],
  "total_images": 100,
  "cached_indices": [0, 1, 2, ...],
  "image_map": {0: {...}, 1: {...}},
  "annotations_by_image": {1: [{...}], 2: [{...}]}
}
```

---

### POST `/api/load-range`

Load specific image range into cache.

**Request**:

```json
{ "start": 10, "end": 74 }
```

**Response**: `{"status": "success"}`

---

### POST `/api/segment`

Run SAM2 segmentation.

**Request**:

```json
{
  "image_id": 123,
  "points": [
    [100, 200],
    [150, 250]
  ],
  "labels": [1, 0], // 1=positive, 0=negative
  "box": [50, 50, 300, 300] // [x1, y1, x2, y2], optional
}
```

**Response**:

```json
{
  "segmentation": [
    [x1, y1, x2, y2, x3, y3, ...]  // Polygon(s)
  ]
}
```

**Errors**:

- `404`: Image not found
- `400`: Invalid input format

---

### GET `/api/categories`

List all categories.

**Response**:

```json
{
  "categories": [
    { "id": 1, "name": "dog", "supercategory": "animal" },
    { "id": 2, "name": "cat", "supercategory": "animal" }
  ]
}
```

---

### POST `/api/save-annotation`

Create new annotation.

**Request**:

```json
{
  "image_id": 123,
  "category_id": 1,
  "segmentation": [[x1, y1, x2, y2, ...]],
  "bbox": [x, y, width, height],  // Optional, auto-calculated
  "area": 1250.5                   // Optional, auto-calculated
}
```

**Response**:

```json
{
  "id": 456,
  "message": "Annotation saved successfully"
}
```

---

### POST `/api/delete-annotation`

Delete annotation(s).

**Request**:

```json
{ "ids": [1, 2, 3] }
```

**Response**:

```json
{ "message": "Deleted 3 annotations" }
```

---

### POST `/api/add-category`

Create new category.

**Request**:

```json
{
  "name": "bicycle",
  "supercategory": "vehicle"
}
```

**Response**:

```json
{
  "id": 5,
  "name": "bicycle",
  "supercategory": "vehicle"
}
```

---

### POST `/api/update-category`

Edit category details.

**Request**:

```json
{
  "id": 5,
  "name": "bike",
  "supercategory": "vehicle"
}
```

**Response**: `{"message": "Category updated"}`

---

### POST `/api/delete-category`

Remove category (fails if annotations exist).

**Request**:

```json
{ "id": 5 }
```

**Response**: `{"message": "Category deleted"}`

**Errors**:

- `400`: Category has existing annotations

---

### POST `/api/delete-image`

Delete image and all annotations.

**Request**:

```json
{ "image_id": 123 }
```

**Response**: `{"message": "Image deleted successfully"}`

## Configuration

### Environment Variables

| Variable       | Description                       | Default | Example                        |
| -------------- | --------------------------------- | ------- | ------------------------------ |
| `DATASET_PATH` | Path to COCO JSON file (required) | None    | `/data/coco-dataset/data.json` |
| `USE_GPU`      | Enable CUDA acceleration          | `false` | `true`                         |

### Runtime Configuration

Defined in `app/config.py`:

```python
DATASET_JSON: Path = Path(os.getenv('DATASET_PATH'))
DATASET_DIR: Path = DATASET_JSON.parent  # Directory containing the JSON
SAM2_MODEL_ID: str = "facebook/sam2-hiera-tiny"
USE_GPU: bool = os.getenv('USE_GPU', 'false').lower() == 'true'
CACHE_SIZE: int = 64         # Images in memory
CACHE_MARGIN: int = 32       # Pre-load buffer
CACHE_HEAD: int = 0          # Cache window start
CACHE_TAIL: int = CACHE_SIZE # Cache window end
```

**To modify**:

1. Edit `app/config.py` directly, or
2. Set environment variables before running

### Model Configuration

SAM2 model options (change `SAM2_MODEL_ID`):

- `facebook/sam2-hiera-tiny` (default, 156MB)
- `facebook/sam2-hiera-small` (184MB)
- `facebook/sam2-hiera-base-plus` (313MB)
- `facebook/sam2-hiera-large` (433MB)

Larger models = better accuracy, slower inference.

### Server Configuration

Edit `server.py`:

```python
uvicorn.run(
    "app.routes:app",
    host="0.0.0.0",    # Listen on all interfaces
    port=8000,          # Change port here
    reload=True         # Auto-reload on code changes
)
```

## Dataset Format

### COCO JSON Structure

```json
{
  "images": [
    {
      "id": 1,
      "file_name": "images/img001.jpg",
      "width": 640,
      "height": 480
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "segmentation": [[x1, y1, x2, y2, ...]],
      "bbox": [x, y, width, height],
      "area": 1250.5,
      "iscrowd": 0
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "dog",
      "supercategory": "animal"
    }
  ]
}
```

### Required Fields

**Images**:

- `id` (int): Unique identifier
- `file_name` (str): Path to image file (relative to JSON location, or absolute if starting with `/` or `~`)
- `width` (int): Image width in pixels
- `height` (int): Image height in pixels

**Annotations**:

- `id` (int): Unique identifier
- `image_id` (int): Reference to image
- `category_id` (int): Reference to category
- `segmentation` (list): Polygon coordinates `[[x1,y1,x2,y2,...]]`
- `bbox` (list): `[x, y, width, height]`
- `area` (float): Mask area in pixels

**Categories**:

- `id` (int): Unique identifier
- `name` (str): Category name
- `supercategory` (str): Parent category (or "none")

### File Organization

```
dataset-root/
├── dataset.json         # COCO format (required)
├── images/              # Image directory (can be any name)
│   ├── train/           # Subdirs optional
│   │   ├── img001.jpg   # file_name: "images/train/img001.jpg"
│   │   └── img002.jpg   # file_name: "images/train/img002.jpg"
│   └── val/
│       └── img003.jpg   # file_name: "images/val/img003.jpg"
└── ...
```

**Notes**:

- `file_name` can be relative to the directory containing the JSON file, or absolute (starting with `/` or `~`)
- Supports nested directories
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.bmp`

## Development

### Code Style

See `AGENTS.md` for comprehensive guidelines. Key points:

**Python**:

- Modular architecture with pure functions and custom exceptions
- Type hints on all functions
- snake_case naming
- Pure functions for dataset operations
- Custom exceptions for error handling
- Pydantic for validation
- No comments (self-documenting code)

**JavaScript**:

- ES6 modules with imports/exports
- camelCase naming
- Pure utility functions (testable)
- Global state at top of `app.js`
- Async/await for API calls
- No comments (self-documenting code)

**CSS**:

- CSS variables for theming
- BEM-like naming where applicable
- Terminal aesthetic (cyan/teal theme)

### Adding Features

#### New API Endpoint

1. **Define model** in `app/models.py`:

   ```python
   class MyRequest(BaseModel):
       param: str
   ```

2. **Add function** in `app/dataset.py` or method in `app/sam2.py`:

   ```python
   def my_operation(param: str) -> dict:
       with open(DATASET_JSON, "r") as f:
           data = json.load(f)
       # Business logic
       return {"result": "success"}
   ```

3. **Create route** in `app/routes.py`:

   ```python
   from . import dataset
   from .cache import cache
   from .exceptions import MyCustomError

   @app.post("/api/my-endpoint")
   async def my_endpoint(request: MyRequest):
       try:
           result = dataset.my_operation(request.param)
           cache.update_something(result)
           return result
       except MyCustomError as e:
           raise HTTPException(status_code=400, detail=str(e))
   ```

4. **Call from frontend** using `apiPost()` from `api.js`:

   ```javascript
   import { apiPost, showApiError } from "./api.js";

   async function myFeature() {
     try {
       const data = await apiPost("/api/my-endpoint", { param: "value" });
       // Handle success
     } catch (error) {
       showApiError(error);
     }
   }
   ```

#### Styling Changes

Modify CSS variables in `static/css/styles.css`:

```css
:root {
  --text-primary: #ff0000; /* Change to red */
  --bg-primary: #ffffff; /* White background */
}
```

All components automatically update.

### Testing

#### Code Quality

**Linting and formatting**:

Python (Ruff):

```bash
# Check for linting issues
uv run ruff check

# Auto-fix issues
uv run ruff check --fix

# Format code
uv run ruff format
```

JavaScript (ESLint + Prettier):

```bash
# Check for linting issues
npx eslint .

# Auto-fix issues
npx eslint . --fix

# Check formatting
npx prettier --check .

# Format code
npx prettier --write .
```

**Helper scripts** (in `scripts/` directory):

```bash
# Run all checks (format check + lint + tests)
./scripts/check.sh

# Auto-fix everything (format + lint + tests)
./scripts/check-fix.sh

# Run linters (check only)
./scripts/lint.sh

# Auto-fix linting issues
./scripts/lint-fix.sh

# Format all code
./scripts/format.sh

# Run all tests
./scripts/test.sh
```

#### Unit Tests

**JavaScript tests** (Jest):

```bash
# Run all JS tests
npm test

# Run single test file
npm test tests/utils/colors.test.js

# Run tests matching pattern
npm test -- --testNamePattern="hashString"

# Watch mode
npm test -- --watch
```

**JavaScript test coverage** (140 tests, ~340ms execution):

- `tests/config.test.js` - Configuration validation (28 tests) ✨ NEW
- `tests/api.test.js` - API utilities and error handling (21 tests) ✨ NEW
- `tests/modals.test.js` - Modal management (31 tests) ✨ NEW
- `tests/utils/colors.test.js` - Color generation and caching (22 tests)
- `tests/utils/geometry.test.js` - Polygon operations (17 tests)
- `tests/validation/incomplete.test.js` - Incomplete supercategory validation (12 tests)
- `tests/validation/nested.test.js` - Nested mask validation (17 tests)

**Coverage: 100% of all testable JavaScript modules** (config, api, modals, utilities, validation)

**Python tests** (pytest):

```bash
# Run all Python tests
pytest

# Run single test file
pytest tests/test_dataset.py

# Run with coverage
pytest --cov=app tests/

# Verbose output
pytest -v
```

**Python test coverage** (90 tests total):

- `tests/test_dataset.py` - Dataset operations (27 tests - all CRUD operations)
- `tests/test_cache.py` - Cache management (14 tests - state management)
- `tests/test_exceptions.py` - Exception handling (13 tests - hierarchy & behavior)
- `tests/test_helpers.py` - Helper functions (5 tests - async utilities)
- `tests/test_sam2.py` - SAM2 service (10 tests - ML inference with mocking)
- `tests/test_routes.py` - API routes (21 tests - FastAPI integration)

**Adding new tests**:

- **JavaScript**: Create test files in `tests/` mirroring `static/js/` structure. Use ES6 imports and Jest syntax.
- **Python**: Add test functions in `tests/test_*.py`. Use pytest fixtures and mocking for file I/O.

#### Manual Testing

Manual testing workflow for UI:

1. **Start server**: `./run-server.sh test-data/`
2. **Test navigation**: Previous/Next buttons, arrow keys
3. **Test segmentation**: Points, box, combined prompts
4. **Test categories**: Add, edit, delete, color coding
5. **Test annotations**: Save, select, multi-delete
6. **Test edge cases**: Empty dataset, invalid inputs, network errors

### Performance Profiling

**Backend**:

```python
import time
start = time.time()
# ... operation ...
print(f"Took {time.time() - start:.2f}s")
```

**Frontend**:

```javascript
console.time("operation");
// ... code ...
console.timeEnd("operation");
```

**SAM2 Inference**: Typical times on M1 Mac CPU:

- Small image (512x512): ~1-2s
- Large image (2048x2048): ~5-10s
- GPU (if enabled): 2-5x faster

### Building for Production

1. **Disable reload**:

   ```python
   # server.py
   reload=False
   ```

2. **Use production server**:

   ```bash
   uv run gunicorn app.routes:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

3. **Set environment**:

   ```bash
   export USE_GPU=true
   export DATASET_PATH=/prod/data/coco/dataset.json
   ```

4. **Optimize model**: Consider using quantized SAM2 variant

## Troubleshooting

### Server Won't Start

**Error**: `DATASET_PATH not set`

- **Fix**: Set environment variable to point to your COCO JSON file
  ```bash
  export DATASET_PATH=/path/to/dataset/dataset.json
  # or
  ./run-server.sh /path/to/dataset/dataset.json
  ```

**Error**: `ModuleNotFoundError: No module named 'app'`

- **Fix**: Run from project root directory
  ```bash
  cd label-tool
  python server.py
  ```

### SAM2 Model Issues

**Error**: Model download fails

- **Fix**: Check internet connection, HuggingFace status
- **Workaround**: Download manually:
  ```python
  from transformers import Sam2ForImageSegmentation
  Sam2ForImageSegmentation.from_pretrained("facebook/sam2-hiera-tiny")
  ```

**Error**: CUDA out of memory

- **Fix**: Disable GPU or use smaller images
  ```bash
  export USE_GPU=false
  ```

### Frontend Issues

**Problem**: UI not updating

- **Fix**: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- **Reason**: Browser caching CSS/JS

**Problem**: Segmentation not appearing

- **Check**: Browser console (F12) for errors
- **Verify**: Network tab shows successful `/api/segment` response

**Problem**: Colors not showing correctly

- **Fix**: Check category has supercategory set
- **Reason**: Color derived from supercategory hash

### Dataset Issues

**Error**: `Image not found: images/img.jpg`

- **Fix**: Ensure `file_name` in JSON matches actual file path
- **Check**: Paths are relative to the directory containing the COCO JSON file

**Error**: Invalid JSON format

- **Fix**: Validate with online JSON validator
- **Verify**: Matches COCO format schema

### Performance Issues

**Problem**: Slow loading

- **Cause**: Large images (>4K resolution)
- **Fix**: Resize images before importing
  ```bash
  mogrify -resize 2048x2048\> images/*.jpg
  ```

**Problem**: High memory usage

- **Cause**: Cache size too large
- **Fix**: Reduce `CACHE_SIZE` in `app/config.py`

**Problem**: Slow segmentation

- **Cause**: CPU inference, large images
- **Fix**: Enable GPU or reduce image size

### Common Errors

| Error                     | Cause              | Solution                              |
| ------------------------- | ------------------ | ------------------------------------- |
| `404 Image not found`     | Wrong image ID     | Check dataset loaded correctly        |
| `400 Invalid category`    | Category deleted   | Refresh page, reselect category       |
| `500 Segmentation failed` | SAM2 error         | Check image format, try smaller image |
| `Connection refused`      | Server not running | Start with `./run-server.sh`          |

## License

This project uses the following open-source components:

- **FastAPI**: MIT License
- **PyTorch**: BSD License
- **Transformers**: Apache 2.0 License
- **SAM2 Model**: Apache 2.0 License (Meta)

Check individual licenses in `pyproject.toml` dependencies.

---

**Questions?** Check `AGENTS.md` for development guidelines or open an issue on GitHub.
