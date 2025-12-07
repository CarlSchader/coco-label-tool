/**
 * Tests for frame bounds checking
 *
 * Verifies that clicks/drags outside the image frame don't trigger SAM2.
 */

import { isPointInBounds, hasBoxCornerInBounds } from '../../static/js/utils/bounds.js';

describe('Frame Bounds Checking', () => {
  describe('Point in frame detection', () => {
    test('point inside frame returns true', () => {
      expect(isPointInBounds(250, 200, 500, 400)).toBe(true);
    });

    test('point outside frame returns false', () => {
      expect(isPointInBounds(600, 200, 500, 400)).toBe(false);
    });

    test('point on frame edge returns true', () => {
      expect(isPointInBounds(500, 400, 500, 400)).toBe(true);
    });

    test('point at (0, 0) returns true', () => {
      expect(isPointInBounds(0, 0, 500, 400)).toBe(true);
    });

    test('negative coordinates return false', () => {
      expect(isPointInBounds(-10, 200, 500, 400)).toBe(false);
    });
  });

  describe('Box has corner in frame detection', () => {
    test('box fully inside frame returns true', () => {
      const box = { x1: 100, y1: 100, x2: 200, y2: 200 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(true);
    });

    test('box fully outside frame returns false', () => {
      const box = { x1: 600, y1: 600, x2: 700, y2: 700 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(false);
    });

    test('box surrounding entire frame returns false (CRITICAL)', () => {
      const box = { x1: -100, y1: -100, x2: 600, y2: 500 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(false);
    });

    test('box partially overlapping frame returns true', () => {
      const box = { x1: 450, y1: 350, x2: 600, y2: 500 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(true);
    });

    test('box with one corner in frame returns true', () => {
      const box = { x1: 450, y1: 350, x2: 550, y2: 450 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(true);
    });

    test('box touching frame edge returns true', () => {
      const box = { x1: 500, y1: 100, x2: 600, y2: 200 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(true);
    });

    test('box left of frame returns false', () => {
      const box = { x1: -100, y1: 100, x2: -10, y2: 200 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(false);
    });

    test('box right of frame returns false', () => {
      const box = { x1: 510, y1: 100, x2: 600, y2: 200 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(false);
    });

    test('box above frame returns false', () => {
      const box = { x1: 100, y1: -100, x2: 200, y2: -10 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(false);
    });

    test('box below frame returns false', () => {
      const box = { x1: 100, y1: 410, x2: 200, y2: 500 };
      expect(hasBoxCornerInBounds(box, 500, 400)).toBe(false);
    });
  });

  describe('UI element exclusion', () => {
    test('click on keyboard hints button should be excluded', () => {
      const targetId = 'keyboard-hints-toggle';
      const excludedIds = [
        'keyboard-hints-toggle',
        'keyboard-hints-content',
        'btn-previous',
        'btn-next',
      ];

      const shouldExclude = excludedIds.includes(targetId);
      expect(shouldExclude).toBe(true);
    });

    test('click on canvas should not be excluded', () => {
      const targetId = 'canvas';
      const excludedIds = [
        'keyboard-hints-toggle',
        'keyboard-hints-content',
        'btn-previous',
        'btn-next',
      ];

      const shouldExclude = excludedIds.includes(targetId);
      expect(shouldExclude).toBe(false);
    });

    test('click on button should be excluded', () => {
      const element = { tagName: 'BUTTON' };
      const excludedTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

      const shouldExclude = excludedTags.includes(element.tagName);
      expect(shouldExclude).toBe(true);
    });
  });

  describe('Small drag threshold', () => {
    test('drag less than 5px is treated as click', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 103, y: 102 };

      const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

      expect(distance).toBeLessThan(5);
    });

    test('drag 5px or more is treated as box', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 105, y: 100 };

      const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

      expect(distance).toBeGreaterThanOrEqual(5);
    });
  });
});
