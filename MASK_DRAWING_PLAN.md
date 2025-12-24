# Freehand Mask Drawing Implementation Plan

## Overview

Add a new drawing mode activated by holding Alt/Option while dragging, which allows users to draw freehand curves that become mask prompts (for SAM2/SAM3-PVS) or final masks (for Manual mode).

## Feature Description

- **Trigger**: Hold Alt + drag on canvas
- **Action**: Draw a freehand curve that becomes a polygon mask
- **Supported Modes**:
  - **Manual**: Drawn masks become final segmentation output (no API call)
  - **SAM2**: Drawn masks become mask prompts sent to SAM2 API (Phase 2)
  - **SAM3 PVS**: Drawn masks become mask prompts sent to SAM3 Tracker API (Phase 3)
  - **SAM3 PCS**: NOT supported (text + boxes only)

## Design Decisions

| Aspect                   | Decision                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| Unclosed curves          | Auto-close with straight line connecting endpoints               |
| Multiple masks           | Support multiple mask prompts (like multiple boxes)              |
| Positive/Negative        | Only positive masks (left-click + Alt)                           |
| Visual feedback          | Show curve while drawing                                         |
| Interaction with prompts | Add to existing prompts (mask + points + boxes work together)    |
| Editing                  | Click on mask to delete it (like points/boxes)                   |
| Mode switching           | Clear ALL prompts (including masks) when switching modes         |
| Mask resolution          | Send at full/natural image resolution (backend scales if needed) |

---

## Phase 1: Manual Mode (Frontend Only)

### New Files

#### `tests/utils/mask-prompt.test.js`

Comprehensive tests for all utility functions.

#### `coco_label_tool/static/js/utils/mask-prompt.js`

Pure utility functions:

| Function                                          | Purpose                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `simplifyPath(points, tolerance)`                 | Reduce number of points in drawn path (Douglas-Peucker algorithm) |
| `isPathClosed(points, threshold)`                 | Check if start/end points are within closing threshold            |
| `closePath(points)`                               | Auto-close by adding start point to end                           |
| `screenToNaturalPolygon(points, scaleX, scaleY)`  | Convert screen coords to natural image coords                     |
| `naturalToScreenPolygon(polygon, scaleX, scaleY)` | Convert natural coords to screen coords for rendering             |
| `flattenPolygon(points)`                          | Convert `[{x,y}, ...]` to COCO format `[x1,y1,x2,y2,...]`         |
| `unflattenPolygon(flat)`                          | Convert COCO format back to `[{x,y}, ...]`                        |
| `isPointInMaskPrompt(x, y, polygon)`              | Hit detection for click-to-delete                                 |
| `calculatePolygonArea(polygon)`                   | Calculate area using Shoelace formula                             |
| `calculatePolygonBbox(polygon)`                   | Calculate bounding box `[x, y, width, height]`                    |
| `createMaskSegmentationResult(polygons)`          | Create result object matching SAM API format                      |

### Modified Files

#### `coco_label_tool/static/js/modes/base-mode.js`

Add new abstract method:

```javascript
supportsMaskDrawing() {
  throw new Error("BaseMode.supportsMaskDrawing() must be implemented by subclass");
}
```

#### Mode Classes - `supportsMaskDrawing()` Implementation

| Mode               | Returns |
| ------------------ | ------- |
| `ManualMode`       | `true`  |
| `SAM2Mode`         | `true`  |
| `SAM3PVSImageMode` | `true`  |
| `SAM3PCSImageMode` | `false` |

#### `coco_label_tool/static/js/app.js`

**New state variables:**

```javascript
let maskDrawing = false; // True while Alt + drag in progress
let maskDrawingPoints = []; // Screen coordinates of current drawing [{x, y}, ...]
let currentMaskPrompts = []; // Array of completed mask polygons in natural coords (COCO flat format)
```

**Modified functions:**

1. **`handleBoxStart(e)`**
   - Check `(e.metaKey || e.ctrlKey)` at start
   - If true AND mode supports mask drawing:
     - Set `maskDrawing = true`
     - Initialize `maskDrawingPoints = [{ x: screenX, y: screenY }]`
     - Return early (don't start box drawing)

2. **`handleBoxDrag(e)` / `handleMouseMove(e)`**
   - If `maskDrawing` is true:
     - Append current screen position to `maskDrawingPoints`
     - Redraw canvas with current drawing path

3. **`handleBoxEnd(e)`**
   - If `maskDrawing` is true:
     - Simplify path (reduce points)
     - Auto-close if needed
     - Convert to natural coordinates
     - Flatten to COCO format
     - Add to `currentMaskPrompts[]`
     - Reset drawing state
     - Trigger `runSegmentation()`

4. **`drawPrompts()`**
   - After drawing points and boxes, draw mask prompts
   - Render each polygon with distinct styling

5. **`checkPromptClick()`**
   - Add mask prompt hit detection
   - Remove clicked mask from `currentMaskPrompts[]`

6. **`runSegmentation()`** (Manual mode section)
   - If `currentMaskPrompts.length > 0`, use them as segmentation result
   - Can combine with box prompts (boxes become rectangles, masks stay as-is)

7. **`resetPrompts()`**
   - Add: `currentMaskPrompts = []`, `maskDrawing = false`, `maskDrawingPoints = []`

### Visual Design

**While drawing (Alt + drag):**

- Stroke color: Cyan (`#48d1cc`)
- Stroke width: 2px
- Dashed line style

**Completed mask prompt:**

- Fill: Semi-transparent cyan (`rgba(72, 209, 204, 0.2)`)
- Stroke: Solid cyan, 2px
- Delete button (×) at polygon centroid or top point

**Cursor:**

- Normal: `crosshair`
- Alt held: `crosshair` (could add visual indicator in UI)
- While drawing: `crosshair`

---

## Phase 2: SAM2 Backend Integration

### Modified Files

#### `coco_label_tool/app/models.py`

Add mask field to `SegmentRequest`:

```python
class SegmentRequest(BaseModel):
    image_id: int
    points: Optional[List[List[float]]] = None
    labels: Optional[List[int]] = None
    box: Optional[List[float]] = None
    boxes: Optional[List[List[float]]] = None
    box_labels: Optional[List[int]] = None
    mask: Optional[List[List[float]]] = None  # NEW: Polygon in COCO format [x1,y1,x2,y2,...]
```

#### `coco_label_tool/app/sam2.py`

Update `segment_image()`:

```python
def segment_image(
    self,
    image_path: Path,
    points: List[List[float]] | None = None,
    labels: List[int] | None = None,
    box: List[float] | None = None,
    mask: List[List[float]] | None = None,  # NEW parameter
) -> List[List[float]]:
    # ... existing processing ...

    input_masks = None
    if mask is not None:
        # Convert polygon to 256x256 binary mask
        # Scale coordinates from natural image size to 256x256
        # Render polygon to binary mask
        # Convert to tensor: (1, 1, 256, 256)
        input_masks = self._polygon_to_mask_tensor(mask, image_size)

    with torch.no_grad():
        outputs = self.model(**inputs, input_masks=input_masks, multimask_output=False)
```

#### `coco_label_tool/app/routes.py`

Pass mask to service:

```python
@app.post("/api/segment")
async def segment_image(request: SegmentRequest):
    # ...
    segmentation = sam2_service.segment_image(
        image_path,
        points=request.points,
        labels=request.labels,
        box=request.box,
        mask=request.mask,  # NEW
    )
```

#### `coco_label_tool/static/js/app.js`

Update `runSegmentation()` to send mask prompts in API request for SAM2 mode.

---

## Phase 3: SAM3 PVS Backend Integration

Similar to Phase 2, but for SAM3 Tracker:

### `coco_label_tool/app/sam3.py`

Add mask parameter to `segment_image()` method.

### `coco_label_tool/app/routes.py`

Update `/api/segment-sam3` endpoint to pass mask.

---

## File Changes Summary

### Phase 1 (Manual Mode)

| File                                                     | Action | Description                                       |
| -------------------------------------------------------- | ------ | ------------------------------------------------- |
| `tests/utils/mask-prompt.test.js`                        | CREATE | Unit tests for utility functions                  |
| `coco_label_tool/static/js/utils/mask-prompt.js`         | CREATE | Pure utility functions                            |
| `tests/modes/base-mode.test.js`                          | MODIFY | Test for `supportsMaskDrawing()`                  |
| `coco_label_tool/static/js/modes/base-mode.js`           | MODIFY | Add abstract `supportsMaskDrawing()`              |
| `tests/modes/manual-mode.test.js`                        | MODIFY | Test `supportsMaskDrawing()` returns true         |
| `coco_label_tool/static/js/modes/manual-mode.js`         | MODIFY | Implement `supportsMaskDrawing()` → true          |
| `tests/modes/sam2-mode.test.js`                          | MODIFY | Test `supportsMaskDrawing()` returns true         |
| `coco_label_tool/static/js/modes/sam2-mode.js`           | MODIFY | Implement `supportsMaskDrawing()` → true          |
| `tests/modes/sam3-pvs-image-mode.test.js`                | MODIFY | Test `supportsMaskDrawing()` returns true         |
| `coco_label_tool/static/js/modes/sam3-pvs-image-mode.js` | MODIFY | Implement `supportsMaskDrawing()` → true          |
| `tests/modes/sam3-pcs-image-mode.test.js`                | MODIFY | Test `supportsMaskDrawing()` returns false        |
| `coco_label_tool/static/js/modes/sam3-pcs-image-mode.js` | MODIFY | Implement `supportsMaskDrawing()` → false         |
| `coco_label_tool/static/js/app.js`                       | MODIFY | State vars, mouse handlers, drawing, segmentation |

### Phase 2 (SAM2 Backend)

| File                               | Action | Description                           |
| ---------------------------------- | ------ | ------------------------------------- |
| `tests/test_sam2.py`               | MODIFY | Tests for mask prompt                 |
| `coco_label_tool/app/models.py`    | MODIFY | Add `mask` field to `SegmentRequest`  |
| `coco_label_tool/app/sam2.py`      | MODIFY | Add mask parameter, convert to tensor |
| `coco_label_tool/app/routes.py`    | MODIFY | Pass mask to SAM2 service             |
| `coco_label_tool/static/js/app.js` | MODIFY | Send mask in API request              |

### Phase 3 (SAM3 PVS Backend)

| File                            | Action | Description               |
| ------------------------------- | ------ | ------------------------- |
| `tests/test_sam3.py`            | MODIFY | Tests for mask prompt     |
| `coco_label_tool/app/sam3.py`   | MODIFY | Add mask parameter        |
| `coco_label_tool/app/routes.py` | MODIFY | Pass mask to SAM3 service |

---

## Testing Strategy

### Unit Tests

- All pure utility functions in `mask-prompt.js`
- Mode capability methods (`supportsMaskDrawing()`)
- Backend mask processing (Phase 2/3)

### Manual Testing Checklist

#### Phase 1 (Manual Mode)

- [ ] Alt + drag draws freehand curve
- [ ] Curve visible while drawing (cyan dashed line)
- [ ] Releasing creates filled polygon mask
- [ ] Unclosed paths auto-close
- [ ] Multiple masks can be drawn
- [ ] Click on mask deletes it
- [ ] Masks render with correct styling
- [ ] Reset Prompts clears masks
- [ ] Switching modes clears masks
- [ ] Save annotation works with drawn masks
- [ ] Boxes and masks can coexist (both become segmentation polygons)

#### Phase 2 (SAM2)

- [ ] Drawn mask sent to SAM2 API
- [ ] SAM2 uses mask as prompt and refines segmentation
- [ ] Mask + points + boxes all work together

#### Phase 3 (SAM3 PVS)

- [ ] Same as Phase 2 but for SAM3 Tracker

---

## Implementation Order

1. Write tests for `mask-prompt.js` utility
2. Implement `mask-prompt.js` utility
3. Update mode tests for `supportsMaskDrawing()`
4. Implement `supportsMaskDrawing()` in all modes
5. Add state variables to `app.js`
6. Implement mask drawing (mouse handlers)
7. Implement mask rendering
8. Implement mask click-to-delete
9. Update `runSegmentation()` for Manual mode
10. Update `resetPrompts()`
11. Run all checks (`./scripts/check.sh`)
12. Manual testing

---

## Notes

- SAM2 requires masks at 256x256 resolution internally, but we send full resolution and let backend scale
- The Douglas-Peucker algorithm for path simplification prevents excessive points from slowing down rendering
- Mask prompts use the same COCO polygon format as annotations: `[x1, y1, x2, y2, ...]`
- When both boxes and masks exist in Manual mode, boxes become rectangles and masks stay as drawn polygons
