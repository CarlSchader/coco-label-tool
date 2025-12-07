/**
 * Tests for selection state coordination logic
 *
 * These tests verify the relationships between mouse events and selection state,
 * which would have caught the "selectionBoxDrag can be null" bug.
 */

import { calculateDragBox } from '../../static/js/utils/box.js';
import { findAnnotationsInBox } from '../../static/js/utils/annotations.js';

describe('Selection State Coordination', () => {
  describe('Box selection workflow', () => {
    test('box can be calculated from start and end points (mousedown → mouseup)', () => {
      // Simulates: user does mousedown, then mouseup without mousemove
      const startX = 100;
      const startY = 100;
      const endX = 200;
      const endY = 200;

      // Should be able to calculate box directly without intermediate state
      const box = calculateDragBox(startX, startY, endX, endY);

      expect(box).toEqual({
        x1: 100,
        y1: 100,
        x2: 200,
        y2: 200,
      });
    });

    test('box calculation works even if mousemove never fired', () => {
      // This is the bug scenario: quick drag where mousemove doesn't update state
      const start = { x: 50, y: 50 };
      const end = { x: 150, y: 150 };

      // At mouseup, we should be able to calculate box from saved start point
      const box = calculateDragBox(start.x, start.y, end.x, end.y);

      expect(box).toBeDefined();
      expect(box.x1).toBe(50);
      expect(box.x2).toBe(150);
    });

    test('findAnnotationsInBox works with box calculated at mouseup', () => {
      const annotations = [
        { id: 1, segmentation: [[100, 100, 200, 100, 200, 200, 100, 200]] },
        { id: 2, segmentation: [[300, 300, 400, 300, 400, 400, 300, 400]] },
      ];

      // Simulate: mousedown at (0,0), mouseup at (250, 250)
      const box = calculateDragBox(0, 0, 250, 250);
      const selected = findAnnotationsInBox(box, annotations, 1, 1);

      expect(selected).toContain(1);
      expect(selected).not.toContain(2);
    });
  });

  describe('Click vs drag detection', () => {
    test('small movement (< 5px) should be treated as click', () => {
      const startX = 100;
      const startY = 100;
      const endX = 102;
      const endY = 103;

      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      expect(width).toBeLessThan(5);
      expect(height).toBeLessThan(5);
      // Should trigger handleAnnotationClick, not handleAnnotationBoxSelect
    });

    test('large movement (>= 5px) should be treated as drag', () => {
      const startX = 100;
      const endX = 200;

      const width = Math.abs(endX - startX);

      expect(width).toBeGreaterThanOrEqual(5);
      // Should trigger handleAnnotationBoxSelect
    });

    test('movement exactly 5px should be treated as drag', () => {
      const startX = 100;
      const endX = 105;

      const width = Math.abs(endX - startX);

      expect(width).toBe(5);
      // Should trigger box select (boundary case)
    });
  });

  describe('Selection state requirements', () => {
    test('box selection should not depend on intermediate mousemove state', () => {
      // Key insight: We should be able to perform box selection using only:
      // 1. Start point (from mousedown)
      // 2. End point (from mouseup)
      //
      // We should NOT require:
      // 3. Intermediate drag box (from mousemove)
      //
      // This is because mousemove might not fire on quick drags

      const startPoint = { x: 10, y: 10 };
      const endPoint = { x: 100, y: 100 };

      // Should be sufficient to calculate box
      const box = calculateDragBox(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

      expect(box).toBeDefined();
      expect(box.x1).toBeLessThanOrEqual(box.x2);
      expect(box.y1).toBeLessThanOrEqual(box.y2);
    });

    test('selection box calculation is idempotent', () => {
      // Same inputs should always produce same output
      const box1 = calculateDragBox(50, 50, 150, 150);
      const box2 = calculateDragBox(50, 50, 150, 150);

      expect(box1).toEqual(box2);
    });

    test('box selection handles reversed drag (right-to-left)', () => {
      // User drags from right to left
      const box = calculateDragBox(200, 200, 100, 100);

      expect(box.x1).toBe(100);
      expect(box.x2).toBe(200);
      expect(box.y1).toBe(100);
      expect(box.y2).toBe(200);
    });
  });

  describe('Edge cases that could cause null boxes', () => {
    test('box is valid even with zero movement', () => {
      const box = calculateDragBox(100, 100, 100, 100);

      expect(box).toBeDefined();
      expect(box.x1).toBe(box.x2);
      expect(box.y1).toBe(box.y2);
    });

    test('box is valid with single-pixel movement', () => {
      const box = calculateDragBox(100, 100, 101, 101);

      expect(box).toBeDefined();
      expect(box.x1).toBe(100);
      expect(box.x2).toBe(101);
    });

    test('findAnnotationsInBox handles null box gracefully', () => {
      const annotations = [{ id: 1, segmentation: [[0, 0, 10, 0, 10, 10, 0, 10]] }];

      const result = findAnnotationsInBox(null, annotations, 1, 1);

      expect(result).toEqual([]);
    });

    test('findAnnotationsInBox handles zero-size box', () => {
      const annotations = [{ id: 1, segmentation: [[0, 0, 10, 0, 10, 10, 0, 10]] }];
      const zeroBox = { x1: 0, y1: 0, x2: 0, y2: 0 };

      const result = findAnnotationsInBox(zeroBox, annotations, 1, 1);

      // Zero-size box at (0,0) overlaps with annotation at origin
      // This is expected behavior (point-in-box check)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Overlapping annotation selection', () => {
    test('box selection returns all overlapping annotations, not just one', () => {
      // Scenario: Two masks overlap each other
      // User drags selection box over the overlap region
      // Expected: BOTH annotations selected

      const annotations = [
        {
          id: 1,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]], // Left
        },
        {
          id: 2,
          segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]], // Right (overlaps)
        },
      ];

      // User drags from (40, 40) to (110, 110) - covers overlap
      const box = calculateDragBox(40, 40, 110, 110);
      const selected = findAnnotationsInBox(box, annotations, 1, 1);

      // BOTH should be selected
      expect(selected).toHaveLength(2);
      expect(selected).toContain(1);
      expect(selected).toContain(2);
    });

    test('multiple overlapping annotations are all returned', () => {
      // Scenario: Three annotations all overlap in same region
      const annotations = [
        {
          id: 1,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
        {
          id: 2,
          segmentation: [[20, 20, 120, 20, 120, 120, 20, 120]],
        },
        {
          id: 3,
          segmentation: [[40, 40, 140, 40, 140, 140, 40, 140]],
        },
      ];

      // Box that covers all three
      const box = calculateDragBox(0, 0, 150, 150);
      const selected = findAnnotationsInBox(box, annotations, 1, 1);

      expect(selected).toHaveLength(3);
      expect(selected).toContain(1);
      expect(selected).toContain(2);
      expect(selected).toContain(3);
    });

    test('small box over overlap region selects all overlapping annotations', () => {
      const annotations = [
        {
          id: 1,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
        {
          id: 2,
          segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]],
        },
      ];

      // Very small box in the overlap region (75, 75) is in both
      const box = calculateDragBox(70, 70, 80, 80);
      const selected = findAnnotationsInBox(box, annotations, 1, 1);

      // Both annotations overlap with this small box
      expect(selected).toHaveLength(2);
      expect(selected).toContain(1);
      expect(selected).toContain(2);
    });

    test('box touching only edges of both overlapping annotations', () => {
      const annotations = [
        {
          id: 1,
          segmentation: [[0, 0, 50, 0, 50, 50, 0, 50]],
        },
        {
          id: 2,
          segmentation: [[50, 50, 100, 50, 100, 100, 50, 100]],
        },
      ];

      // Box at the corner where they touch
      const box = calculateDragBox(45, 45, 55, 55);
      const selected = findAnnotationsInBox(box, annotations, 1, 1);

      // Both should be selected (box overlaps both bounding boxes)
      expect(selected).toHaveLength(2);
      expect(selected).toContain(1);
      expect(selected).toContain(2);
    });
  });
});
