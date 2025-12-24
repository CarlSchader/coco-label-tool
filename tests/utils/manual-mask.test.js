/**
 * Tests for manual-mask.js utility
 * Converts boxes to COCO polygon format for manual mask creation
 */

import {
  boxToPolygon,
  boxesToSegmentation,
  calculateBboxFromPolygon,
  calculateAreaFromPolygon,
  createManualSegmentationResult,
} from "../../coco_label_tool/static/js/utils/manual-mask.js";

describe("boxToPolygon", () => {
  test("converts a basic box to polygon", () => {
    const box = { x1: 100, y1: 50, x2: 200, y2: 150 };
    const polygon = boxToPolygon(box);
    // Clockwise from top-left: TL, TR, BR, BL
    expect(polygon).toEqual([100, 50, 200, 50, 200, 150, 100, 150]);
  });

  test("handles box at origin", () => {
    const box = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const polygon = boxToPolygon(box);
    expect(polygon).toEqual([0, 0, 100, 0, 100, 100, 0, 100]);
  });

  test("handles box with decimal coordinates", () => {
    const box = { x1: 10.5, y1: 20.7, x2: 30.3, y2: 40.9 };
    const polygon = boxToPolygon(box);
    expect(polygon).toEqual([10.5, 20.7, 30.3, 20.7, 30.3, 40.9, 10.5, 40.9]);
  });

  test("handles inverted box (x2 < x1)", () => {
    // User might draw from right to left
    const box = { x1: 200, y1: 50, x2: 100, y2: 150 };
    const polygon = boxToPolygon(box);
    // Should normalize to proper polygon
    expect(polygon).toEqual([100, 50, 200, 50, 200, 150, 100, 150]);
  });

  test("handles inverted box (y2 < y1)", () => {
    // User might draw from bottom to top
    const box = { x1: 100, y1: 150, x2: 200, y2: 50 };
    const polygon = boxToPolygon(box);
    // Should normalize to proper polygon
    expect(polygon).toEqual([100, 50, 200, 50, 200, 150, 100, 150]);
  });

  test("handles fully inverted box", () => {
    const box = { x1: 200, y1: 150, x2: 100, y2: 50 };
    const polygon = boxToPolygon(box);
    expect(polygon).toEqual([100, 50, 200, 50, 200, 150, 100, 150]);
  });

  test("returns null for null box", () => {
    expect(boxToPolygon(null)).toBeNull();
  });

  test("returns null for undefined box", () => {
    expect(boxToPolygon(undefined)).toBeNull();
  });

  test("returns null for box missing coordinates", () => {
    expect(boxToPolygon({ x1: 100, y1: 50 })).toBeNull();
    expect(boxToPolygon({ x1: 100, x2: 200 })).toBeNull();
    expect(boxToPolygon({})).toBeNull();
  });

  test("handles zero-width box (line)", () => {
    const box = { x1: 100, y1: 50, x2: 100, y2: 150 };
    const polygon = boxToPolygon(box);
    // Degenerate but valid polygon
    expect(polygon).toEqual([100, 50, 100, 50, 100, 150, 100, 150]);
  });

  test("handles zero-height box (line)", () => {
    const box = { x1: 100, y1: 50, x2: 200, y2: 50 };
    const polygon = boxToPolygon(box);
    expect(polygon).toEqual([100, 50, 200, 50, 200, 50, 100, 50]);
  });

  test("handles point (zero width and height)", () => {
    const box = { x1: 100, y1: 50, x2: 100, y2: 50 };
    const polygon = boxToPolygon(box);
    expect(polygon).toEqual([100, 50, 100, 50, 100, 50, 100, 50]);
  });

  test("handles large coordinates", () => {
    const box = { x1: 10000, y1: 20000, x2: 30000, y2: 40000 };
    const polygon = boxToPolygon(box);
    expect(polygon).toEqual([
      10000, 20000, 30000, 20000, 30000, 40000, 10000, 40000,
    ]);
  });
});

describe("boxesToSegmentation", () => {
  test("converts single box to segmentation array", () => {
    const boxes = [{ x1: 100, y1: 50, x2: 200, y2: 150 }];
    const segmentation = boxesToSegmentation(boxes);
    expect(segmentation).toEqual([[100, 50, 200, 50, 200, 150, 100, 150]]);
  });

  test("converts multiple boxes to segmentation array", () => {
    const boxes = [
      { x1: 100, y1: 50, x2: 200, y2: 150 },
      { x1: 300, y1: 200, x2: 400, y2: 300 },
    ];
    const segmentation = boxesToSegmentation(boxes);
    expect(segmentation).toEqual([
      [100, 50, 200, 50, 200, 150, 100, 150],
      [300, 200, 400, 200, 400, 300, 300, 300],
    ]);
  });

  test("returns empty array for empty boxes array", () => {
    expect(boxesToSegmentation([])).toEqual([]);
  });

  test("returns empty array for null", () => {
    expect(boxesToSegmentation(null)).toEqual([]);
  });

  test("returns empty array for undefined", () => {
    expect(boxesToSegmentation(undefined)).toEqual([]);
  });

  test("filters out invalid boxes", () => {
    const boxes = [
      { x1: 100, y1: 50, x2: 200, y2: 150 },
      null,
      { x1: 300 }, // incomplete
      { x1: 300, y1: 200, x2: 400, y2: 300 },
    ];
    const segmentation = boxesToSegmentation(boxes);
    expect(segmentation).toEqual([
      [100, 50, 200, 50, 200, 150, 100, 150],
      [300, 200, 400, 200, 400, 300, 300, 300],
    ]);
  });

  test("normalizes inverted boxes", () => {
    const boxes = [
      { x1: 200, y1: 150, x2: 100, y2: 50 }, // fully inverted
    ];
    const segmentation = boxesToSegmentation(boxes);
    expect(segmentation).toEqual([[100, 50, 200, 50, 200, 150, 100, 150]]);
  });
});

describe("calculateBboxFromPolygon", () => {
  test("calculates bbox from polygon", () => {
    const polygon = [100, 50, 200, 50, 200, 150, 100, 150];
    const bbox = calculateBboxFromPolygon(polygon);
    // COCO format: [x, y, width, height]
    expect(bbox).toEqual([100, 50, 100, 100]);
  });

  test("calculates bbox from complex polygon", () => {
    // Non-rectangular polygon
    const polygon = [100, 100, 200, 50, 300, 100, 250, 200, 150, 200];
    const bbox = calculateBboxFromPolygon(polygon);
    expect(bbox).toEqual([100, 50, 200, 150]);
  });

  test("handles single point polygon", () => {
    const polygon = [100, 50];
    const bbox = calculateBboxFromPolygon(polygon);
    expect(bbox).toEqual([100, 50, 0, 0]);
  });

  test("returns null for empty polygon", () => {
    expect(calculateBboxFromPolygon([])).toBeNull();
  });

  test("returns null for null polygon", () => {
    expect(calculateBboxFromPolygon(null)).toBeNull();
  });

  test("returns null for undefined polygon", () => {
    expect(calculateBboxFromPolygon(undefined)).toBeNull();
  });

  test("handles polygon at origin", () => {
    const polygon = [0, 0, 100, 0, 100, 100, 0, 100];
    const bbox = calculateBboxFromPolygon(polygon);
    expect(bbox).toEqual([0, 0, 100, 100]);
  });
});

describe("calculateAreaFromPolygon", () => {
  test("calculates area of rectangular polygon", () => {
    // 100x100 rectangle
    const polygon = [100, 50, 200, 50, 200, 150, 100, 150];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(10000);
  });

  test("calculates area of square at origin", () => {
    const polygon = [0, 0, 100, 0, 100, 100, 0, 100];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(10000);
  });

  test("calculates area of right triangle", () => {
    // Triangle with base 100, height 100
    const polygon = [0, 0, 100, 0, 0, 100];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(5000);
  });

  test("returns 0 for degenerate polygon (line)", () => {
    const polygon = [0, 0, 100, 0];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(0);
  });

  test("returns 0 for single point", () => {
    const polygon = [50, 50];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(0);
  });

  test("returns 0 for empty polygon", () => {
    expect(calculateAreaFromPolygon([])).toBe(0);
  });

  test("returns 0 for null polygon", () => {
    expect(calculateAreaFromPolygon(null)).toBe(0);
  });

  test("returns 0 for undefined polygon", () => {
    expect(calculateAreaFromPolygon(undefined)).toBe(0);
  });

  test("handles clockwise winding order", () => {
    // Same rectangle but clockwise
    const polygon = [100, 50, 200, 50, 200, 150, 100, 150];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(10000);
  });

  test("handles counter-clockwise winding order", () => {
    // Same rectangle but counter-clockwise
    const polygon = [100, 150, 200, 150, 200, 50, 100, 50];
    const area = calculateAreaFromPolygon(polygon);
    expect(area).toBe(10000);
  });
});

describe("createManualSegmentationResult", () => {
  test("creates full segmentation result from single box", () => {
    const boxes = [{ x1: 100, y1: 50, x2: 200, y2: 150 }];
    const result = createManualSegmentationResult(boxes);

    expect(result).toEqual({
      segmentation: [[100, 50, 200, 50, 200, 150, 100, 150]],
      bbox: [100, 50, 100, 100],
      area: 10000,
    });
  });

  test("creates full segmentation result from multiple boxes", () => {
    const boxes = [
      { x1: 0, y1: 0, x2: 100, y2: 100 },
      { x1: 200, y1: 200, x2: 250, y2: 250 },
    ];
    const result = createManualSegmentationResult(boxes);

    expect(result.segmentation).toEqual([
      [0, 0, 100, 0, 100, 100, 0, 100],
      [200, 200, 250, 200, 250, 250, 200, 250],
    ]);
    // bbox should encompass all polygons
    expect(result.bbox).toEqual([0, 0, 250, 250]);
    // area should sum all polygon areas
    expect(result.area).toBe(10000 + 2500);
  });

  test("returns null for empty boxes", () => {
    expect(createManualSegmentationResult([])).toBeNull();
  });

  test("returns null for null boxes", () => {
    expect(createManualSegmentationResult(null)).toBeNull();
  });

  test("returns null for undefined boxes", () => {
    expect(createManualSegmentationResult(undefined)).toBeNull();
  });

  test("filters invalid boxes and returns result for valid ones", () => {
    const boxes = [null, { x1: 100, y1: 50, x2: 200, y2: 150 }, { x1: 10 }];
    const result = createManualSegmentationResult(boxes);

    expect(result.segmentation).toEqual([
      [100, 50, 200, 50, 200, 150, 100, 150],
    ]);
    expect(result.bbox).toEqual([100, 50, 100, 100]);
    expect(result.area).toBe(10000);
  });

  test("returns null if all boxes are invalid", () => {
    const boxes = [null, { x1: 10 }, undefined];
    expect(createManualSegmentationResult(boxes)).toBeNull();
  });
});
