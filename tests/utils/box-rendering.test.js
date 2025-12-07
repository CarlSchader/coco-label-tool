import { calculateDragBox, clampBoxToCanvas } from '../../static/js/utils/box.js';

describe('calculateDragBox', () => {
  test('allows box to extend beyond canvas bounds', () => {
    const startX = 100;
    const startY = 100;
    const currentX = -50; // Outside canvas
    const currentY = -50;

    const result = calculateDragBox(startX, startY, currentX, currentY);

    expect(result.x1).toBe(-50);
    expect(result.y1).toBe(-50);
    expect(result.x2).toBe(100);
    expect(result.y2).toBe(100);
  });

  test('allows box to extend beyond right and bottom', () => {
    const startX = 100;
    const startY = 100;
    const currentX = 2000; // Way outside
    const currentY = 2000;

    const result = calculateDragBox(startX, startY, currentX, currentY);

    expect(result.x1).toBe(100);
    expect(result.y1).toBe(100);
    expect(result.x2).toBe(2000);
    expect(result.y2).toBe(2000);
  });

  test('handles negative start coordinates', () => {
    const startX = -50;
    const startY = -50;
    const currentX = 100;
    const currentY = 100;

    const result = calculateDragBox(startX, startY, currentX, currentY);

    expect(result.x1).toBe(-50);
    expect(result.y1).toBe(-50);
    expect(result.x2).toBe(100);
    expect(result.y2).toBe(100);
  });

  test('normalizes coordinates when dragging backwards', () => {
    const startX = 200;
    const startY = 200;
    const currentX = 50;
    const currentY = 50;

    const result = calculateDragBox(startX, startY, currentX, currentY);

    expect(result.x1).toBe(50);
    expect(result.y1).toBe(50);
    expect(result.x2).toBe(200);
    expect(result.y2).toBe(200);
  });
});

describe('clampBoxToCanvas', () => {
  const canvasWidth = 800;
  const canvasHeight = 600;

  test('returns box unchanged when fully inside canvas', () => {
    const box = { x1: 100, y1: 100, x2: 300, y2: 200 };
    const result = clampBoxToCanvas(box, canvasWidth, canvasHeight);

    expect(result).toEqual(box);
  });

  test('clamps box extending beyond left edge', () => {
    const box = { x1: -50, y1: 100, x2: 200, y2: 200 };
    const result = clampBoxToCanvas(box, canvasWidth, canvasHeight);

    expect(result.x1).toBe(0);
    expect(result.y1).toBe(100);
    expect(result.x2).toBe(200);
    expect(result.y2).toBe(200);
  });

  test('clamps box extending beyond right edge', () => {
    const box = { x1: 100, y1: 100, x2: 1000, y2: 200 };
    const result = clampBoxToCanvas(box, canvasWidth, canvasHeight);

    expect(result.x1).toBe(100);
    expect(result.y1).toBe(100);
    expect(result.x2).toBe(800);
    expect(result.y2).toBe(200);
  });

  test('clamps box extending beyond top edge', () => {
    const box = { x1: 100, y1: -50, x2: 200, y2: 200 };
    const result = clampBoxToCanvas(box, canvasWidth, canvasHeight);

    expect(result.x1).toBe(100);
    expect(result.y1).toBe(0);
    expect(result.x2).toBe(200);
    expect(result.y2).toBe(200);
  });

  test('clamps box extending beyond bottom edge', () => {
    const box = { x1: 100, y1: 100, x2: 200, y2: 800 };
    const result = clampBoxToCanvas(box, canvasWidth, canvasHeight);

    expect(result.x1).toBe(100);
    expect(result.y1).toBe(100);
    expect(result.x2).toBe(200);
    expect(result.y2).toBe(600);
  });

  test('clamps box extending beyond all edges', () => {
    const box = { x1: -100, y1: -100, x2: 1000, y2: 800 };
    const result = clampBoxToCanvas(box, canvasWidth, canvasHeight);

    expect(result.x1).toBe(0);
    expect(result.y1).toBe(0);
    expect(result.x2).toBe(800);
    expect(result.y2).toBe(600);
  });

  test('handles null box', () => {
    const result = clampBoxToCanvas(null, canvasWidth, canvasHeight);
    expect(result).toBeNull();
  });

  test('handles undefined box', () => {
    const result = clampBoxToCanvas(undefined, canvasWidth, canvasHeight);
    expect(result).toBeNull();
  });
});
