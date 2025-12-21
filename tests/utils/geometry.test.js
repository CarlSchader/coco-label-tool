import {
  isPolygonInsidePolygon,
  isPointInPolygon,
} from "../../coco_label_tool/static/js/utils/geometry.js";

describe("isPointInPolygon", () => {
  const squarePolygon = [0, 0, 100, 0, 100, 100, 0, 100];

  test("returns true for point inside square", () => {
    expect(isPointInPolygon(50, 50, squarePolygon)).toBe(true);
  });

  test("returns false for point outside square", () => {
    expect(isPointInPolygon(150, 150, squarePolygon)).toBe(false);
  });

  test("handles point on edge", () => {
    const result = isPointInPolygon(0, 50, squarePolygon);
    expect(typeof result).toBe("boolean");
  });

  test("handles point at corner", () => {
    const result = isPointInPolygon(0, 0, squarePolygon);
    expect(typeof result).toBe("boolean");
  });

  test("handles complex polygon", () => {
    const triangle = [0, 0, 100, 0, 50, 100];
    expect(isPointInPolygon(50, 30, triangle)).toBe(true);
    expect(isPointInPolygon(10, 90, triangle)).toBe(false);
  });

  test("handles polygon with many vertices", () => {
    const octagon = [
      50, 0, 100, 20, 120, 70, 100, 120, 50, 140, 0, 120, -20, 70, 0, 20,
    ];
    expect(isPointInPolygon(50, 70, octagon)).toBe(true);
    expect(isPointInPolygon(-50, 70, octagon)).toBe(false);
  });
});

describe("isPolygonInsidePolygon", () => {
  test("returns false for null/undefined polygons", () => {
    const polygon = [[0, 0, 100, 0, 100, 100, 0, 100]];
    expect(isPolygonInsidePolygon(null, polygon)).toBe(false);
    expect(isPolygonInsidePolygon(polygon, null)).toBe(false);
    expect(isPolygonInsidePolygon(undefined, polygon)).toBe(false);
    expect(isPolygonInsidePolygon(polygon, undefined)).toBe(false);
  });

  test("returns false for empty arrays", () => {
    const polygon = [[0, 0, 100, 0, 100, 100, 0, 100]];
    expect(isPolygonInsidePolygon([], polygon)).toBe(false);
    expect(isPolygonInsidePolygon(polygon, [])).toBe(false);
  });

  test("returns false for polygons with too few points", () => {
    const validPolygon = [[0, 0, 100, 0, 100, 100, 0, 100]];
    const invalidPolygon = [[0, 0, 100, 0]];
    expect(isPolygonInsidePolygon(invalidPolygon, validPolygon)).toBe(false);
    expect(isPolygonInsidePolygon(validPolygon, invalidPolygon)).toBe(false);
  });

  test("returns true when small square is inside large square", () => {
    const outerSquare = [[0, 0, 200, 0, 200, 200, 0, 200]];
    const innerSquare = [[50, 50, 150, 50, 150, 150, 50, 150]];

    expect(isPolygonInsidePolygon(innerSquare, outerSquare)).toBe(true);
  });

  test("returns false when polygons are disjoint", () => {
    const square1 = [[0, 0, 100, 0, 100, 100, 0, 100]];
    const square2 = [[200, 200, 300, 200, 300, 300, 200, 300]];

    expect(isPolygonInsidePolygon(square1, square2)).toBe(false);
  });

  test("returns false when polygons only partially overlap", () => {
    const square1 = [[0, 0, 100, 0, 100, 100, 0, 100]];
    const square2 = [[50, 50, 150, 50, 150, 150, 50, 150]];

    expect(isPolygonInsidePolygon(square1, square2)).toBe(false);
    expect(isPolygonInsidePolygon(square2, square1)).toBe(false);
  });

  test("respects 80% threshold for containment", () => {
    const outerSquare = [[0, 0, 100, 0, 100, 100, 0, 100]];
    const innerSquareWith4Points = [[25, 25, 75, 25, 75, 75, 25, 75]];

    expect(isPolygonInsidePolygon(innerSquareWith4Points, outerSquare)).toBe(
      true,
    );
  });

  test("returns false when less than 80% of points are inside", () => {
    const outerSquare = [[0, 0, 100, 0, 100, 100, 0, 100]];
    const partiallyInsideSquare = [[50, 50, 150, 50, 150, 150, 50, 150]];

    expect(isPolygonInsidePolygon(partiallyInsideSquare, outerSquare)).toBe(
      false,
    );
  });

  test("handles triangle inside square", () => {
    const square = [[0, 0, 100, 0, 100, 100, 0, 100]];
    const triangle = [[25, 25, 75, 25, 50, 75]];

    expect(isPolygonInsidePolygon(triangle, square)).toBe(true);
  });

  test("handles complex polygon shapes", () => {
    const largeOctagon = [
      [50, 0, 150, 0, 200, 50, 200, 150, 150, 200, 50, 200, 0, 150, 0, 50],
    ];
    const smallSquare = [[80, 80, 120, 80, 120, 120, 80, 120]];

    expect(isPolygonInsidePolygon(smallSquare, largeOctagon)).toBe(true);
  });

  test("returns false when outer polygon is inside inner polygon", () => {
    const smallSquare = [[50, 50, 150, 50, 150, 150, 50, 150]];
    const largeSquare = [[0, 0, 200, 0, 200, 200, 0, 200]];

    expect(isPolygonInsidePolygon(largeSquare, smallSquare)).toBe(false);
  });
});
