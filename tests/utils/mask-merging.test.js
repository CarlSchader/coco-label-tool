/**
 * Tests for mask merging utilities
 */

import {
  calculatePolygonArea,
  calculateTotalArea,
  calculateCombinedBbox,
  mergeMaskPolygons,
  mergeAnnotationSegmentations,
} from "../../coco_label_tool/static/js/utils/mask-merging.js";

describe("calculatePolygonArea", () => {
  test("calculates area of simple rectangle", () => {
    const polygon = [0, 0, 10, 0, 10, 5, 0, 5]; // 10x5 rectangle
    const area = calculatePolygonArea(polygon);
    expect(area).toBe(50);
  });

  test("calculates area of triangle", () => {
    const polygon = [0, 0, 10, 0, 5, 10]; // Triangle
    const area = calculatePolygonArea(polygon);
    expect(area).toBe(50); // (base * height) / 2 = (10 * 10) / 2
  });

  test("returns 0 for empty polygon", () => {
    expect(calculatePolygonArea([])).toBe(0);
  });

  test("returns 0 for invalid polygon (less than 3 points)", () => {
    expect(calculatePolygonArea([0, 0, 10, 10])).toBe(0); // Only 2 points
  });

  test("returns 0 for null polygon", () => {
    expect(calculatePolygonArea(null)).toBe(0);
  });

  test("handles negative coordinates", () => {
    const polygon = [-5, -5, 5, -5, 5, 5, -5, 5]; // 10x10 square
    const area = calculatePolygonArea(polygon);
    expect(area).toBe(100);
  });
});

describe("calculateTotalArea", () => {
  test("sums areas of multiple polygons", () => {
    const polygons = [
      [0, 0, 10, 0, 10, 10, 0, 10], // 10x10 = 100
      [20, 20, 30, 20, 30, 25, 20, 25], // 10x5 = 50
    ];
    const total = calculateTotalArea(polygons);
    expect(total).toBe(150);
  });

  test("returns 0 for empty array", () => {
    expect(calculateTotalArea([])).toBe(0);
  });

  test("returns 0 for null", () => {
    expect(calculateTotalArea(null)).toBe(0);
  });

  test("handles single polygon", () => {
    const polygons = [[0, 0, 10, 0, 10, 10, 0, 10]]; // 10x10 = 100
    expect(calculateTotalArea(polygons)).toBe(100);
  });

  test("skips invalid polygons in array", () => {
    const polygons = [
      [0, 0, 10, 0, 10, 10, 0, 10], // 10x10 = 100 (valid)
      [], // Invalid
      [20, 20, 30, 20, 30, 25, 20, 25], // 10x5 = 50 (valid)
    ];
    expect(calculateTotalArea(polygons)).toBe(150);
  });
});

describe("calculateCombinedBbox", () => {
  test("calculates bbox from single polygon", () => {
    const polygons = [[10, 20, 50, 20, 50, 60, 10, 60]];
    const bbox = calculateCombinedBbox(polygons);
    expect(bbox).toEqual([10, 20, 40, 40]); // [x, y, width, height]
  });

  test("calculates bbox from multiple non-overlapping polygons", () => {
    const polygons = [
      [10, 10, 20, 10, 20, 20, 10, 20], // Top-left
      [50, 50, 60, 50, 60, 60, 50, 60], // Bottom-right
    ];
    const bbox = calculateCombinedBbox(polygons);
    expect(bbox).toEqual([10, 10, 50, 50]); // Spans from (10,10) to (60,60)
  });

  test("calculates bbox from overlapping polygons", () => {
    const polygons = [
      [0, 0, 30, 0, 30, 30, 0, 30],
      [20, 20, 50, 20, 50, 50, 20, 50],
    ];
    const bbox = calculateCombinedBbox(polygons);
    expect(bbox).toEqual([0, 0, 50, 50]); // Spans entire area
  });

  test("returns null for empty array", () => {
    expect(calculateCombinedBbox([])).toBeNull();
  });

  test("returns null for null", () => {
    expect(calculateCombinedBbox(null)).toBeNull();
  });

  test("handles negative coordinates", () => {
    const polygons = [[-10, -20, 10, -20, 10, 20, -10, 20]];
    const bbox = calculateCombinedBbox(polygons);
    expect(bbox).toEqual([-10, -20, 20, 40]);
  });

  test("handles polygons with mixed positive and negative coords", () => {
    const polygons = [
      [-10, -10, 0, -10, 0, 0, -10, 0],
      [5, 5, 15, 5, 15, 15, 5, 15],
    ];
    const bbox = calculateCombinedBbox(polygons);
    expect(bbox).toEqual([-10, -10, 25, 25]); // From (-10,-10) to (15,15)
  });
});

describe("mergeMaskPolygons", () => {
  test("merges multiple polygons into single mask", () => {
    const polygons = [
      [0, 0, 10, 0, 10, 10, 0, 10], // 10x10 = 100
      [20, 20, 30, 20, 30, 30, 20, 30], // 10x10 = 100
    ];

    const result = mergeMaskPolygons(polygons);

    expect(result.mergedPolygons).toEqual(polygons); // Keeps all polygons
    expect(result.bbox).toEqual([0, 0, 30, 30]);
    expect(result.area).toBe(200);
  });

  test("handles single polygon", () => {
    const polygons = [[0, 0, 10, 0, 10, 10, 0, 10]];

    const result = mergeMaskPolygons(polygons);

    expect(result.mergedPolygons).toEqual(polygons);
    expect(result.bbox).toEqual([0, 0, 10, 10]); // [x, y, width, height]
    expect(result.area).toBe(100);
  });

  test("returns null for empty array", () => {
    const result = mergeMaskPolygons([]);
    expect(result).toBeNull();
  });

  test("returns null for null", () => {
    const result = mergeMaskPolygons(null);
    expect(result).toBeNull();
  });

  test("filters out invalid polygons", () => {
    const polygons = [
      [0, 0, 10, 0, 10, 10, 0, 10], // Valid 10x10 = 100
      [], // Invalid
      [20, 20], // Invalid (too few points)
      [30, 30, 40, 30, 40, 40, 30, 40], // Valid 10x10 = 100
    ];

    const result = mergeMaskPolygons(polygons);

    expect(result.mergedPolygons).toHaveLength(2);
    expect(result.area).toBe(200);
  });

  test("preserves all valid polygons (non-contiguous regions)", () => {
    const polygons = [
      [0, 0, 5, 0, 5, 5, 0, 5],
      [10, 10, 15, 10, 15, 15, 10, 15],
      [20, 20, 25, 20, 25, 25, 20, 25],
    ];

    const result = mergeMaskPolygons(polygons);

    expect(result.mergedPolygons).toHaveLength(3);
    expect(result.mergedPolygons).toEqual(polygons);
  });

  test("handles complex polygon shapes", () => {
    const polygons = [
      [0, 0, 10, 5, 5, 10, 15, 15, 0, 10], // Irregular shape
      [20, 20, 25, 20, 25, 25, 20, 25], // Square
    ];

    const result = mergeMaskPolygons(polygons);

    expect(result.mergedPolygons).toHaveLength(2);
    expect(result.bbox).toBeDefined();
    expect(result.area).toBeGreaterThan(0);
  });

  test("result has correct structure", () => {
    const polygons = [[0, 0, 10, 0, 10, 10, 0, 10]];

    const result = mergeMaskPolygons(polygons);

    expect(result).toHaveProperty("mergedPolygons");
    expect(result).toHaveProperty("bbox");
    expect(result).toHaveProperty("area");
    expect(Array.isArray(result.mergedPolygons)).toBe(true);
    expect(Array.isArray(result.bbox)).toBe(true);
    expect(typeof result.area).toBe("number");
  });
});

describe("mergeAnnotationSegmentations", () => {
  test("merges segmentations from multiple annotations", () => {
    const annotations = [
      {
        id: 1,
        category_id: 5,
        segmentation: [[0, 0, 10, 0, 10, 10, 0, 10]], // 10x10 = 100
      },
      {
        id: 2,
        category_id: 5,
        segmentation: [[20, 20, 30, 20, 30, 30, 20, 30]], // 10x10 = 100
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(2);
    expect(result.bbox).toEqual([0, 0, 30, 30]);
    expect(result.area).toBe(200);
  });

  test("handles annotations with multiple polygons each", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [
          [0, 0, 5, 0, 5, 5, 0, 5], // 5x5 = 25
          [10, 10, 15, 10, 15, 15, 10, 15], // 5x5 = 25
        ],
      },
      {
        id: 2,
        segmentation: [
          [20, 20, 25, 20, 25, 25, 20, 25], // 5x5 = 25
        ],
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(3);
    expect(result.area).toBe(75);
  });

  test("handles single annotation", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[0, 0, 10, 0, 10, 10, 0, 10]],
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(1);
    expect(result.area).toBe(100);
  });

  test("returns null for empty array", () => {
    expect(mergeAnnotationSegmentations([])).toBeNull();
  });

  test("returns null for null input", () => {
    expect(mergeAnnotationSegmentations(null)).toBeNull();
  });

  test("returns null for undefined input", () => {
    expect(mergeAnnotationSegmentations(undefined)).toBeNull();
  });

  test("filters out annotations with empty segmentation", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[0, 0, 10, 0, 10, 10, 0, 10]],
      },
      {
        id: 2,
        segmentation: [],
      },
      {
        id: 3,
        segmentation: [[20, 20, 30, 20, 30, 30, 20, 30]],
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(2);
    expect(result.area).toBe(200);
  });

  test("filters out annotations with null segmentation", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[0, 0, 10, 0, 10, 10, 0, 10]],
      },
      {
        id: 2,
        segmentation: null,
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(1);
    expect(result.area).toBe(100);
  });

  test("filters out invalid polygons within segmentations", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [
          [0, 0, 10, 0, 10, 10, 0, 10], // Valid
          [20, 20], // Invalid (too few points)
        ],
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(1);
  });

  test("calculates correct combined bbox", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[10, 10, 20, 10, 20, 20, 10, 20]],
      },
      {
        id: 2,
        segmentation: [[50, 50, 100, 50, 100, 100, 50, 100]],
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.bbox).toEqual([10, 10, 90, 90]); // From (10,10) to (100,100)
  });

  test("preserves all valid polygons (non-contiguous regions)", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[0, 0, 5, 0, 5, 5, 0, 5]],
      },
      {
        id: 2,
        segmentation: [[100, 100, 105, 100, 105, 105, 100, 105]],
      },
      {
        id: 3,
        segmentation: [[200, 200, 205, 200, 205, 205, 200, 205]],
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result.mergedPolygons).toHaveLength(3);
  });

  test("returns null when all annotations have invalid segmentations", () => {
    const annotations = [
      { id: 1, segmentation: [] },
      { id: 2, segmentation: null },
      { id: 3, segmentation: [[10, 10]] }, // Too few points
    ];

    const result = mergeAnnotationSegmentations(annotations);

    expect(result).toBeNull();
  });

  test("merges overlapping polygons into single polygon", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]], // Square
      },
      {
        id: 2,
        segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]], // Overlapping square
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    // Should merge into a single polygon since they overlap
    expect(result.mergedPolygons).toHaveLength(1);
    // The merged area should cover the combined area
    expect(result.mergedPolygons[0].length).toBeGreaterThanOrEqual(6);
  });

  test("keeps non-overlapping polygons separate while merging overlapping ones", () => {
    const annotations = [
      {
        id: 1,
        segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]], // Overlaps with id:2
      },
      {
        id: 2,
        segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]], // Overlaps with id:1
      },
      {
        id: 3,
        segmentation: [[500, 500, 550, 500, 550, 550, 500, 550]], // Far away
      },
    ];

    const result = mergeAnnotationSegmentations(annotations);

    // Should have 2 polygons: one merged from first two, one separate
    expect(result.mergedPolygons).toHaveLength(2);
  });
});
