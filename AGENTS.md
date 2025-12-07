# Agent Instructions for label-tool

## Project Overview

COCO labeling tool with SAM2-powered segmentation. FastAPI backend + modular ES6 JavaScript frontend. Terminal-cyan aesthetic with monospace fonts.

**Architecture:** Refactored modular design with test-driven development

## Project Structure

```
app/
  __init__.py     - App factory and initialization
  config.py       - Configuration constants (DATASET_JSON, DATASET_DIR, CACHE_SIZE, etc.)
  models.py       - Pydantic request/response models
  routes.py       - API endpoint handlers (uses ImageCache class)
  dataset.py      - COCO JSON operations (pure functions)
  sam2.py         - SAM2 model inference (SAM2Service class)
  sam3.py         - SAM3 Tracker model inference (SAM3TrackerService class)
  exceptions.py   - Custom exception types
  helpers.py      - Route handler utilities
  cache.py        - ImageCache class (replaces module-level globals)
static/
  css/styles.css  - All application styles (CSS variables for theming)
  js/
    app.js        - Main application (1,618 lines, modular with imports)
    config.js     - Centralized configuration (colors, sizes, thresholds)
    api.js        - API utilities and error handling
    modals.js     - Modal management utilities
    modes/
      base-mode.js        - Abstract base class for modes
      mode-registry.js    - Mode factory and registry
      mode-manager.js     - Mode lifecycle orchestrator
      sam2-mode.js        - SAM2 mode implementation
      sam3-pvs-image-mode.js - SAM3 PVS mode implementation
      sam3-pcs-image-mode.js - SAM3 PCS mode implementation
    utils/
      colors.js          - Color generation utilities
      geometry.js        - Polygon/point operations
      box.js             - Box interaction detection and manipulation
      mask-merging.js    - Mask merging utilities
      model-selection.js - Model routing utilities
    validation/
      incomplete.js - Incomplete supercategory validation
      nested.js     - Nested mask validation
templates/
  index.html      - Main HTML template (no inline onclick)
tests/
  test_dataset.py   - Dataset CRUD tests (27 tests)
  test_cache.py     - Cache management tests (14 tests)
  test_exceptions.py- Exception tests (13 tests)
  test_helpers.py   - Helper function tests (5 tests)
  test_sam2.py      - SAM2 service tests (10 tests)
  test_sam3.py      - SAM3 Tracker service tests (15 tests)
  test_routes.py    - API integration tests (21 tests)
  modes/            - JS mode tests (Jest)
    base-mode.test.js          - Base mode tests (33 tests)
    mode-registry.test.js      - Registry tests (18 tests)
    mode-manager.test.js       - Manager tests (24 tests)
    sam2-mode.test.js          - SAM2 mode tests (8 tests)
    sam3-pvs-image-mode.test.js - SAM3 PVS tests (7 tests)
    sam3-pcs-image-mode.test.js - SAM3 PCS tests (7 tests)
  utils/            - JS utility tests (Jest)
    colors.test.js  - Color generation tests (40 tests)
    geometry.test.js- Polygon operation tests (15 tests)
    box.test.js     - Box interaction tests (56 tests)
    mask-merging.test.js - Mask merging tests (26 tests)
  validation/       - JS validation tests (Jest)
    incomplete.test.js - Incomplete supercategory tests (41 tests)
    nested.test.js  - Nested mask tests (32 tests)
  manual/           - Manual testing HTML files
    test_model_switching.html - Model switching UI test
    test-mobile-nav.html      - Mobile navigation test
    test-responsive-layout.html - Responsive layout test
    README.md       - Manual testing guide
server.py         - Application entry point (uvicorn with reload)
```

## Build/Run Commands

- **Run server**: `python server.py` or `DATASET_PATH=/path/to/dataset.json python server.py`
- **Run with script**: `./run-server.sh /path/to/dataset.json`
- **Install dependencies**: `uv sync` (Python), `npm install` (JS)
- **Run all tests**: `npm test` (JS) or `pytest` (Python)
- **Run single test file**: `npm test tests/utils/colors.test.js` or `pytest tests/test_dataset.py`
- **Run tests matching pattern**: `npm test -- --testNamePattern="hashString"`
- **Python linting/formatting**: `uv run ruff check` (lint), `uv run ruff check --fix` (auto-fix), `uv run ruff format` (format)
- **JavaScript linting**: `npx eslint .` (check), `npx eslint . --fix` (auto-fix)
- **JavaScript formatting**: `npx prettier --check .` (check), `npx prettier --write .` (format)
- **Helper scripts**: `./scripts/check.sh` (all checks), `./scripts/check-fix.sh` (fix all + test), `./scripts/lint.sh` (check), `./scripts/lint-fix.sh` (fix), `./scripts/format.sh` (format), `./scripts/test.sh` (tests)

## ⚠️ CRITICAL: Always Run Checks Before Finishing

**MANDATORY: After making ANY code changes, you MUST run:**

```bash
./scripts/check.sh
```

This runs:

- ✅ Format check (Prettier for JS/CSS/HTML, Ruff for Python)
- ✅ Linting (ESLint for JS, Ruff for Python)
- ✅ All tests (Jest for JS, pytest for Python)

**If checks fail:**

```bash
./scripts/check-fix.sh  # Auto-fix formatting + linting, then test
```

**DO NOT consider your work complete until `./scripts/check.sh` passes with no errors.**

## Testing Philosophy

**CRITICAL: Write tests BEFORE implementing features! This is a Test-Driven Development (TDD) codebase.**

### Test-First Development (MANDATORY)

**BEFORE writing ANY new feature:**

1. ✅ **Write comprehensive unit tests first** - Define expected behavior
2. ✅ **Run tests to see them fail** - Verify tests catch missing functionality
3. ✅ **Implement the feature** - Write minimal code to pass tests
4. ✅ **Run tests to see them pass** - Verify implementation works
5. ✅ **Refactor for readability and scalability** - MANDATORY, not optional (see below)
6. ✅ **Run `./scripts/check.sh`** - MANDATORY before considering work complete

**Why test-first is mandatory:**

- Ensures **high code coverage** (aim for 90%+)
- Prevents **untested code** from entering the codebase
- Forces **modular design** (testable code is better code)
- Catches **bugs early** (before they reach production)
- Provides **living documentation** of how features work
- Makes **refactoring safe** (tests verify nothing breaks)

## ⚠️ CRITICAL: Post-Implementation Refactoring

**MANDATORY: After implementing ANY feature, you MUST think about refactoring opportunities.**

### Refactoring Checklist (ALWAYS ASK YOURSELF)

After completing a feature, STOP and evaluate:

1. **Can logic be extracted into pure utility functions?**
   - ❌ BAD: Business logic mixed with DOM access in app.js
   - ✅ GOOD: Pure functions in `utils/`, thin wrappers in app.js

2. **Is there duplicated code?**
   - ❌ BAD: Same logic repeated in multiple places
   - ✅ GOOD: Single source of truth in utility module

3. **Are functions doing too much?**
   - ❌ BAD: 50+ line functions with multiple responsibilities
   - ✅ GOOD: Small, focused functions with single responsibility

4. **Is the code readable by a human who didn't write it?**
   - ❌ BAD: Unclear variable names, magic numbers, no comments
   - ✅ GOOD: Self-documenting code with descriptive names

5. **Will this scale as the codebase grows?**
   - ❌ BAD: Tightly coupled code that's hard to change
   - ✅ GOOD: Loosely coupled modules with clear interfaces

6. **Are there testability issues?**
   - ❌ BAD: Functions require DOM/global state to test
   - ✅ GOOD: Pure functions that can be unit tested

### Example: Frame Bounds Feature (328 → 143 lines)

**After implementing frame bounds checking, we refactored:**

```javascript
// ❌ BEFORE: Mixed concerns, not reusable, verbose tests
function isBoxIntersectingFrame(box) {
  const img = document.getElementById('image');  // DOM access
  if (!img || !box) return false;
  const frameX2 = img.naturalWidth;
  const frameY2 = img.naturalHeight;
  // ... 15 more lines of logic
}

// ✅ AFTER: Extracted pure utility
// utils/bounds.js (pure, testable, reusable)
export function hasBoxCornerInBounds(box, frameWidth, frameHeight) {
  if (!box) return false;
  const corners = [...];
  return corners.some(corner =>
    isPointInBounds(corner.x, corner.y, frameWidth, frameHeight)
  );
}

// app.js (thin wrapper, just DOM access)
function isBoxIntersectingFrame(box) {
  const img = document.getElementById('image');
  if (!img || !box) return false;
  return hasBoxCornerInBounds(box, img.naturalWidth, img.naturalHeight);
}
```

**Benefits:**

- 54% test reduction (328 → 143 lines)
- Reusable across the codebase
- Pure functions (no DOM coupling)
- Easier to understand and maintain

### When to Refactor

**Immediately after feature completion:**

1. Tests are passing ✅
2. Feature works ✅
3. NOW refactor (before moving to next task)

**DO NOT:**

- ❌ Skip refactoring "to save time" (technical debt accumulates)
- ❌ Plan to "refactor later" (it never happens)
- ❌ Leave code in a messy state (next developer pays the price)

**DO:**

- ✅ Refactor while context is fresh in your mind
- ✅ Run tests after each refactoring step
- ✅ Make small, incremental improvements
- ✅ Document why you refactored (helps future you)

### Refactoring Safety Net

Tests make refactoring safe:

```bash
# After each refactoring step
npm test && pytest  # Ensure nothing broke
./scripts/check.sh  # Formatting, linting, tests
```

If tests pass, refactoring is successful! If tests fail, you know immediately.

### When to Run Tests

- ✅ **After every code change** - Catch issues immediately
- ✅ **Before committing code** - Ensure nothing broke
- ✅ **After refactoring** - Validate behavior unchanged (CRITICAL)
- ✅ **When adding features** - Write tests FIRST (TDD)
- ✅ **Before opening PRs** - Full test suite must pass

### Quick Test Commands

```bash
# Run all tests (takes ~3 seconds)
npm test && pytest

# Run specific module you're working on
pytest tests/test_dataset.py -v
npm test tests/utils/colors.test.js

# Run with coverage to see gaps
pytest --cov=app tests/
npm test -- --coverage

# Watch mode for rapid TDD
npm test -- --watch
```

### Test Coverage Standards

- **Python**: 95 tests covering 100% of core business logic (including SAM3 multiple boxes)
- **JavaScript**: 299 tests for utilities, validation, interactions, state coordination, and UI
- **Total**: 394 tests (95 Python + 299 JavaScript)
- **Coverage requirement**: 90%+ for all new features (NO EXCEPTIONS)
- **No dataset required**: All tests use mocking
- **Fast execution**: Full suite runs in ~3 seconds

All tests use mocking for fast execution without requiring actual datasets.

## Code Style & Architecture

### Python Backend

**Architecture**: Refactored modular design with pure functions and custom exceptions
**Imports**: Standard library first, then third-party (torch, transformers, fastapi, cv2, PIL), then local modules
**Type hints**: Use throughout with Pydantic BaseModel for API schemas
**Naming**: snake_case for functions/variables, PascalCase for classes, UPPER_CASE for constants
**Error handling**: Custom exceptions in `exceptions.py` (ImageNotFoundError, CategoryInUseError, etc.)
**Module structure**:

- `dataset.py` - COCO JSON operations as pure functions
- `sam2.py` - ML model inference (stateful SAM2Service class)
- `routes.py` - Thin controllers that delegate to dataset/sam2 modules
  **Configuration**: All config in `config.py`, use environment variables
  **Cache management**: Use `ImageCache` class from `app/cache.py`, NOT module-level globals
  **No comments**: Code should be self-documenting with clear names

### Frontend (ES6 Modules)

**Architecture**: Modular ES6 with imports/exports
**Main file**: `static/js/app.js` (1,618 lines)
**Modules**: 7 focused modules (config, api, modals, utils/_, validation/_, modes/\*)
**State**: Global variables in app.js, passed to utility functions as parameters
**Naming**: camelCase for functions/variables
**Async**: Use async/await for API calls
**DOM**: Direct manipulation, no framework
**Event handling**: addEventListener, NO inline onclick
**Colors**: Deterministic color system (see `utils/colors.js`)
**No comments**: Self-documenting code preferred

### HTML/CSS

**HTML**: `templates/index.html` - semantic markup, NO inline styles or onclick
**CSS**: `static/css/styles.css` - CSS variables at top (`:root`), organized by component
**Theme**: Terminal-cyan aesthetic (updated from green)

- Background: `#0a0f14` (dark)
- Text: `#48d1cc` (cyan/teal)
- Borders: 2px solid with cyan accents
- Fonts: Monospace (SF Mono, Cascadia Code, Source Code Pro, Monaco, Consolas)
- Border radius: `0px` (sharp rectangles)
- Buttons: Transparent with colored borders, uppercase text, glow on hover
  **Layout**: Flexbox for controls, absolute positioning for canvas overlay

## Key Patterns

### Adding a New API Endpoint

1. Define Pydantic model in `app/models.py`
2. Add function in `app/dataset.py` or method in `app/sam2.py` if needed
3. Create route handler in `app/routes.py`
4. Use `cache.method()` to update cache after operations
5. Use custom exceptions from `app/exceptions.py` for error handling
6. Add frontend API call using `apiGet()` or `apiPost()` from `api.js`

**Example:**

```python
# app/dataset.py
def my_operation(param: str) -> Dict:
    with open(DATASET_JSON, "r") as f:
        data = json.load(f)
    # ... business logic ...
    return result

# app/routes.py
from . import dataset
from .cache import cache
from .exceptions import MyCustomError

@app.post("/api/my-endpoint")
async def my_endpoint(request: MyRequest):
    try:
        result = dataset.my_operation(request.data)
        cache.update_something(result)
        return {"success": True}
    except MyCustomError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### Adding Event Listeners (NO inline onclick)

**❌ Wrong:**

```html
<button onclick="myFunction()">Click</button>
```

**✅ Correct:**

```html
<!-- HTML -->
<button id="my-button">Click</button>

<!-- JavaScript in setupEventListeners() -->
document.getElementById('my-button')?.addEventListener('click', myFunction);
```

### Color System

- Each supercategory gets a unique primary color (18 colors in `CONFIG.primaryColors`)
- Categories within a supercategory get different brightness levels
- Colors are deterministic (same supercategory = same color)
- Functions in `utils/colors.js`: `getSupercategoryColor()`, `getCategoryColor()`, `rgbToHex()`
- Used for annotation overlays and UI indicators

**Usage:**

```javascript
import { getCategoryColor, rgbToHex } from './utils/colors.js';

const rgb = getCategoryColor(category, categories, superCache, catCache);
const hex = rgbToHex(rgb);
```

### Configuration System

All magic numbers centralized in `static/js/config.js`:

```javascript
CONFIG.canvas.pointRadius = 5;
CONFIG.colors.positive = '#00ff00';
CONFIG.validation.containmentThreshold = 0.8;
```

**Never hardcode values** - use CONFIG instead.

### State Management

**Frontend** (`app.js`):

- Global variables at top (lines ~1-50):
  - `images`, `currentIndex`, `totalImages` - navigation
  - `clickPoints`, `clickLabels` - point prompts (positive/negative)
  - `currentBox` - single box prompt (backward compatible)
  - `currentBoxes`, `currentBoxLabels` - multiple box prompts (SAM3)
  - `currentSegmentation` - active mask
  - `categories`, `selectedCategoryId` - category selection
  - `annotationsByImage` - cached annotations
  - `selectedAnnotationIds` - multi-select tracking
  - `supercategoryColors`, `categoryColors` - color caches

**Backend** (`routes.py`):

- `cache = ImageCache()` - single cache instance
- Use `cache.images`, `cache.add_annotation()`, etc.
- NO module-level mutable globals (OLD: `cached_images = []` ❌)

### Modal Management

Use `ModalManager` class from `modals.js`:

```javascript
import { ModalManager } from './modals.js';

const myModal = new ModalManager('myModalId');
myModal.show();
myModal.hide();
if (myModal.isVisible()) {
  /* ... */
}
```

Helper functions:

- `hideAllModals(modal1, modal2, ...)` - close multiple
- `createWarningListItem(title, annotated, missing)` - build UI
- `createNestedMismatchListItem(mismatch)` - build mismatch UI

### API Calls

Use utilities from `api.js`:

```javascript
import { apiGet, apiPost, showApiError } from './api.js';

try {
  const data = await apiPost('/api/endpoint', { foo: 'bar' });
  // Handle success
} catch (error) {
  showApiError(error);
}
```

**Benefits:** Consistent error handling, no duplicate try/catch blocks

### Validation Functions

**Incomplete Supercategories:**

```javascript
import { checkIncompleteSupercategories } from './validation/incomplete.js';

const issues = checkIncompleteSupercategories(currentImage, annotations, categories);
if (issues) {
  // Show warning
}
```

**Nested Mask Mismatches:**

```javascript
import { checkNestedMaskSupercategoryMismatch } from './validation/nested.js';

const mismatches = checkNestedMaskSupercategoryMismatch(currentImage, annotations, categories);
if (mismatches) {
  // Show warning
}
```

### Geometry Utilities

```javascript
import { isPolygonInsidePolygon, isPointInPolygon } from './utils/geometry.js';

const contained = isPolygonInsidePolygon(innerSeg, outerSeg);
const inside = isPointInPolygon(x, y, polygon);
```

### Save Button Validation

The save button is disabled when:

- No segmentation exists (`currentSegmentation === null`)
- No category selected (`selectedCategoryId` is empty)

`updateSaveButtonState()` is called in:

- `handleCategoryClick()` - when category changes
- `drawSegmentation()` - when new segmentation created
- `resetPrompts()` - when prompts cleared
- `showImage()` - when image changes
- After saving annotation

### Scrollable Containers

The annotation list uses:

- Fixed height container with `overflow-y: scroll`
- Header is `flex-shrink: 0` to stay fixed
- Items in `#annotation-items` with `height: 300px` for independent scrolling

## Recent Features Added

### Refactoring (Phase 1 + Phase 2)

- **Phase 1**: Centralized config, modal management, API utilities, cache class, event listeners
- **Phase 2**: Extracted color/geometry/validation utilities into focused modules
- **Interactive prompt removal**: Click points/boxes to remove them (re-runs SAM2)
- **Incomplete supercategory warnings**: Warns on navigation if supercategory missing subcategories
- **Nested mask warnings**: Warns if masks with different supercategories are nested

### SAM2 Enhancements

- **Negative prompts**: Right-click adds negative points (red), left-click positive (green)
- **Combined prompts**: Box + point modes always enabled, work together
- **Interactive removal**: Click on prompts to remove them individually
- Points stored in `clickPoints` array, labels in `clickLabels` (1=pos, 0=neg)
- Box has delete button (red X) in top-right corner

### SAM3 Enhancements (Tracker - PVS)

**Important**: We're using **SAM3 Tracker** (Promptable Visual Segmentation) which segments SPECIFIC objects.
For concept search (finding ALL instances), we'll need SAM3 Model (PCS) in the future.

- **Multiple box prompts**: Draw multiple boxes that work together
  - Each box added to `currentBoxes` array (not replaced)
  - **All boxes treated as positive prompts** (SAM3 Tracker limitation)
  - ❌ Box labels (positive/negative) NOT supported by SAM3 Tracker
  - ❌ Text prompts NOT supported by SAM3 Tracker
  - Each box has individual delete button
  - Backend: `/api/segment-sam3` accepts `boxes: [[x1,y1,x2,y2], ...]`
  - Backward compatible with single `box` parameter
- **Lazy loading**: SAM2 and SAM3 models only load when first requested (not at startup)
- **Model switching**: Loading indicators when switching between SAM2/SAM3 or model sizes

**SAM3 Tracker Limitations:**

- ❌ No negative boxes (all boxes are positive)
- ❌ No text prompts (visual prompts only)
- ✅ Multiple boxes work as multiple positive prompts
- ✅ Points with positive/negative labels work

### UI Improvements

- **Multi-select annotations**: Shift+click to toggle selection for bulk deletion
- **Keyboard shortcuts helper**: Floating "?" button in top-right shows all shortcuts
- **Color-coded categories**: Each supercategory gets unique color, categories get shades
- **Smaller annotation labels**: 10px font size
- **Fixed annotation list scrolling**: Independent scroll container
- **Save button validation**: Disabled until segmentation + category selected
- **Event-driven**: All buttons use addEventListener (no inline onclick)

### Terminal Aesthetic

- Updated to cyan/teal theme (#48d1cc)
- CSS variables for easy theming
- Monospace fonts throughout
- Sharp rectangles (0px border-radius)
- Transparent buttons with colored borders
- Glow effects on hover/focus
- Uppercase labels and button text

## File Modification Guidelines

- **Backend changes**: Modify `app/*.py` files, never inline in `server.py`
- **Frontend JS**: Create new modules in appropriate subdirs (utils/, validation/, etc.)
  - For app-specific code: Edit `static/js/app.js`
  - For reusable utilities: Create new module and import
- **Configuration**: Edit `static/js/config.js`, NOT hardcoded values
- **Styles**: Edit `static/css/styles.css`, not inline styles
- **HTML structure**: Edit `templates/index.html`
  - Add IDs to buttons, NO onclick attributes
  - Add event listeners in `setupEventListeners()` in app.js
- **Theme changes**: Modify CSS variables in `:root` selector at top of `styles.css`

## Module System

### Creating a New Utility Module (Test-First Approach)

**ALWAYS follow this sequence when adding new functionality:**

#### Step 1: Design the API with Tests First

```javascript
// tests/utils/myutil.test.js - WRITE THIS FIRST!
import { myUtility } from '../../static/js/utils/myutil.js';

describe('myUtility', () => {
  test('does something specific', () => {
    expect(myUtility(input)).toBe(expectedOutput);
  });

  test('handles edge case', () => {
    expect(myUtility(edgeCase)).toBe(expectedResult);
  });

  test('handles null/undefined', () => {
    expect(myUtility(null)).toBeNull();
  });
});
```

#### Step 2: Run Tests (They Should Fail)

```bash
npm test tests/utils/myutil.test.js
# Expected: Tests fail because myutil.js doesn't exist yet
```

#### Step 3: Create the Module

```javascript
// static/js/utils/myutil.js - CREATE AFTER TESTS
export function myUtility(params) {
  // Pure function, no side effects, no DOM access
  // All parameters passed explicitly (no globals)
  return result;
}
```

**Key principles for testable utilities:**

- ✅ **Pure functions** - Same input always produces same output
- ✅ **No DOM access** - Pass DOM values as parameters
- ✅ **No side effects** - Don't modify external state
- ✅ **Explicit parameters** - Don't rely on global variables
- ✅ **Single responsibility** - Each function does one thing well

#### Step 4: Import in app.js

```javascript
import { myUtility } from './utils/myutil.js';
```

#### Step 5: Create Wrapper if Needed

```javascript
// If utility needs DOM access or global state
function myUtilityLocal() {
  const domValue = document.getElementById('myElement').value;
  return myUtility(domValue, globalState1, globalState2);
}
```

**Example from the codebase (box interactions):**

```javascript
// ✅ GOOD: Pure utility in utils/box.js (fully testable)
export function detectBoxInteraction(mouseX, mouseY, box, scaleX, scaleY) {
  // No DOM access, all parameters explicit
  return { type: 'corner', corner: 'nw' };
}

// ✅ GOOD: Wrapper in app.js (handles DOM)
function detectBoxInteractionLocal(mouseX, mouseY) {
  const img = document.getElementById('image');
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  return detectBoxInteraction(mouseX, mouseY, currentBox, scaleX, scaleY);
}

// ❌ BAD: Mixing DOM access in utility (not testable)
export function detectBoxInteraction(mouseX, mouseY) {
  const img = document.getElementById('image'); // DOM access!
  const box = getCurrentBox(); // Global state!
  // This function cannot be unit tested!
}
```

### Test File Organization

Place tests in `tests/` mirroring `static/js/` structure:

```
static/js/utils/
  ├── colors.js
  ├── geometry.js
  └── box.js

tests/utils/
  ├── colors.test.js
  ├── geometry.test.js
  └── box.test.js
```

## Styling System

All styling uses CSS variables defined in `:root`:

- **Colors**: `--bg-primary`, `--text-primary`, `--border-accent`, `--accent-success`, etc.
- **Spacing**: `--spacing-xs` (4px) through `--spacing-xl` (24px)
- **Typography**: `--font-family`, `--font-size-base` (14px), `--font-size-sm` (12px)
- **Effects**: `--shadow-md`, `--radius-sm` (0px for terminal look)

To change theme: Modify variables in `:root`, entire app updates automatically.

## Common Gotchas

### Browser Caching

- CSS/JS changes may not appear immediately
- Always tell user to hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

### State Synchronization

- `currentSegmentation` must be reset when changing images
- `updateSaveButtonState()` must be called after state changes
- Annotation list must refresh when annotations added/deleted

### Infinite Recursion

- When creating wrapper functions, make sure they call the IMPORTED function, not themselves
- Example: `getColorLocal()` should call `getColor()`, NOT `getColorLocal()`

### ES6 Module Scope

- Functions in modules are NOT global
- Use `addEventListener`, never inline `onclick`
- Import what you need, export what you provide

### Cache Management

- Use `cache.method()` in routes.py
- Never mutate module-level globals
- Cache has methods: `update()`, `add_annotation()`, `delete_annotation()`, etc.

## Environment

- **Python**: 3.12+
- **Required env**: `DATASET_PATH` (path to COCO JSON file)
- **Optional env**: `USE_GPU=true` to enable CUDA
- **Server**: Uvicorn with reload for development
- **Port**: 8000 (configurable in `server.py`)

## Testing

### Unit Tests (JavaScript)

**Framework**: Jest with ES6 modules (`"type": "module"` in package.json)

**Run tests**:

- All tests: `npm test`
- Single file: `npm test tests/utils/colors.test.js`
- Pattern match: `npm test -- --testNamePattern="hashString"`
- Watch mode: `npm test -- --watch`

**Test structure**:

```javascript
import { myFunction } from '../../static/js/utils/myutil.js';

describe('myFunction', () => {
  test('does something', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

**Existing test files**:

- `tests/utils/colors.test.js` - Color generation and caching (40 tests)
- `tests/utils/geometry.test.js` - Polygon operations (15 tests)
- `tests/utils/box.test.js` - Box interaction detection and manipulation (56 tests)
- `tests/utils/box-rendering.test.js` - Box rendering outside canvas bounds (12 tests)
- `tests/utils/annotations.test.js` - Annotation selection utilities (38 tests)
- `tests/utils/annotation-scale-bug.test.js` - Coordinate system bug tests (4 tests)
- `tests/utils/selection-state.test.js` - Selection state coordination (17 tests)
- `tests/validation/incomplete.test.js` - Incomplete supercategory validation (41 tests)
- `tests/validation/nested.test.js` - Nested mask validation (32 tests)
- `tests/api.test.js` - API utilities (8 tests)
- `tests/config.test.js` - Configuration (2 tests)
- `tests/modals.test.js` - Modal management (2 tests)
- `tests/keyboard-hints.test.js` - Keyboard shortcuts UI logic (12 tests)
- `tests/utils/frame-bounds.test.js` - Frame bounds checking (20 tests)

**Test conventions**:

- Place tests in `tests/` mirroring `static/js/` structure
- Use descriptive test names
- Test pure functions (no DOM dependencies)
- Mock external dependencies if needed

### Manual Testing

**IMPORTANT**: Manual testing is required for DOM integration and user interaction flows that cannot be covered by unit tests.

#### Integration Testing Checklist

When adding features with user interaction (mouse/keyboard events):

**Event Handler Coverage:**

- ✅ Test interaction **inside** target element
- ✅ Test interaction **outside** target element (if applicable)
- ✅ Test interaction **across boundaries** (start inside, end outside)
- ✅ Test with modifier keys (Shift, Ctrl/Cmd, Alt)
- ✅ Test interruption cases (ESC key, clicking elsewhere)
- ✅ Test with different screen sizes/zoom levels

**Example: Drag Operations**

- [ ] Start drag inside canvas, move outside → Should continue
- [ ] Start drag outside canvas → Should work (if intended)
- [ ] Drag over UI elements (buttons, lists) → Should not interfere
- [ ] Release mouse outside canvas → Should complete operation
- [ ] Press ESC during drag → Should cancel operation

#### Manual UI Testing Checklist

1. Start server with test dataset
2. Test navigation (previous/next, arrow keys)
3. Test segmentation (points, box, combined, removal)
4. Test categories (add, delete, color coding)
5. Test annotations (save, select, multi-delete)
6. Test warnings (incomplete supercategories, nested masks)
7. Test all buttons and modals
8. **Test drag operations from inside AND outside canvas**
9. **Test keyboard modifiers (Shift for selection mode)**
10. Hard refresh browser between code changes

## Workflow for Making Changes

### MANDATORY Test-First Development Flow

**⚠️ CRITICAL: Always write tests BEFORE implementing features! No exceptions!**

#### For Backend Features (Python)

1. **Understand the requirement** - Read existing code and tests
2. **Write comprehensive tests first** - Aim for 90%+ coverage
   ```bash
   # Add tests to appropriate file: tests/test_dataset.py, tests/test_cache.py, etc.
   ```
3. **Run test (MUST fail)** - Verify test catches the missing feature
   ```bash
   pytest tests/test_dataset.py::TestNewFeature -v
   # Expected: ImportError or AttributeError (function doesn't exist)
   ```
4. **Implement minimal code** - Write just enough to pass tests
5. **Run test again (MUST pass)** - Verify implementation works
   ```bash
   pytest tests/test_dataset.py::TestNewFeature -v
   # Expected: All tests pass
   ```
6. **Run all tests** - Ensure nothing broke
   ```bash
   pytest && npm test
   # Expected: All 394 tests pass
   ```
7. **STOP and think about refactoring** - MANDATORY, not optional
   - Can logic be extracted to utilities?
   - Is there duplicated code?
   - Is the code readable and scalable?
   - See "Post-Implementation Refactoring" section above
8. **Implement refactorings** - Extract utilities, improve readability
   ```bash
   # After each refactoring step, verify tests still pass
   pytest && npm test
   ```
9. **Run `./scripts/check.sh`** - MANDATORY final step
   ```bash
   ./scripts/check.sh
   # Must pass: formatting, linting, all tests
   # If fails: run ./scripts/check-fix.sh
   ```

#### For Frontend Features (JavaScript)

1. **Understand the requirement** - Read existing code and tests
2. **Extract logic to utility module** - Make it testable (no DOM access)
3. **Write comprehensive tests first** - Cover all cases (happy path, edge cases, errors)
   ```bash
   # Create tests/utils/myfeature.test.js BEFORE creating the module
   ```
4. **Run test (MUST fail)** - Verify test catches missing module
   ```bash
   npm test tests/utils/myfeature.test.js
   # Expected: Module not found error
   ```
5. **Create utility module** - Pure functions only (pass DOM values as params)
   ```javascript
   // static/js/utils/myfeature.js
   export function myFeature(param1, param2) {
     // Pure function - no DOM access, no side effects
     return result;
   }
   ```
6. **Run tests (MUST pass)** - Verify implementation works
   ```bash
   npm test tests/utils/myfeature.test.js
   # Expected: All tests pass
   ```
7. **Create wrapper in app.js** - Handle DOM access here

   ```javascript
   import { myFeature } from './utils/myfeature.js';

   function myFeatureLocal() {
     const domValue = document.getElementById('element').value;
     return myFeature(domValue, globalState);
   }
   ```

8. **Run all tests** - Ensure nothing broke
   ```bash
   npm test && pytest
   # Expected: All 394 tests pass
   ```
9. **STOP and think about refactoring** - MANDATORY, not optional
   - Can logic be extracted to utilities?
   - Is there duplicated code?
   - Is the code readable and scalable?
   - See "Post-Implementation Refactoring" section above
10. **Implement refactorings** - Extract utilities, improve readability
    ```bash
    # After each refactoring step, verify tests still pass
    npm test && pytest
    ```
11. **Run `./scripts/check.sh`** - MANDATORY final step
    ```bash
    ./scripts/check.sh
    # Must pass: formatting, linting, all tests
    # If fails: run ./scripts/check-fix.sh
    ```

### Example: Adding Backend Function (Python)

```python
# STEP 1: Write test FIRST in tests/test_dataset.py
def test_get_images_by_category():
    """Test filtering images by category."""
    with patch("builtins.open", mock_open(read_data=json.dumps(MOCK_DATA))):
        images = get_images_by_category(1)
        assert len(images) == 2
        assert all(img["category_id"] == 1 for img in images)

# STEP 2: Run test (MUST fail - function doesn't exist yet)
pytest tests/test_dataset.py::test_get_images_by_category -v
# ❌ Expected: AttributeError: module 'app.dataset' has no attribute 'get_images_by_category'

# STEP 3: Implement in app/dataset.py
def get_images_by_category(category_id: int) -> List[Dict]:
    with open(DATASET_JSON, "r") as f:
        data = json.load(f)
        annotations = data.get("annotations", [])
        image_ids = {a["image_id"] for a in annotations if a["category_id"] == category_id}
        return [img for img in data.get("images", []) if img["id"] in image_ids]

# STEP 4: Run test again (MUST pass now)
pytest tests/test_dataset.py::test_get_images_by_category -v
# ✅ Expected: 1 passed

# STEP 5: Run all tests to ensure nothing broke
pytest && npm test
# ✅ Expected: All 286+ tests pass
```

### Example: Adding Frontend Feature (JavaScript)

```javascript
// STEP 1: Write tests FIRST in tests/utils/box.test.js (BEFORE creating box.js!)
import { detectBoxInteraction } from '../../static/js/utils/box.js';

describe('detectBoxInteraction', () => {
  test('detects northwest corner', () => {
    const box = { x1: 100, y1: 100, x2: 300, y2: 200 };
    const result = detectBoxInteraction(100, 100, box, 1, 1);
    expect(result).toEqual({ type: 'corner', corner: 'nw' });
  });

  test('detects edge', () => {
    const box = { x1: 100, y1: 100, x2: 300, y2: 200 };
    const result = detectBoxInteraction(100, 150, box, 1, 1);
    expect(result).toEqual({ type: 'edge', edge: 'left' });
  });

  test('handles null box', () => {
    const result = detectBoxInteraction(100, 100, null, 1, 1);
    expect(result).toBeNull();
  });

  // ... 50+ more tests covering all cases
});

// STEP 2: Run tests (MUST fail - module doesn't exist)
npm test tests/utils/box.test.js
// ❌ Expected: Cannot find module 'utils/box.js'

// STEP 3: Create utility module (pure function, no DOM!)
// static/js/utils/box.js
export function detectBoxInteraction(mouseX, mouseY, box, scaleX, scaleY) {
  if (!box) return null;

  const x1 = box.x1 / scaleX;
  const y1 = box.y1 / scaleY;
  const x2 = box.x2 / scaleX;
  const y2 = box.y2 / scaleY;

  // ... detection logic (no DOM access, all params explicit)

  return { type: 'corner', corner: 'nw' };
}

// STEP 4: Run tests (MUST pass now)
npm test tests/utils/box.test.js
// ✅ Expected: 56 tests passed

// STEP 5: Create wrapper in app.js for DOM access
import { detectBoxInteraction } from './utils/box.js';

function detectBoxInteractionLocal(mouseX, mouseY) {
  const img = document.getElementById('image'); // DOM access here
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  return detectBoxInteraction(mouseX, mouseY, currentBox, scaleX, scaleY);
}

// STEP 6: Run all tests
npm test && pytest
// ✅ Expected: All 286+ tests pass (196 JS + 90 Python)
```

### Why This Process is MANDATORY

- **Prevents untested code** - No feature ships without tests
- **Forces good design** - Testable code is modular, pure, and well-structured
- **Catches bugs early** - Before they reach production
- **Living documentation** - Tests show how features work
- **Safe refactoring** - Tests verify nothing breaks
- **High coverage** - Maintains 90%+ coverage target
- **Faster debugging** - Tests pinpoint exact failures

**❌ DO NOT:**

- Write code before tests
- Skip tests "because it's simple"
- Test only happy paths
- Mix DOM access in utilities

**✅ DO:**

- Write comprehensive tests first (90%+ coverage)
- Test happy paths AND edge cases
- Test error handling (null, undefined, invalid inputs)
- Extract pure utilities (separate from DOM)

## Documentation

- **AGENTS.md** - This file (agent instructions and development guidelines)
- **README.md** - Project overview, installation, and usage guide
- **FEATURE_REQUESTS.md** - Feature backlog and future enhancements
- **MOBILE_FRIENDLY_PLAN.md** - Mobile responsiveness enhancement plan

## Code Quality

**Achieved:**

- ✅ Modular architecture (7 focused modules)
- ✅ No global state mutation
- ✅ Centralized configuration
- ✅ Consistent error handling
- ✅ Event-driven (no inline onclick)
- ✅ Pure utility functions (testable)
- ✅ Clear separation of concerns

**Metrics:**

- app.js: ~1,600 lines (down from 1,753)
- Extracted: 250+ lines into utility modules
- Total modules: 8 (config, api, modals, 3 utils, 2 validation)
- Test coverage: 394 tests (95 Python + 299 JavaScript)
- Test-to-code ratio: >1:1 (more test code than production code)
- Maintainability: High
- Test coverage: 90%+

**Quality Enforcement:**

```bash
# ALWAYS run before considering work complete
./scripts/check.sh
```

This single command verifies:

- ✅ Code formatting (Prettier + Ruff)
- ✅ Linting (ESLint + Ruff)
- ✅ All tests pass (Jest + pytest)

**If any check fails, your work is NOT complete.**

## Model Architecture Design

### Separate Routes for SAM2 and SAM3

The application maintains **separate API endpoints** for SAM2 and SAM3, even though they currently have similar interfaces:

**SAM2 Routes:**

- `/api/segment` - Segmentation
- `/api/model-info` - Model information
- `/api/set-model-size` - Change model size

**SAM3 Routes:**

- `/api/segment-sam3` - Segmentation
- `/api/model-info-sam3` - Model information
- `/api/set-model-size-sam3` - Change model size

### Why Separate Routes?

1. **Future Capabilities** - SAM3 models will fundamentally have different capabilities (e.g., tracking, temporal features)
2. **Independent Evolution** - Each model can evolve its API independently
3. **Different Parameters** - SAM3 may support different prompt types or parameters
4. **Backward Compatibility** - Existing SAM2 integrations won't break when SAM3 changes
5. **Clear Separation** - Easy to maintain, test, and debug each model separately

### Frontend Routing

The frontend automatically routes to the correct endpoint based on `currentModelType`:

```javascript
// static/js/utils/model-selection.js
export function getSegmentEndpoint(modelType) {
  if (modelType === 'sam3') return '/api/segment-sam3';
  return '/api/segment';
}
```

Users see a seamless experience - just switch the model type dropdown and the correct backend is used.

### Adding New Model Types

To add a new model (e.g., SAM4):

1. Create service class: `app/sam4.py` with `SAM4Service` class
2. Add lazy loader: `get_sam4_service()` function
3. Add routes: `/api/segment-sam4`, `/api/model-info-sam4`, etc.
4. Update config: Add `SAM4_MODEL_SIZES` and `SAM4_MODEL_ID`
5. Add frontend utilities: Update `model-selection.js` with SAM4 cases
6. Add UI: Add "SAM4" option to model type dropdown
7. Write tests: Create `test_sam4.py` with comprehensive tests

The modular design makes it easy to add new models without affecting existing ones.
