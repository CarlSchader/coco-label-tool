/**
 * Tests for mask-prompt.js utility
 * Functions for freehand mask drawing and polygon manipulation
 */

import {
  simplifyPath,
  isPathClosed,
  closePath,
  screenToNaturalPolygon,
  naturalToScreenPolygon,
  flattenPolygon,
  unflattenPolygon,
  isPointInPolygon,
  calculatePolygonCentroid,
  calculatePolygonArea,
  calculatePolygonBbox,
  createMaskSegmentationResult,
} from "../../coco_label_tool/static/js/utils/mask-prompt.js";

describe("simplifyPath", () => {
  test("returns empty array for empty input", () => {
    expect(simplifyPath([], 5)).toEqual([]);
  });

  test("returns same array for single point", () => {
    const points = [{ x: 100, y: 100 }];
    expect(simplifyPath(points, 5)).toEqual(points);
  });

  test("returns same array for two points", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(simplifyPath(points, 5)).toEqual(points);
  });

  test("removes collinear points", () => {
    // Three points in a straight line
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ];
    const result = simplifyPath(points, 5);
    // Middle point should be removed since it's on the line
    expect(result.length).toBeLessThanOrEqual(points.length);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 100, y: 100 });
  });

  test("keeps points that deviate from line", () => {
    // Triangle - no points should be removed
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const result = simplifyPath(points, 5);
    expect(result.length).toBe(3);
  });

  test("handles complex path", () => {
    // Many points forming a rough circle - should simplify
    const points = [];
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      points.push({
        x: 100 + Math.cos(angle) * 50 + Math.random() * 2,
        y: 100 + Math.sin(angle) * 50 + Math.random() * 2,
      });
    }
    const result = simplifyPath(points, 5);
    expect(result.length).toBeLessThan(points.length);
    expect(result.length).toBeGreaterThan(3); // Should keep basic shape
  });

  test("returns null for null input", () => {
    expect(simplifyPath(null, 5)).toEqual([]);
  });

  test("returns empty for undefined input", () => {
    expect(simplifyPath(undefined, 5)).toEqual([]);
  });

  test("handles zero tolerance", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 1 },
      { x: 100, y: 0 },
    ];
    // With zero tolerance, even tiny deviations are kept
    const result = simplifyPath(points, 0);
    expect(result.length).toBe(3);
  });
});

describe("isPathClosed", () => {
  test("returns true when start and end are same point", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 0 },
    ];
    expect(isPathClosed(points, 10)).toBe(true);
  });

  test("returns true when start and end are within threshold", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 5, y: 5 },
    ];
    expect(isPathClosed(points, 10)).toBe(true);
  });

  test("returns false when start and end are outside threshold", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 50 },
    ];
    expect(isPathClosed(points, 10)).toBe(false);
  });

  test("returns false for empty array", () => {
    expect(isPathClosed([], 10)).toBe(false);
  });

  test("returns false for single point", () => {
    expect(isPathClosed([{ x: 0, y: 0 }], 10)).toBe(false);
  });

  test("returns true for two points at same location", () => {
    const points = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ];
    expect(isPathClosed(points, 10)).toBe(true);
  });

  test("returns false for null input", () => {
    expect(isPathClosed(null, 10)).toBe(false);
  });

  test("returns false for undefined input", () => {
    expect(isPathClosed(undefined, 10)).toBe(false);
  });

  test("uses euclidean distance", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 7, y: 7 }, // Distance from origin: sqrt(49+49) ≈ 9.9
    ];
    expect(isPathClosed(points, 10)).toBe(true);
    expect(isPathClosed(points, 9)).toBe(false);
  });
});

describe("closePath", () => {
  test("adds start point to end if not closed", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const result = closePath(points);
    expect(result.length).toBe(4);
    expect(result[3]).toEqual({ x: 0, y: 0 });
  });

  test("does not duplicate if already closed", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 0 },
    ];
    const result = closePath(points);
    expect(result.length).toBe(4);
  });

  test("returns empty array for empty input", () => {
    expect(closePath([])).toEqual([]);
  });

  test("returns same for single point", () => {
    const points = [{ x: 50, y: 50 }];
    expect(closePath(points)).toEqual(points);
  });

  test("returns null for null input", () => {
    expect(closePath(null)).toEqual([]);
  });

  test("does not mutate original array", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const original = [...points];
    closePath(points);
    expect(points).toEqual(original);
  });
});

describe("screenToNaturalPolygon", () => {
  test("scales coordinates correctly", () => {
    const points = [
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 100 },
    ];
    const result = screenToNaturalPolygon(points, 2, 2);
    expect(result).toEqual([
      { x: 200, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 200 },
    ]);
  });

  test("handles scale factor of 1", () => {
    const points = [
      { x: 100, y: 50 },
      { x: 200, y: 100 },
    ];
    const result = screenToNaturalPolygon(points, 1, 1);
    expect(result).toEqual(points);
  });

  test("handles different x and y scales", () => {
    const points = [{ x: 100, y: 100 }];
    const result = screenToNaturalPolygon(points, 2, 3);
    expect(result).toEqual([{ x: 200, y: 300 }]);
  });

  test("returns empty array for empty input", () => {
    expect(screenToNaturalPolygon([], 2, 2)).toEqual([]);
  });

  test("returns empty array for null input", () => {
    expect(screenToNaturalPolygon(null, 2, 2)).toEqual([]);
  });
});

describe("naturalToScreenPolygon", () => {
  test("scales coordinates correctly", () => {
    const points = [
      { x: 200, y: 100 },
      { x: 400, y: 200 },
    ];
    const result = naturalToScreenPolygon(points, 2, 2);
    expect(result).toEqual([
      { x: 100, y: 50 },
      { x: 200, y: 100 },
    ]);
  });

  test("handles scale factor of 1", () => {
    const points = [
      { x: 100, y: 50 },
      { x: 200, y: 100 },
    ];
    const result = naturalToScreenPolygon(points, 1, 1);
    expect(result).toEqual(points);
  });

  test("returns empty array for empty input", () => {
    expect(naturalToScreenPolygon([], 2, 2)).toEqual([]);
  });

  test("returns empty array for null input", () => {
    expect(naturalToScreenPolygon(null, 2, 2)).toEqual([]);
  });
});

describe("flattenPolygon", () => {
  test("converts points to COCO format", () => {
    const points = [
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 100 },
    ];
    const result = flattenPolygon(points);
    expect(result).toEqual([100, 50, 200, 50, 200, 100]);
  });

  test("handles single point", () => {
    const points = [{ x: 100, y: 50 }];
    expect(flattenPolygon(points)).toEqual([100, 50]);
  });

  test("returns empty array for empty input", () => {
    expect(flattenPolygon([])).toEqual([]);
  });

  test("returns empty array for null input", () => {
    expect(flattenPolygon(null)).toEqual([]);
  });

  test("preserves decimal values", () => {
    const points = [{ x: 100.5, y: 50.7 }];
    expect(flattenPolygon(points)).toEqual([100.5, 50.7]);
  });
});

describe("unflattenPolygon", () => {
  test("converts COCO format to points", () => {
    const flat = [100, 50, 200, 50, 200, 100];
    const result = unflattenPolygon(flat);
    expect(result).toEqual([
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 100 },
    ]);
  });

  test("handles single point", () => {
    const flat = [100, 50];
    expect(unflattenPolygon(flat)).toEqual([{ x: 100, y: 50 }]);
  });

  test("returns empty array for empty input", () => {
    expect(unflattenPolygon([])).toEqual([]);
  });

  test("returns empty array for null input", () => {
    expect(unflattenPolygon(null)).toEqual([]);
  });

  test("handles odd-length array by ignoring last element", () => {
    const flat = [100, 50, 200]; // Odd length
    expect(unflattenPolygon(flat)).toEqual([{ x: 100, y: 50 }]);
  });

  test("roundtrip with flattenPolygon", () => {
    const original = [
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 100 },
    ];
    const flat = flattenPolygon(original);
    const restored = unflattenPolygon(flat);
    expect(restored).toEqual(original);
  });
});

describe("isPointInPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  test("returns true for point inside polygon", () => {
    expect(isPointInPolygon(50, 50, square)).toBe(true);
  });

  test("returns false for point outside polygon", () => {
    expect(isPointInPolygon(150, 50, square)).toBe(false);
  });

  test("returns true for point on edge", () => {
    expect(isPointInPolygon(50, 0, square)).toBe(true);
  });

  test("returns true for point on vertex", () => {
    expect(isPointInPolygon(0, 0, square)).toBe(true);
  });

  test("handles triangle", () => {
    const triangle = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(isPointInPolygon(50, 50, triangle)).toBe(true);
    expect(isPointInPolygon(10, 10, triangle)).toBe(false);
  });

  test("handles concave polygon", () => {
    // L-shaped polygon
    const lShape = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(isPointInPolygon(25, 25, lShape)).toBe(true);
    expect(isPointInPolygon(75, 25, lShape)).toBe(false);
    expect(isPointInPolygon(75, 75, lShape)).toBe(true);
  });

  test("returns false for empty polygon", () => {
    expect(isPointInPolygon(50, 50, [])).toBe(false);
  });

  test("returns false for null polygon", () => {
    expect(isPointInPolygon(50, 50, null)).toBe(false);
  });

  test("returns false for polygon with less than 3 points", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(isPointInPolygon(50, 50, line)).toBe(false);
  });
});

describe("calculatePolygonCentroid", () => {
  test("calculates centroid of square", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const centroid = calculatePolygonCentroid(square);
    expect(centroid.x).toBeCloseTo(50);
    expect(centroid.y).toBeCloseTo(50);
  });

  test("calculates centroid of triangle", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ];
    const centroid = calculatePolygonCentroid(triangle);
    expect(centroid.x).toBeCloseTo(50);
    expect(centroid.y).toBeCloseTo(33.33, 1);
  });

  test("returns null for empty polygon", () => {
    expect(calculatePolygonCentroid([])).toBeNull();
  });

  test("returns null for null polygon", () => {
    expect(calculatePolygonCentroid(null)).toBeNull();
  });

  test("returns point for single point polygon", () => {
    const point = [{ x: 50, y: 75 }];
    expect(calculatePolygonCentroid(point)).toEqual({ x: 50, y: 75 });
  });
});

describe("calculatePolygonArea", () => {
  test("calculates area of square", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(calculatePolygonArea(square)).toBe(10000);
  });

  test("calculates area of triangle", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ];
    expect(calculatePolygonArea(triangle)).toBe(5000);
  });

  test("handles clockwise winding", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
    ];
    expect(calculatePolygonArea(square)).toBe(10000);
  });

  test("returns 0 for empty polygon", () => {
    expect(calculatePolygonArea([])).toBe(0);
  });

  test("returns 0 for null polygon", () => {
    expect(calculatePolygonArea(null)).toBe(0);
  });

  test("returns 0 for line (2 points)", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(calculatePolygonArea(line)).toBe(0);
  });
});

describe("calculatePolygonBbox", () => {
  test("calculates bbox of square", () => {
    const square = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ];
    const bbox = calculatePolygonBbox(square);
    expect(bbox).toEqual([50, 50, 100, 100]); // [x, y, width, height]
  });

  test("calculates bbox of triangle", () => {
    const triangle = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const bbox = calculatePolygonBbox(triangle);
    expect(bbox).toEqual([0, 0, 100, 100]);
  });

  test("handles polygon at origin", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const bbox = calculatePolygonBbox(square);
    expect(bbox).toEqual([0, 0, 100, 100]);
  });

  test("returns null for empty polygon", () => {
    expect(calculatePolygonBbox([])).toBeNull();
  });

  test("returns null for null polygon", () => {
    expect(calculatePolygonBbox(null)).toBeNull();
  });

  test("handles single point", () => {
    const point = [{ x: 50, y: 75 }];
    const bbox = calculatePolygonBbox(point);
    expect(bbox).toEqual([50, 75, 0, 0]);
  });
});

describe("createMaskSegmentationResult", () => {
  test("creates result from single polygon", () => {
    const polygons = [[100, 50, 200, 50, 200, 150, 100, 150]]; // Flat COCO format
    const result = createMaskSegmentationResult(polygons);

    expect(result.segmentation).toEqual(polygons);
    expect(result.bbox).toEqual([100, 50, 100, 100]);
    expect(result.area).toBe(10000);
  });

  test("creates result from multiple polygons", () => {
    const polygons = [
      [0, 0, 100, 0, 100, 100, 0, 100], // 100x100 square
      [200, 200, 250, 200, 250, 250, 200, 250], // 50x50 square
    ];
    const result = createMaskSegmentationResult(polygons);

    expect(result.segmentation).toEqual(polygons);
    // bbox should encompass both polygons
    expect(result.bbox).toEqual([0, 0, 250, 250]);
    // area should sum both
    expect(result.area).toBe(10000 + 2500);
  });

  test("returns null for empty polygons", () => {
    expect(createMaskSegmentationResult([])).toBeNull();
  });

  test("returns null for null input", () => {
    expect(createMaskSegmentationResult(null)).toBeNull();
  });

  test("returns null for undefined input", () => {
    expect(createMaskSegmentationResult(undefined)).toBeNull();
  });

  test("filters out empty polygons", () => {
    const polygons = [[], [100, 50, 200, 50, 200, 150, 100, 150], []];
    const result = createMaskSegmentationResult(polygons);

    expect(result.segmentation.length).toBe(1);
    expect(result.segmentation[0]).toEqual([
      100, 50, 200, 50, 200, 150, 100, 150,
    ]);
  });
});
