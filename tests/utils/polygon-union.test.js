/**
 * Tests for polygon union utilities
 */

import {
  polygonsBoundingBoxesOverlap,
  getPolygonBoundingBox,
  doPolygonsOverlap,
  unionOverlappingPolygons,
} from "../../coco_label_tool/static/js/utils/polygon-union.js";

describe("getPolygonBoundingBox", () => {
  test("calculates bounding box for simple square", () => {
    const polygon = [0, 0, 100, 0, 100, 100, 0, 100];
    const bbox = getPolygonBoundingBox(polygon);
    expect(bbox).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });

  test("calculates bounding box for irregular polygon", () => {
    const polygon = [10, 20, 50, 5, 80, 30, 60, 70, 15, 60];
    const bbox = getPolygonBoundingBox(polygon);
    expect(bbox).toEqual({ minX: 10, minY: 5, maxX: 80, maxY: 70 });
  });

  test("returns null for empty polygon", () => {
    expect(getPolygonBoundingBox([])).toBeNull();
  });

  test("returns null for null", () => {
    expect(getPolygonBoundingBox(null)).toBeNull();
  });

  test("returns null for polygon with less than 3 points", () => {
    expect(getPolygonBoundingBox([0, 0, 10, 10])).toBeNull();
  });
});

describe("polygonsBoundingBoxesOverlap", () => {
  test("returns true for overlapping squares", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    const poly2 = [50, 50, 150, 50, 150, 150, 50, 150];
    expect(polygonsBoundingBoxesOverlap(poly1, poly2)).toBe(true);
  });

  test("returns false for non-overlapping squares", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    const poly2 = [200, 200, 300, 200, 300, 300, 200, 300];
    expect(polygonsBoundingBoxesOverlap(poly1, poly2)).toBe(false);
  });

  test("returns true for touching squares", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    const poly2 = [100, 0, 200, 0, 200, 100, 100, 100];
    expect(polygonsBoundingBoxesOverlap(poly1, poly2)).toBe(true);
  });

  test("returns true for one inside another", () => {
    const poly1 = [0, 0, 200, 0, 200, 200, 0, 200];
    const poly2 = [50, 50, 100, 50, 100, 100, 50, 100];
    expect(polygonsBoundingBoxesOverlap(poly1, poly2)).toBe(true);
  });

  test("returns false for null polygons", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    expect(polygonsBoundingBoxesOverlap(null, poly1)).toBe(false);
    expect(polygonsBoundingBoxesOverlap(poly1, null)).toBe(false);
  });
});

describe("doPolygonsOverlap", () => {
  test("returns true for overlapping squares", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    const poly2 = [50, 50, 150, 50, 150, 150, 50, 150];
    expect(doPolygonsOverlap(poly1, poly2)).toBe(true);
  });

  test("returns false for non-overlapping squares", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    const poly2 = [200, 200, 300, 200, 300, 300, 200, 300];
    expect(doPolygonsOverlap(poly1, poly2)).toBe(false);
  });

  test("returns true for one polygon inside another", () => {
    const poly1 = [0, 0, 200, 0, 200, 200, 0, 200];
    const poly2 = [50, 50, 100, 50, 100, 100, 50, 100];
    expect(doPolygonsOverlap(poly1, poly2)).toBe(true);
  });

  test("returns false for clearly separated squares", () => {
    // Two squares with a gap between them
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    const poly2 = [110, 0, 210, 0, 210, 100, 110, 100]; // Gap of 10 units
    expect(doPolygonsOverlap(poly1, poly2)).toBe(false);
  });

  test("returns false for null polygons", () => {
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100];
    expect(doPolygonsOverlap(null, poly1)).toBe(false);
    expect(doPolygonsOverlap(poly1, null)).toBe(false);
  });
});

describe("unionOverlappingPolygons", () => {
  test("returns same polygons when none overlap", () => {
    const polygons = [
      [0, 0, 50, 0, 50, 50, 0, 50], // Square at origin
      [200, 200, 250, 200, 250, 250, 200, 250], // Square far away
    ];

    const result = unionOverlappingPolygons(polygons);

    // Should keep both polygons separate
    expect(result).toHaveLength(2);
  });

  test("merges two overlapping squares into one polygon", () => {
    const polygons = [
      [0, 0, 100, 0, 100, 100, 0, 100], // First square
      [50, 50, 150, 50, 150, 150, 50, 150], // Overlapping square
    ];

    const result = unionOverlappingPolygons(polygons);

    // Should merge into a single polygon
    expect(result).toHaveLength(1);
    // The merged polygon should have more area than either original
    expect(result[0].length).toBeGreaterThanOrEqual(6); // At least 3 points
  });

  test("merges three overlapping polygons", () => {
    const polygons = [
      [0, 0, 100, 0, 100, 100, 0, 100],
      [50, 50, 150, 50, 150, 150, 50, 150],
      [100, 100, 200, 100, 200, 200, 100, 200],
    ];

    const result = unionOverlappingPolygons(polygons);

    // All three overlap transitively, should become one polygon
    expect(result).toHaveLength(1);
  });

  test("keeps non-overlapping polygon separate while merging overlapping ones", () => {
    const polygons = [
      [0, 0, 100, 0, 100, 100, 0, 100], // Overlaps with second
      [50, 50, 150, 50, 150, 150, 50, 150], // Overlaps with first
      [500, 500, 550, 500, 550, 550, 500, 550], // Far away, no overlap
    ];

    const result = unionOverlappingPolygons(polygons);

    // Should have 2 polygons: one merged from first two, one separate
    expect(result).toHaveLength(2);
  });

  test("handles single polygon", () => {
    const polygons = [[0, 0, 100, 0, 100, 100, 0, 100]];

    const result = unionOverlappingPolygons(polygons);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(polygons[0]);
  });

  test("handles empty array", () => {
    const result = unionOverlappingPolygons([]);
    expect(result).toEqual([]);
  });

  test("handles null input", () => {
    const result = unionOverlappingPolygons(null);
    expect(result).toEqual([]);
  });

  test("handles polygon completely inside another", () => {
    const polygons = [
      [0, 0, 200, 0, 200, 200, 0, 200], // Large square
      [50, 50, 100, 50, 100, 100, 50, 100], // Small square inside
    ];

    const result = unionOverlappingPolygons(polygons);

    // Inner polygon is contained, result should be single polygon
    // (the outer one, since union of contained shape is just the outer)
    expect(result).toHaveLength(1);
  });

  test("merged polygon covers the combined area", () => {
    // Two squares with known overlap
    const poly1 = [0, 0, 100, 0, 100, 100, 0, 100]; // 100x100 = 10000
    const poly2 = [50, 0, 150, 0, 150, 100, 50, 100]; // 100x100 = 10000, overlap is 50x100 = 5000

    const result = unionOverlappingPolygons([poly1, poly2]);

    expect(result).toHaveLength(1);

    // The merged result should have bbox approximately from 0,0 to 150,100
    // Allow small rasterization tolerance (up to 2 units due to grid quantization)
    const bbox = getPolygonBoundingBox(result[0]);
    expect(bbox.minX).toBeGreaterThanOrEqual(-2);
    expect(bbox.minX).toBeLessThanOrEqual(2);
    expect(bbox.minY).toBeGreaterThanOrEqual(-2);
    expect(bbox.minY).toBeLessThanOrEqual(2);
    expect(bbox.maxX).toBeGreaterThanOrEqual(148);
    expect(bbox.maxX).toBeLessThanOrEqual(152);
    expect(bbox.maxY).toBeGreaterThanOrEqual(98);
    expect(bbox.maxY).toBeLessThanOrEqual(102);
  });
});
