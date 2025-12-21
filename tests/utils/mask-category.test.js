import {
  findTopPointOfMask,
  initializeMaskCategories,
  validateMaskCategories,
  naturalToScreen,
  detectDropdownOverlap,
  offsetOverlappingDropdowns,
} from "../../coco_label_tool/static/js/utils/mask-category.js";

describe("findTopPointOfMask", () => {
  test("finds top point of rectangle", () => {
    const polygon = [10, 20, 50, 20, 50, 60, 10, 60];
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 10, y: 20 }); // Top-left corner
  });

  test("returns null if all points outside frame", () => {
    const polygon = [-10, -20, -5, -20, -5, -10, -10, -10];
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toBeNull();
  });

  test("finds top point within frame when some outside", () => {
    const polygon = [-10, 30, 20, 10, 50, 30, 20, 50];
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 20, y: 10 });
  });

  test("handles empty polygon", () => {
    const result = findTopPointOfMask([], 100, 100);
    expect(result).toBeNull();
  });

  test("handles polygon with single point", () => {
    const polygon = [50, 30];
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 50, y: 30 });
  });

  test("chooses leftmost point when multiple at same Y", () => {
    const polygon = [50, 20, 10, 20, 30, 40]; // Two points at y=20
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 10, y: 20 }); // Leftmost
  });

  test("handles point at frame boundary (inclusive)", () => {
    const polygon = [0, 0, 100, 0, 100, 100, 0, 100];
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  test("excludes point just outside frame", () => {
    const polygon = [-1, 5, 10, 20, 50, 20];
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 10, y: 20 }); // Skips (-1, 5)
  });

  test("handles null polygon", () => {
    const result = findTopPointOfMask(null, 100, 100);
    expect(result).toBeNull();
  });

  test("handles polygon with odd number of coordinates (incomplete point)", () => {
    const polygon = [10, 20, 30]; // Missing Y for third point
    const result = findTopPointOfMask(polygon, 100, 100);
    expect(result).toEqual({ x: 10, y: 20 }); // Uses first complete point
  });
});

describe("initializeMaskCategories", () => {
  test("creates array with default category", () => {
    const result = initializeMaskCategories(3, 5);
    expect(result).toEqual([5, 5, 5]);
  });

  test("creates array of nulls when no default", () => {
    const result = initializeMaskCategories(3, null);
    expect(result).toEqual([null, null, null]);
  });

  test("handles zero masks", () => {
    const result = initializeMaskCategories(0, 5);
    expect(result).toEqual([]);
  });

  test("handles large number of masks", () => {
    const result = initializeMaskCategories(100, 42);
    expect(result).toHaveLength(100);
    expect(result[0]).toBe(42);
    expect(result[99]).toBe(42);
  });

  test("handles undefined as default", () => {
    const result = initializeMaskCategories(2, undefined);
    expect(result).toEqual([undefined, undefined]);
  });
});

describe("validateMaskCategories", () => {
  test("validates all categories assigned", () => {
    const result = validateMaskCategories([1, 2, 3]);
    expect(result.valid).toBe(true);
    expect(result.missingIndices).toEqual([]);
  });

  test("identifies missing categories (null)", () => {
    const result = validateMaskCategories([1, null, 3, null]);
    expect(result.valid).toBe(false);
    expect(result.missingIndices).toEqual([1, 3]);
  });

  test("identifies missing categories (undefined)", () => {
    const result = validateMaskCategories([1, undefined, 3]);
    expect(result.valid).toBe(false);
    expect(result.missingIndices).toEqual([1]);
  });

  test("handles empty array", () => {
    const result = validateMaskCategories([]);
    expect(result.valid).toBe(true);
    expect(result.missingIndices).toEqual([]);
  });

  test("handles all null", () => {
    const result = validateMaskCategories([null, null, null]);
    expect(result.valid).toBe(false);
    expect(result.missingIndices).toEqual([0, 1, 2]);
  });

  test("handles single valid category", () => {
    const result = validateMaskCategories([42]);
    expect(result.valid).toBe(true);
    expect(result.missingIndices).toEqual([]);
  });

  test("accepts 0 as valid category ID", () => {
    const result = validateMaskCategories([0, 1, 2]);
    expect(result.valid).toBe(true);
    expect(result.missingIndices).toEqual([]);
  });
});

describe("naturalToScreen", () => {
  test("converts coordinates with scaling", () => {
    const result = naturalToScreen(100, 200, 0.5, 0.5);
    expect(result).toEqual({ x: 50, y: 100 });
  });

  test("handles 1:1 scaling", () => {
    const result = naturalToScreen(100, 200, 1, 1);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  test("handles 2x scaling", () => {
    const result = naturalToScreen(50, 100, 2, 2);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  test("handles different X and Y scales", () => {
    const result = naturalToScreen(100, 200, 0.5, 2);
    expect(result).toEqual({ x: 50, y: 400 });
  });

  test("handles zero coordinates", () => {
    const result = naturalToScreen(0, 0, 0.5, 0.5);
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

describe("detectDropdownOverlap", () => {
  test("detects horizontal overlap within threshold", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 110, y: 50 }, // 10px apart, within threshold
    ];
    const result = detectDropdownOverlap(positions, 30);
    expect(result).toEqual([{ index: 1, overlaps: [0] }]);
  });

  test("no overlap when beyond threshold", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 150, y: 50 }, // 50px apart, beyond threshold
    ];
    const result = detectDropdownOverlap(positions, 30);
    expect(result).toEqual([]);
  });

  test("detects multiple overlaps", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 105, y: 50 },
      { x: 110, y: 50 },
    ];
    const result = detectDropdownOverlap(positions, 30);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].overlaps).toContain(0);
  });

  test("no overlap if Y difference is large", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 105, y: 100 }, // Close in X but far in Y
    ];
    const result = detectDropdownOverlap(positions, 30);
    expect(result).toEqual([]);
  });

  test("handles empty positions array", () => {
    const result = detectDropdownOverlap([], 30);
    expect(result).toEqual([]);
  });

  test("handles single position", () => {
    const result = detectDropdownOverlap([{ x: 100, y: 50 }], 30);
    expect(result).toEqual([]);
  });

  test("detects overlap at exact threshold", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 129, y: 50 }, // 29px apart, within threshold of 30
    ];
    const result = detectDropdownOverlap(positions, 30);
    expect(result).toEqual([{ index: 1, overlaps: [0] }]);
  });
});

describe("offsetOverlappingDropdowns", () => {
  test("offsets overlapping dropdowns horizontally", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 110, y: 50 },
    ];
    const result = offsetOverlappingDropdowns(positions, 30, 25);
    expect(result[0]).toEqual({ x: 100, y: 50 }); // First unchanged
    expect(result[1].x).toBe(135); // 110 + 25 offset
    expect(result[1].y).toBe(50); // Y unchanged
  });

  test("leaves non-overlapping positions unchanged", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 200, y: 50 },
    ];
    const result = offsetOverlappingDropdowns(positions, 30, 25);
    expect(result).toEqual(positions);
  });

  test("offsets multiple overlapping dropdowns", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 105, y: 50 },
      { x: 110, y: 50 },
    ];
    const result = offsetOverlappingDropdowns(positions, 30, 25);
    expect(result[0].x).toBe(100); // First unchanged
    expect(result[1].x).toBeGreaterThan(105); // Offset applied
    expect(result[2].x).toBeGreaterThan(110); // Offset applied
  });

  test("does not modify original array", () => {
    const positions = [
      { x: 100, y: 50 },
      { x: 110, y: 50 },
    ];
    const original = JSON.parse(JSON.stringify(positions));
    offsetOverlappingDropdowns(positions, 30, 25);
    expect(positions).toEqual(original); // Original unchanged
  });

  test("handles empty array", () => {
    const result = offsetOverlappingDropdowns([], 30, 25);
    expect(result).toEqual([]);
  });
});
