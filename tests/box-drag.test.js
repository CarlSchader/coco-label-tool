/**
 * Tests for box dragging and manipulation
 * When dragging/resizing a box, it should REPLACE the original, not add a duplicate
 */

import {
  updateBoxInArray,
  findBoxIndexAtPoint,
} from "../static/js/utils/box-manipulation.js";

describe("Box drag behavior", () => {
  describe("updateBoxInArray", () => {
    test("replaces box at given index", () => {
      const boxes = [
        { x1: 10, y1: 10, x2: 50, y2: 50 },
        { x1: 100, y1: 100, x2: 200, y2: 200 },
      ];

      const newBox = { x1: 20, y1: 20, x2: 60, y2: 60 };
      const result = updateBoxInArray(boxes, 0, newBox);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(newBox);
      expect(result[1]).toEqual(boxes[1]); // Unchanged
    });

    test("returns new array (immutable)", () => {
      const boxes = [{ x1: 10, y1: 10, x2: 50, y2: 50 }];
      const newBox = { x1: 20, y1: 20, x2: 60, y2: 60 };

      const result = updateBoxInArray(boxes, 0, newBox);

      expect(result).not.toBe(boxes); // New array
      expect(boxes[0]).toEqual({ x1: 10, y1: 10, x2: 50, y2: 50 }); // Original unchanged
    });

    test("handles out of bounds index", () => {
      const boxes = [{ x1: 10, y1: 10, x2: 50, y2: 50 }];
      const newBox = { x1: 20, y1: 20, x2: 60, y2: 60 };

      expect(() => updateBoxInArray(boxes, 5, newBox)).toThrow();
    });

    test("handles negative index", () => {
      const boxes = [{ x1: 10, y1: 10, x2: 50, y2: 50 }];
      const newBox = { x1: 20, y1: 20, x2: 60, y2: 60 };

      expect(() => updateBoxInArray(boxes, -1, newBox)).toThrow();
    });

    test("handles empty array", () => {
      const newBox = { x1: 20, y1: 20, x2: 60, y2: 60 };

      expect(() => updateBoxInArray([], 0, newBox)).toThrow();
    });
  });

  describe("findBoxIndexAtPoint", () => {
    test("finds box containing point", () => {
      const boxes = [
        { x1: 10, y1: 10, x2: 50, y2: 50 },
        { x1: 100, y1: 100, x2: 200, y2: 200 },
      ];

      // Point inside first box
      const index = findBoxIndexAtPoint(boxes, 30, 30, 1, 1);
      expect(index).toBe(0);
    });

    test("finds second box", () => {
      const boxes = [
        { x1: 10, y1: 10, x2: 50, y2: 50 },
        { x1: 100, y1: 100, x2: 200, y2: 200 },
      ];

      // Point inside second box
      const index = findBoxIndexAtPoint(boxes, 150, 150, 1, 1);
      expect(index).toBe(1);
    });

    test("returns -1 when point outside all boxes", () => {
      const boxes = [
        { x1: 10, y1: 10, x2: 50, y2: 50 },
        { x1: 100, y1: 100, x2: 200, y2: 200 },
      ];

      const index = findBoxIndexAtPoint(boxes, 500, 500, 1, 1);
      expect(index).toBe(-1);
    });

    test("returns last matching box when overlapping", () => {
      const boxes = [
        { x1: 10, y1: 10, x2: 100, y2: 100 },
        { x1: 20, y1: 20, x2: 80, y2: 80 }, // Inside first box
      ];

      // Point at (50, 50) is in both boxes
      const index = findBoxIndexAtPoint(boxes, 50, 50, 1, 1);
      expect(index).toBe(1); // Returns last one (drawn on top)
    });

    test("handles empty array", () => {
      const index = findBoxIndexAtPoint([], 50, 50, 1, 1);
      expect(index).toBe(-1);
    });

    test("applies scale factors", () => {
      const boxes = [
        { x1: 100, y1: 100, x2: 200, y2: 200 }, // Natural coords
      ];

      // Point at (50, 50) in screen coords with 2x scale
      const index = findBoxIndexAtPoint(boxes, 50, 50, 2, 2);
      expect(index).toBe(0); // Should find it after scaling
    });
  });
});
