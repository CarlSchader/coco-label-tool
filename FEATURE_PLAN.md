# Feature Implementation Plan

This document outlines the implementation plan for 5 requested features/fixes.

## Summary

| Phase     | Feature                                                  | Time Estimate | Status   |
| --------- | -------------------------------------------------------- | ------------- | -------- |
| 1.1       | Fix S3 dirty state bug (Feature 3)                       | 15 min        | Complete |
| 1.2       | CMD+Backspace to delete selected annotations (Feature 1) | 30 min        | Complete |
| 1.3       | CMD+M for saved annotations merge (Feature 4)            | 30 min        | Complete |
| 2         | Undo/Redo system for annotations (Feature 5)             | 1.5-2 days    | Pending  |
| 3         | Zoom/Pan with Space+Drag (Feature 2)                     | 2-3 days      | Pending  |
| **Total** |                                                          | **~4-5 days** |          |

---

## Feature Descriptions

### Feature 1: CMD+D to Delete Selected Annotations

**Problem:** Currently the only way to delete selected saved annotations is via button click.
**Solution:** Add keyboard shortcut CMD/Ctrl+D to delete selected annotations.

### Feature 2: Zoom, Pan on Image Frame

**Problem:** No way to zoom in on details or pan around large images.
**Solution:** Add mouse wheel zoom, Space+Drag pan, and UI controls.

### Feature 3: Category Changes Should Trigger S3 Save Button

**Problem:** Reported that changing categories doesn't enable the "Save to S3" button.
**Status:** Code review shows `markS3Dirty()` is already called after category operations. Need to verify if this is actually broken.

### Feature 4: CMD+M to Merge Saved Annotations

**Problem:** CMD+M only merges unsaved masks. To merge saved annotations, must use button.
**Solution:** Modify CMD+M to prioritize saved annotations when selected.

### Feature 5: Undo/Redo (CMD+Z / CMD+Shift+Z)

**Problem:** No way to undo accidental saves, deletes, or merges.
**Solution:** Implement command-pattern undo system for annotation operations.

---

## Phase 1: Quick Wins

### 1.1 Verify Feature 3 (S3 Category Bug)

**Investigation Required:**

- Test category add/update/delete to confirm if S3 save button activates
- If broken, investigate the `markS3Dirty()` call path

**Current Code (should already work):**

```javascript
// addCategory() - line 3745
if (response.ok) {
  // ...
  markS3Dirty();
}

// updateCategory() - line 3789
if (response.ok) {
  // ...
  markS3Dirty();
}

// deleteCategory() - line 3822
if (response.ok) {
  // ...
  markS3Dirty();
}
```

---

### 1.2 Feature 1: CMD+D Delete Selected Annotations

**Files to modify:**

- `coco_label_tool/static/js/app.js`
- `coco_label_tool/templates/index.html`

**Implementation:**

Add to keydown handler in `app.js`:

```javascript
// Cmd/Ctrl + D: Delete selected annotations
if ((e.ctrlKey || e.metaKey) && e.key === "d") {
  e.preventDefault(); // Prevent browser bookmark dialog
  if (selectedAnnotationIds.size > 0) {
    deleteSelectedAnnotations();
  }
}
```

Update keyboard hints in `index.html`:

```html
<li><kbd>Ctrl/Cmd + D</kbd> Delete selected annotations</li>
```

---

### 1.3 Feature 4: CMD+M for Saved Annotations

**Files to modify:**

- `coco_label_tool/static/js/app.js`

**Implementation:**

Modify existing CMD+M handler:

```javascript
// Cmd/Ctrl + M: Merge (prioritize saved annotations)
if ((e.ctrlKey || e.metaKey) && e.key === "m") {
  e.preventDefault();
  // First check for selected saved annotations
  if (selectedAnnotationIds.size >= 2) {
    mergeSelectedAnnotations();
  }
  // Fall back to unsaved masks
  else if (mergeBtn && !mergeBtn.disabled) {
    mergeMasks();
  }
}
```

---

## Phase 2: Undo/Redo System

### 2.1 Create UndoManager Utility

**New file:** `coco_label_tool/static/js/utils/undo.js`

**Class Design:**

```javascript
/**
 * Undo/Redo manager using command pattern.
 * Supports sync and async commands.
 */
export class UndoManager {
  constructor(maxHistory = 50);

  // Core operations
  async execute(command);     // Run command, push to undo stack
  async undo();               // Undo last command
  async redo();               // Redo last undone command

  // State queries
  canUndo();                  // Returns boolean
  canRedo();                  // Returns boolean
  getUndoDescription();       // Returns string for UI tooltip
  getRedoDescription();       // Returns string for UI tooltip

  // Stack management
  clear();                    // Clear both stacks

  // Event callbacks
  onChange(callback);         // Called when stacks change (for UI updates)
}
```

**Command Interface:**

```javascript
interface Command {
  type: string;               // e.g., "save-annotation", "delete-annotation"
  description: string;        // e.g., "Save annotation", "Delete 3 annotations"
  execute(): Promise<any>;    // Forward action (may be no-op if already executed)
  undo(): Promise<void>;      // Reverse action
}
```

---

### 2.2 Test File

**New file:** `tests/utils/undo.test.js`

**Test cases:**

- Basic undo/redo flow
- Max history limit enforcement
- canUndo/canRedo state checks
- Redo stack cleared on new command
- Async command handling
- Error handling (command fails)
- Clear functionality
- Description getters
- onChange callback invocation

---

### 2.3 Command Implementations

Commands are created AFTER the action succeeds. `execute()` is typically a no-op since the action already happened. `undo()` performs the reverse.

#### SaveAnnotationCommand

```javascript
class SaveAnnotationCommand {
  constructor(annotationId, imageId) {
    this.annotationId = annotationId;
    this.imageId = imageId;
    this.type = "save-annotation";
    this.description = "Save annotation";
  }

  async execute() {
    // No-op - annotation already saved
  }

  async undo() {
    // Delete the saved annotation
    await apiPost("/api/delete-annotation", {
      annotation_id: this.annotationId,
      confirmed: true,
    });
    // Refresh UI
    await loadDataset(true);
    redrawCanvas();
  }
}
```

#### DeleteAnnotationsCommand

```javascript
class DeleteAnnotationsCommand {
  constructor(annotationSnapshots, imageId) {
    this.snapshots = annotationSnapshots; // Full annotation data before delete
    this.imageId = imageId;
    this.type = "delete-annotations";
    this.description = `Delete ${annotationSnapshots.length} annotation(s)`;
  }

  async execute() {
    // No-op - annotations already deleted
  }

  async undo() {
    // Re-save each annotation from snapshot
    for (const snapshot of this.snapshots) {
      await apiPost("/api/save-annotation", {
        image_id: this.imageId,
        category_id: snapshot.category_id,
        segmentation: snapshot.segmentation,
        bbox: snapshot.bbox,
        area: snapshot.area,
      });
    }
    // Refresh UI
    await loadDataset(true);
    redrawCanvas();
  }
}
```

#### MergeAnnotationsCommand

```javascript
class MergeAnnotationsCommand {
  constructor(originalSnapshots, mergedAnnotationId, imageId) {
    this.originalSnapshots = originalSnapshots;
    this.mergedAnnotationId = mergedAnnotationId;
    this.imageId = imageId;
    this.type = "merge-annotations";
    this.description = `Merge ${originalSnapshots.length} annotations`;
  }

  async execute() {
    // No-op - merge already done
  }

  async undo() {
    // Delete the merged annotation
    await apiPost("/api/delete-annotation", {
      annotation_id: this.mergedAnnotationId,
      confirmed: true,
    });

    // Re-save original annotations
    for (const snapshot of this.originalSnapshots) {
      await apiPost("/api/save-annotation", {
        image_id: this.imageId,
        category_id: snapshot.category_id,
        segmentation: snapshot.segmentation,
        bbox: snapshot.bbox,
        area: snapshot.area,
      });
    }

    // Refresh UI
    await loadDataset(true);
    redrawCanvas();
  }
}
```

#### ChangeCategoryCommand

```javascript
class ChangeCategoryCommand {
  constructor(annotationIds, originalCategoryIds, newCategoryId) {
    this.annotationIds = annotationIds;
    this.originalCategoryIds = originalCategoryIds; // Map of id -> original category
    this.newCategoryId = newCategoryId;
    this.type = "change-category";
    this.description = `Change category of ${annotationIds.length} annotation(s)`;
  }

  async execute() {
    // No-op - category already changed
  }

  async undo() {
    // Restore original categories
    for (const [annId, originalCatId] of Object.entries(
      this.originalCategoryIds,
    )) {
      await apiPost("/api/update-annotation-category", {
        annotation_id: parseInt(annId),
        category_id: originalCatId,
      });
    }

    // Refresh UI
    await loadDataset(true);
    redrawCanvas();
  }
}
```

---

### 2.4 Integration Points in app.js

**Functions to modify:**

1. **`saveAnnotation()`**
   - After successful save, create `SaveAnnotationCommand`
   - Push to undo manager

2. **`deleteSelectedAnnotations()`**
   - Before delete, snapshot all selected annotations
   - After successful delete, create `DeleteAnnotationsCommand`
   - Push to undo manager

3. **`performMerge()`**
   - Before merge, snapshot original annotations
   - After successful merge, create `MergeAnnotationsCommand`
   - Push to undo manager

4. **`changeSelectedAnnotationsCategory()`**
   - Before change, store original category IDs
   - After successful change, create `ChangeCategoryCommand`
   - Push to undo manager

---

### 2.5 Keyboard Shortcuts

Add to keydown handler:

```javascript
// Cmd/Ctrl + Z: Undo
if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
  e.preventDefault();
  if (undoManager.canUndo()) {
    await undoManager.undo();
  }
}

// Cmd/Ctrl + Shift + Z: Redo
if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
  e.preventDefault();
  if (undoManager.canRedo()) {
    await undoManager.redo();
  }
}
```

---

### 2.6 UI Updates

**HTML (index.html):**

```html
<div class="undo-controls">
  <button id="btn-undo" disabled title="Undo (Ctrl+Z)">Undo</button>
  <button id="btn-redo" disabled title="Redo (Ctrl+Shift+Z)">Redo</button>
</div>
```

**JavaScript (app.js):**

```javascript
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("btn-undo");
  const redoBtn = document.getElementById("btn-redo");

  if (undoBtn) {
    undoBtn.disabled = !undoManager.canUndo();
    undoBtn.title = undoManager.canUndo()
      ? `Undo: ${undoManager.getUndoDescription()} (Ctrl+Z)`
      : "Nothing to undo";
  }

  if (redoBtn) {
    redoBtn.disabled = !undoManager.canRedo();
    redoBtn.title = undoManager.canRedo()
      ? `Redo: ${undoManager.getRedoDescription()} (Ctrl+Shift+Z)`
      : "Nothing to redo";
  }
}

// Register callback
undoManager.onChange(updateUndoRedoButtons);
```

**Keyboard hints (index.html):**

```html
<li><kbd>Ctrl/Cmd + Z</kbd> Undo</li>
<li><kbd>Ctrl/Cmd + Shift + Z</kbd> Redo</li>
```

---

### 2.7 Clear Undo on Context Change

Clear undo stack when:

- Navigating to different image (`showImage()`)
- Switching views (`handleViewChange()`)
- Loading dataset (`loadDataset()`)

```javascript
// In showImage()
undoManager.clear();
updateUndoRedoButtons();

// In handleViewChange()
undoManager.clear();
updateUndoRedoButtons();
```

---

## Phase 3: Zoom and Pan

### 3.1 Create ViewTransform Utility

**New file:** `coco_label_tool/static/js/utils/view-transform.js`

**Class Design:**

```javascript
/**
 * Manages view transformation (zoom, pan) for canvas rendering.
 * Provides coordinate conversion between screen and natural (image) space.
 */
export class ViewTransform {
  // State
  scale = 1; // Zoom level (MIN_SCALE to MAX_SCALE)
  panX = 0; // Pan offset in screen pixels
  panY = 0; // Pan offset in screen pixels

  // Constants
  static MIN_SCALE = 0.1; // 10%
  static MAX_SCALE = 10; // 1000%
  static ZOOM_STEP = 0.1; // 10% per step

  /**
   * Convert screen coordinates to natural (image) coordinates.
   * Used for mouse events to get coordinates for SAM prompts.
   */
  screenToNatural(screenX, screenY, imageScaleX, imageScaleY) {
    // Apply inverse pan, then inverse zoom, then image scale
    const x = ((screenX - this.panX) / this.scale) * imageScaleX;
    const y = ((screenY - this.panY) / this.scale) * imageScaleY;
    return [x, y];
  }

  /**
   * Convert natural (image) coordinates to screen coordinates.
   * Used for drawing annotations and masks.
   */
  naturalToScreen(naturalX, naturalY, imageScaleX, imageScaleY) {
    const x = (naturalX / imageScaleX) * this.scale + this.panX;
    const y = (naturalY / imageScaleY) * this.scale + this.panY;
    return [x, y];
  }

  /**
   * Zoom in centered on a point.
   */
  zoomIn(centerX, centerY) {
    this.zoomTo(this.scale + ViewTransform.ZOOM_STEP, centerX, centerY);
  }

  /**
   * Zoom out centered on a point.
   */
  zoomOut(centerX, centerY) {
    this.zoomTo(this.scale - ViewTransform.ZOOM_STEP, centerX, centerY);
  }

  /**
   * Zoom to specific level, keeping centerX/centerY fixed on screen.
   */
  zoomTo(newScale, centerX, centerY) {
    newScale = Math.max(
      ViewTransform.MIN_SCALE,
      Math.min(ViewTransform.MAX_SCALE, newScale),
    );

    // Adjust pan to keep center point stationary
    const scaleRatio = newScale / this.scale;
    this.panX = centerX - (centerX - this.panX) * scaleRatio;
    this.panY = centerY - (centerY - this.panY) * scaleRatio;
    this.scale = newScale;
  }

  /**
   * Pan by delta amounts.
   */
  pan(deltaX, deltaY) {
    this.panX += deltaX;
    this.panY += deltaY;
  }

  /**
   * Reset to default view.
   */
  reset() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Apply transform to canvas 2D context.
   */
  applyToContext(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);
  }

  /**
   * Get scale as percentage string.
   */
  getScalePercent() {
    return Math.round(this.scale * 100) + "%";
  }
}
```

---

### 3.2 Test File

**New file:** `tests/utils/view-transform.test.js`

**Test cases:**

- `screenToNatural` / `naturalToScreen` roundtrip accuracy
- `zoomIn` / `zoomOut` respects bounds (MIN_SCALE, MAX_SCALE)
- `zoomTo` keeps center point fixed
- `pan` updates offsets correctly
- `reset` restores defaults
- Scale clamping at boundaries
- `getScalePercent` formatting

---

### 3.3 Integration into Canvas Rendering

**Global state in app.js:**

```javascript
import { ViewTransform } from "./utils/view-transform.js";
let viewTransform = new ViewTransform();
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
```

**Drawing with transform:**

```javascript
function redrawCanvas() {
  const ctx = canvas.getContext("2d");

  // Clear with identity transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply view transform
  viewTransform.applyToContext(ctx);

  // All existing drawing code (coordinates stay in screen space)
  drawExistingAnnotations();
  drawSegmentationMasks();
  drawAllPrompts();
  // etc.

  // Reset transform for UI elements that shouldn't be transformed
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
```

**Mouse coordinate conversion:**

Update all mouse handlers to use transform:

```javascript
function handleImageClick(e) {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const originalDims = getOriginalImageDimensions();
  const img = document.getElementById("image");
  const imageScaleX = originalDims.width / img.width;
  const imageScaleY = originalDims.height / img.height;

  // Apply inverse transform to get natural coordinates
  const [naturalX, naturalY] = viewTransform.screenToNatural(
    screenX,
    screenY,
    imageScaleX,
    imageScaleY,
  );

  // Use naturalX, naturalY for SAM prompts
  // ...
}
```

---

### 3.4 Event Handlers

**Mouse wheel zoom:**

```javascript
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;

    if (e.deltaY < 0) {
      viewTransform.zoomIn(centerX, centerY);
    } else {
      viewTransform.zoomOut(centerX, centerY);
    }

    redrawCanvas();
    updateZoomDisplay();
  },
  { passive: false },
);
```

**Space + Drag pan:**

```javascript
// Track space key state
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !isPanning && !e.repeat) {
    isPanning = true;
    canvas.style.cursor = "grab";
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    isPanning = false;
    canvas.style.cursor = "crosshair";
  }
});

// Pan on mouse drag while space is held
canvas.addEventListener("mousedown", (e) => {
  if (isPanning) {
    canvas.style.cursor = "grabbing";
    panStartX = e.clientX;
    panStartY = e.clientY;
    e.preventDefault();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (isPanning && e.buttons === 1) {
    const deltaX = e.clientX - panStartX;
    const deltaY = e.clientY - panStartY;
    viewTransform.pan(deltaX, deltaY);
    panStartX = e.clientX;
    panStartY = e.clientY;
    redrawCanvas();
  }
});

canvas.addEventListener("mouseup", () => {
  if (isPanning) {
    canvas.style.cursor = "grab";
  }
});
```

**Keyboard shortcuts:**

```javascript
// + or = : Zoom in (centered)
if (e.key === "+" || e.key === "=") {
  viewTransform.zoomIn(canvas.width / 2, canvas.height / 2);
  redrawCanvas();
  updateZoomDisplay();
  e.preventDefault();
}

// - : Zoom out (centered)
if (e.key === "-") {
  viewTransform.zoomOut(canvas.width / 2, canvas.height / 2);
  redrawCanvas();
  updateZoomDisplay();
  e.preventDefault();
}

// 0 : Reset view
if (e.key === "0" && !e.ctrlKey && !e.metaKey) {
  viewTransform.reset();
  redrawCanvas();
  updateZoomDisplay();
  e.preventDefault();
}
```

---

### 3.5 UI Controls

**HTML (index.html):**

```html
<div class="zoom-controls">
  <button id="btn-zoom-out" title="Zoom Out (-)">-</button>
  <span id="zoom-level" title="Current zoom level">100%</span>
  <button id="btn-zoom-in" title="Zoom In (+)">+</button>
  <button id="btn-zoom-reset" title="Reset View (0)">Reset</button>
</div>
```

**JavaScript (app.js):**

```javascript
function updateZoomDisplay() {
  const zoomLevel = document.getElementById("zoom-level");
  if (zoomLevel) {
    zoomLevel.textContent = viewTransform.getScalePercent();
  }
}

// Event listeners
document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
  viewTransform.zoomIn(canvas.width / 2, canvas.height / 2);
  redrawCanvas();
  updateZoomDisplay();
});

document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
  viewTransform.zoomOut(canvas.width / 2, canvas.height / 2);
  redrawCanvas();
  updateZoomDisplay();
});

document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
  viewTransform.reset();
  redrawCanvas();
  updateZoomDisplay();
});
```

**CSS (styles.css):**

```css
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-controls button {
  width: 32px;
  height: 32px;
  font-size: 18px;
  font-weight: bold;
}

#zoom-level {
  min-width: 50px;
  text-align: center;
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
}
```

---

### 3.6 Reset on Image Change

In `showImage()`:

```javascript
async function showImage(index) {
  // ... existing code ...

  // Reset view transform when changing images
  viewTransform.reset();
  updateZoomDisplay();

  // ... rest of function ...
}
```

---

### 3.7 Dropdown Positioning Update

The mask category dropdowns need to account for transform:

```javascript
function renderMaskCategoryDropdowns() {
  // ... existing code ...

  // Convert natural position to screen, accounting for view transform
  const originalDims = getOriginalImageDimensions();
  const img = document.getElementById("image");
  const imageScaleX = originalDims.width / img.width;
  const imageScaleY = originalDims.height / img.height;

  const [screenX, screenY] = viewTransform.naturalToScreen(
    naturalX,
    naturalY,
    imageScaleX,
    imageScaleY,
  );

  // Position dropdown at screenX, screenY
  dropdown.style.left = `${screenX}px`;
  dropdown.style.top = `${screenY}px`;

  // ... rest of function ...
}
```

---

### 3.8 Functions Requiring Coordinate Updates

The following functions need to use `viewTransform.screenToNatural()` for mouse input:

- `handleImageClick()`
- `handleBoxStart()`
- `handleBoxDrag()`
- `handleBoxEnd()`
- `handleMaskDrawingStart()`
- `handleMaskDrawingDrag()`
- `handleMaskDrawingEnd()`
- `checkPromptHover()`
- `checkPromptClick()`
- `checkAnnotationHover()`
- `handleAnnotationClick()`
- `detectBoxInteractionLocal()`

The following functions need to use `viewTransform.naturalToScreen()` for drawing:

- `drawExistingAnnotations()`
- `drawSegmentationMasks()`
- `drawAllPrompts()`
- `drawPoint()`
- `drawSelectionBox()`
- `drawMaskPrompts()`
- `drawMaskDrawingPath()`
- `renderMaskCategoryDropdowns()`

Note: If using `viewTransform.applyToContext(ctx)`, most drawing functions may work without modification since the context transform handles the conversion. However, functions that position HTML elements (like dropdowns) will need explicit conversion.

---

### 3.9 Update Keyboard Hints

Add to hints panel in `index.html`:

```html
<li><kbd>Mouse Wheel</kbd> Zoom in/out</li>
<li><kbd>Space + Drag</kbd> Pan view</li>
<li><kbd>+</kbd> / <kbd>-</kbd> Zoom in/out</li>
<li><kbd>0</kbd> Reset view</li>
```

---

## File Change Summary

### New Files

| File                                                | Purpose             |
| --------------------------------------------------- | ------------------- |
| `coco_label_tool/static/js/utils/undo.js`           | UndoManager class   |
| `coco_label_tool/static/js/utils/view-transform.js` | ViewTransform class |
| `tests/utils/undo.test.js`                          | Undo tests          |
| `tests/utils/view-transform.test.js`                | Transform tests     |

### Modified Files

| File                                    | Changes                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `coco_label_tool/static/js/app.js`      | Keybinds (CMD+D, CMD+M, CMD+Z), undo integration, zoom/pan integration |
| `coco_label_tool/templates/index.html`  | Undo/redo buttons, zoom controls, updated keyboard hints               |
| `coco_label_tool/static/css/styles.css` | Undo/redo button styling, zoom control styling                         |

---

## Testing Checklist

### Phase 1

- [ ] CMD+D deletes selected annotations
- [ ] CMD+D does nothing when no annotations selected
- [ ] CMD+D prevented from triggering browser bookmark
- [ ] CMD+M merges saved annotations when 2+ selected
- [ ] CMD+M falls back to unsaved mask merge
- [ ] Category changes enable S3 save button (verify)

### Phase 2

- [ ] CMD+Z undoes last annotation save
- [ ] CMD+Z undoes annotation delete (restores annotations)
- [ ] CMD+Z undoes annotation merge (restores originals)
- [ ] CMD+Z undoes category change on annotations
- [ ] CMD+Shift+Z redoes undone action
- [ ] Undo/redo buttons enable/disable correctly
- [ ] Undo stack clears on image change
- [ ] Undo stack clears on view change
- [ ] Max history limit enforced (50)

### Phase 3

- [ ] Mouse wheel zooms in/out
- [ ] Zoom centers on cursor position
- [ ] Space+Drag pans the view
- [ ] Cursor changes to grab/grabbing during pan
- [ ] +/- keys zoom in/out
- [ ] 0 key resets view
- [ ] Zoom buttons work
- [ ] Zoom level display updates
- [ ] View resets on image change
- [ ] Point prompts placed correctly when zoomed/panned
- [ ] Box prompts drawn correctly when zoomed/panned
- [ ] Existing annotations render correctly when zoomed/panned
- [ ] Mask category dropdowns positioned correctly when zoomed/panned
- [ ] Zoom clamped to min/max bounds

---

## Notes

### Rotation (Future)

Rotation was deferred to reduce complexity. If added later:

- Add `rotation` property to ViewTransform (0, 90, 180, 270 degrees)
- Rotation adds significant complexity to coordinate transforms
- Would need rotation matrix math in screenToNatural/naturalToScreen
- UI controls for rotation (R key? Rotate button?)

### Performance Considerations

- Zoom/pan should be smooth (no lag on redraw)
- Consider using `requestAnimationFrame` for smooth panning
- Large images with many annotations may need optimization
- Canvas transform is GPU-accelerated, should be fast

### Edge Cases

- Zoom limits prevent zooming too far in/out
- Pan should ideally keep some part of image visible (optional: implement pan clamping)
- Window resize should maintain view transform (or reset)
