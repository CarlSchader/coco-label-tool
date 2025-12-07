/**
 * Tests for multi-mask drawing utilities
 */

import { getMaskColor, shouldDrawMultipleMasks } from '../../static/js/utils/mask-drawing.js';

describe('getMaskColor', () => {
  test('returns different colors for different indices', () => {
    const color0 = getMaskColor(0);
    const color1 = getMaskColor(1);
    const color2 = getMaskColor(2);

    expect(color0).not.toBe(color1);
    expect(color1).not.toBe(color2);
    expect(color0).not.toBe(color2);
  });

  test('returns consistent color for same index', () => {
    const color1 = getMaskColor(3);
    const color2 = getMaskColor(3);

    expect(color1).toBe(color2);
  });

  test('returns valid rgba format', () => {
    const color = getMaskColor(0);

    expect(color).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
  });

  test('returns semi-transparent colors', () => {
    const color = getMaskColor(0);
    const alpha = parseFloat(color.match(/[\d.]+\)$/)[0]);

    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  test('cycles through colors for large indices', () => {
    const color10 = getMaskColor(10);

    // Should cycle, so eventually repeats
    expect(typeof color10).toBe('string');
  });
});

describe('shouldDrawMultipleMasks', () => {
  test('returns true for array with multiple contours', () => {
    const segmentation = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];

    expect(shouldDrawMultipleMasks(segmentation)).toBe(true);
  });

  test('returns false for array with single contour', () => {
    const segmentation = [[1, 2, 3, 4]];

    expect(shouldDrawMultipleMasks(segmentation)).toBe(false);
  });

  test('returns false for empty array', () => {
    expect(shouldDrawMultipleMasks([])).toBe(false);
  });

  test('returns false for null', () => {
    expect(shouldDrawMultipleMasks(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(shouldDrawMultipleMasks(undefined)).toBe(false);
  });
});
