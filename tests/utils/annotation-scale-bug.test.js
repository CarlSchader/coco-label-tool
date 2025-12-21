/**
 * Test to reproduce the coordinate system bug in box selection
 *
 * BUG: Selection box is in natural coordinates, but getAnnotationBoundingBox
 * divides annotation coordinates by scale, causing a mismatch.
 */

import {
  findAnnotationsInBox,
  getAnnotationBoundingBox,
} from "../../coco_label_tool/static/js/utils/annotations.js";

describe("Coordinate System Bug", () => {
  test("reproduces the bug: scaleX/scaleY cause wrong bounding boxes", () => {
    // Annotation in natural coordinates (e.g., 1000x1000 image)
    const annotation = {
      id: 1,
      segmentation: [[100, 100, 200, 100, 200, 200, 100, 200]], // 100x100 square at (100,100)
    };

    // If image is displayed at 500x500 (half size):
    // scaleX = naturalWidth / displayWidth = 1000 / 500 = 2
    const scaleX = 2;
    const scaleY = 2;

    // Get bounding box with scale
    const bbox = getAnnotationBoundingBox(annotation, scaleX, scaleY);

    // BUG: Bounding box is DIVIDED by scale, so:
    // x1 = 100 / 2 = 50 (WRONG! Should be 100)
    // x2 = 200 / 2 = 100 (WRONG! Should be 200)
    expect(bbox).toEqual({
      x1: 50, // Should be 100
      y1: 50, // Should be 100
      x2: 100, // Should be 200
      y2: 100, // Should be 200
    });
  });

  test("demonstrates correct behavior when scale = 1", () => {
    // Annotation in natural coordinates
    const annotation = {
      id: 1,
      segmentation: [[100, 100, 200, 100, 200, 200, 100, 200]],
    };

    // When scale = 1, no transformation
    const bbox = getAnnotationBoundingBox(annotation, 1, 1);

    // Correct: Bounding box matches annotation coordinates
    expect(bbox).toEqual({
      x1: 100,
      y1: 100,
      x2: 200,
      y2: 200,
    });
  });

  test("selection box in natural coords should use scale=1", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[100, 100, 200, 100, 200, 200, 100, 200]], // Natural coords
      },
      {
        id: 2,
        segmentation: [[300, 300, 400, 300, 400, 400, 300, 400]], // Natural coords
      },
    ];

    // Selection box in natural coordinates (user dragged from 50,50 to 250,250)
    const selectionBox = { x1: 50, y1: 50, x2: 250, y2: 250 };

    // FIX: Use scale=1 since both are in natural coordinates
    const correctResult = findAnnotationsInBox(selectionBox, annotations, 1, 1);

    // Should select annotation 1 (overlaps) but not 2 (doesn't overlap)
    expect(correctResult).toContain(1);
    expect(correctResult).not.toContain(2);
  });

  test("demonstrates the exact bug reported by user", () => {
    // Image is 2000x2000 natural, displayed at 500x500 (scale = 4)
    const scaleX = 4;
    const scaleY = 4;

    // Three annotations in natural coordinates
    const annotations = [
      { id: 1, segmentation: [[100, 100, 300, 100, 300, 300, 100, 300]] }, // Top-left
      { id: 2, segmentation: [[400, 400, 600, 400, 600, 600, 400, 600]] }, // Center
      {
        id: 3,
        segmentation: [[1000, 1000, 1200, 1000, 1200, 1200, 1000, 1200]],
      }, // Far away
    ];

    // User drags selection box in natural coords from (0,0) to (700,700)
    // Should select annotations 1 and 2, but not 3
    const selectionBox = { x1: 0, y1: 0, x2: 700, y2: 700 };

    // With BUG (using scale):
    // Ann 1 bbox: (25, 25, 75, 75) - overlaps ✓
    // Ann 2 bbox: (100, 100, 150, 150) - overlaps ✓
    // Ann 3 bbox: (250, 250, 300, 300) - overlaps ✓ (WRONG! Should not overlap)
    const buggyResult = findAnnotationsInBox(
      selectionBox,
      annotations,
      scaleX,
      scaleY,
    );
    expect(buggyResult).toHaveLength(3); // BUG: Selects all 3

    // With FIX (using scale=1):
    // Ann 1 bbox: (100, 100, 300, 300) - overlaps ✓
    // Ann 2 bbox: (400, 400, 600, 600) - overlaps ✓
    // Ann 3 bbox: (1000, 1000, 1200, 1200) - NO overlap ✓
    const fixedResult = findAnnotationsInBox(selectionBox, annotations, 1, 1);
    expect(fixedResult).toHaveLength(2);
    expect(fixedResult).toContain(1);
    expect(fixedResult).toContain(2);
    expect(fixedResult).not.toContain(3);
  });
});
