import {
  findAnnotationAtPoint,
  findAnnotationsInBox,
  getAnnotationBoundingBox,
  boxesOverlap,
} from '../../static/js/utils/annotations.js';

describe('findAnnotationAtPoint', () => {
  const mockAnnotations = [
    {
      id: 1,
      segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
    },
    {
      id: 2,
      segmentation: [[200, 200, 300, 200, 300, 300, 200, 300]],
    },
    {
      id: 3,
      segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]],
    },
  ];

  test('returns annotation ID when point is inside mask', () => {
    const result = findAnnotationAtPoint(50, 50, mockAnnotations, 1, 1);
    expect(result).toBe(3);
  });

  test('returns topmost annotation when multiple overlap', () => {
    const result = findAnnotationAtPoint(75, 75, mockAnnotations, 1, 1);
    expect(result).toBe(3);
  });

  test('returns null when point is outside all masks', () => {
    const result = findAnnotationAtPoint(500, 500, mockAnnotations, 1, 1);
    expect(result).toBeNull();
  });

  test('returns null for empty annotations array', () => {
    const result = findAnnotationAtPoint(50, 50, [], 1, 1);
    expect(result).toBeNull();
  });

  test('returns null for null annotations', () => {
    const result = findAnnotationAtPoint(50, 50, null, 1, 1);
    expect(result).toBeNull();
  });

  test('returns null for undefined annotations', () => {
    const result = findAnnotationAtPoint(50, 50, undefined, 1, 1);
    expect(result).toBeNull();
  });

  test('handles scaled coordinates correctly', () => {
    const scaledAnnotations = [
      {
        id: 1,
        segmentation: [[0, 0, 200, 0, 200, 200, 0, 200]],
      },
    ];
    const result = findAnnotationAtPoint(50, 50, scaledAnnotations, 2, 2);
    expect(result).toBe(1);
  });

  test('handles annotation with multiple polygons', () => {
    const multiPolygonAnnotation = [
      {
        id: 1,
        segmentation: [
          [0, 0, 50, 0, 50, 50, 0, 50],
          [100, 100, 150, 100, 150, 150, 100, 150],
        ],
      },
    ];

    const result1 = findAnnotationAtPoint(25, 25, multiPolygonAnnotation, 1, 1);
    expect(result1).toBe(1);

    const result2 = findAnnotationAtPoint(125, 125, multiPolygonAnnotation, 1, 1);
    expect(result2).toBe(1);

    const result3 = findAnnotationAtPoint(75, 75, multiPolygonAnnotation, 1, 1);
    expect(result3).toBeNull();
  });

  test('returns first matching annotation when checking from top', () => {
    const overlappingAnnotations = [
      {
        id: 1,
        segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
      },
      {
        id: 2,
        segmentation: [[25, 25, 75, 25, 75, 75, 25, 75]],
      },
    ];

    const result = findAnnotationAtPoint(50, 50, overlappingAnnotations, 1, 1);
    expect(result).toBe(2);
  });
});

describe('getAnnotationBoundingBox', () => {
  test('calculates correct bounding box for simple square', () => {
    const annotation = {
      segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
    };
    const result = getAnnotationBoundingBox(annotation, 1, 1);
    expect(result).toEqual({ x1: 0, y1: 0, x2: 100, y2: 100 });
  });

  test('calculates correct bounding box for irregular polygon', () => {
    const annotation = {
      segmentation: [[10, 20, 50, 10, 80, 40, 60, 70, 15, 60]],
    };
    const result = getAnnotationBoundingBox(annotation, 1, 1);
    expect(result).toEqual({ x1: 10, y1: 10, x2: 80, y2: 70 });
  });

  test('handles multiple polygons in segmentation', () => {
    const annotation = {
      segmentation: [
        [0, 0, 50, 0, 50, 50, 0, 50],
        [100, 100, 150, 100, 150, 150, 100, 150],
      ],
    };
    const result = getAnnotationBoundingBox(annotation, 1, 1);
    expect(result).toEqual({ x1: 0, y1: 0, x2: 150, y2: 150 });
  });

  test('applies scaling correctly', () => {
    const annotation = {
      segmentation: [[0, 0, 200, 0, 200, 200, 0, 200]],
    };
    const result = getAnnotationBoundingBox(annotation, 2, 2);
    expect(result).toEqual({ x1: 0, y1: 0, x2: 100, y2: 100 });
  });

  test('handles non-uniform scaling', () => {
    const annotation = {
      segmentation: [[0, 0, 200, 0, 200, 100, 0, 100]],
    };
    const result = getAnnotationBoundingBox(annotation, 2, 1);
    expect(result).toEqual({ x1: 0, y1: 0, x2: 100, y2: 100 });
  });

  test('handles null annotation', () => {
    const result = getAnnotationBoundingBox(null, 1, 1);
    expect(result).toBeNull();
  });

  test('handles annotation with empty segmentation', () => {
    const annotation = { segmentation: [] };
    const result = getAnnotationBoundingBox(annotation, 1, 1);
    expect(result).toBeNull();
  });
});

describe('boxesOverlap', () => {
  test('returns true when boxes overlap', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 50, y1: 50, x2: 150, y2: 150 };
    expect(boxesOverlap(box1, box2)).toBe(true);
  });

  test('returns false when boxes are disjoint', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 200, y1: 200, x2: 300, y2: 300 };
    expect(boxesOverlap(box1, box2)).toBe(false);
  });

  test('returns true when one box contains another', () => {
    const box1 = { x1: 0, y1: 0, x2: 200, y2: 200 };
    const box2 = { x1: 50, y1: 50, x2: 150, y2: 150 };
    expect(boxesOverlap(box1, box2)).toBe(true);
  });

  test('returns true when box2 contains box1', () => {
    const box1 = { x1: 50, y1: 50, x2: 150, y2: 150 };
    const box2 = { x1: 0, y1: 0, x2: 200, y2: 200 };
    expect(boxesOverlap(box1, box2)).toBe(true);
  });

  test('returns true when boxes touch at edge', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 100, y1: 0, x2: 200, y2: 100 };
    expect(boxesOverlap(box1, box2)).toBe(true);
  });

  test('returns true when boxes touch at corner', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 100, y1: 100, x2: 200, y2: 200 };
    expect(boxesOverlap(box1, box2)).toBe(true);
  });

  test('returns false when boxes are horizontally separated', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 150, y1: 0, x2: 250, y2: 100 };
    expect(boxesOverlap(box1, box2)).toBe(false);
  });

  test('returns false when boxes are vertically separated', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 0, y1: 150, x2: 100, y2: 250 };
    expect(boxesOverlap(box1, box2)).toBe(false);
  });

  test('handles null boxes', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(boxesOverlap(null, box1)).toBe(false);
    expect(boxesOverlap(box1, null)).toBe(false);
    expect(boxesOverlap(null, null)).toBe(false);
  });
});

describe('findAnnotationsInBox', () => {
  const mockAnnotations = [
    {
      id: 1,
      segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
    },
    {
      id: 2,
      segmentation: [[200, 200, 300, 200, 300, 300, 200, 300]],
    },
    {
      id: 3,
      segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]],
    },
  ];

  test('returns annotation fully inside box', () => {
    const box = { x1: 0, y1: 0, x2: 120, y2: 120 };
    const result = findAnnotationsInBox(box, mockAnnotations, 1, 1);
    expect(result).toContain(1);
  });

  test('returns all annotations overlapping box', () => {
    const box = { x1: 0, y1: 0, x2: 199, y2: 199 };
    const result = findAnnotationsInBox(box, mockAnnotations, 1, 1);
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result.length).toBe(2);
  });

  test('returns empty array when no annotations overlap', () => {
    const box = { x1: 400, y1: 400, x2: 500, y2: 500 };
    const result = findAnnotationsInBox(box, mockAnnotations, 1, 1);
    expect(result).toEqual([]);
  });

  test('returns annotation partially overlapping box', () => {
    const box = { x1: 75, y1: 75, x2: 125, y2: 125 };
    const result = findAnnotationsInBox(box, mockAnnotations, 1, 1);
    expect(result).toContain(3);
  });

  test('handles scaled coordinates correctly', () => {
    const scaledAnnotations = [
      {
        id: 1,
        segmentation: [[0, 0, 200, 0, 200, 200, 0, 200]],
      },
    ];
    const box = { x1: 0, y1: 0, x2: 150, y2: 150 };
    const result = findAnnotationsInBox(box, scaledAnnotations, 2, 2);
    expect(result).toContain(1);
  });

  test('returns multiple annotations when all overlap', () => {
    const overlappingAnnotations = [
      {
        id: 1,
        segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
      },
      {
        id: 2,
        segmentation: [[25, 25, 75, 25, 75, 75, 25, 75]],
      },
      {
        id: 3,
        segmentation: [[40, 40, 60, 40, 60, 60, 40, 60]],
      },
    ];
    const box = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const result = findAnnotationsInBox(box, overlappingAnnotations, 1, 1);
    expect(result).toHaveLength(3);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
  });

  test('selects all overlapping annotations when box partially covers both', () => {
    // Two annotations that overlap each other
    const overlappingPair = [
      {
        id: 1,
        segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]], // Left square
      },
      {
        id: 2,
        segmentation: [[50, 50, 150, 50, 150, 150, 50, 150]], // Overlapping square
      },
    ];

    // Selection box that covers the overlap region
    const box = { x1: 40, y1: 40, x2: 110, y2: 110 };
    const result = findAnnotationsInBox(box, overlappingPair, 1, 1);

    // BOTH annotations should be selected, not just one
    expect(result).toHaveLength(2);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  test('selects all annotations when box covers only overlap region', () => {
    // Three annotations that all overlap in the center
    const centerOverlap = [
      {
        id: 1,
        segmentation: [[0, 40, 100, 40, 100, 60, 0, 60]], // Horizontal bar
      },
      {
        id: 2,
        segmentation: [[40, 0, 60, 0, 60, 100, 40, 100]], // Vertical bar
      },
      {
        id: 3,
        segmentation: [[30, 30, 70, 30, 70, 70, 30, 70]], // Center square
      },
    ];

    // Small box that only covers the center overlap region
    const box = { x1: 45, y1: 45, x2: 55, y2: 55 };
    const result = findAnnotationsInBox(box, centerOverlap, 1, 1);

    // ALL THREE should be selected even though box is small
    expect(result).toHaveLength(3);
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
  });

  test('handles null box', () => {
    const result = findAnnotationsInBox(null, mockAnnotations, 1, 1);
    expect(result).toEqual([]);
  });

  test('handles null annotations', () => {
    const box = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const result = findAnnotationsInBox(box, null, 1, 1);
    expect(result).toEqual([]);
  });

  test('handles empty annotations array', () => {
    const box = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const result = findAnnotationsInBox(box, [], 1, 1);
    expect(result).toEqual([]);
  });

  test('handles annotation with multiple polygons', () => {
    const multiPolygonAnnotations = [
      {
        id: 1,
        segmentation: [
          [0, 0, 50, 0, 50, 50, 0, 50],
          [100, 100, 150, 100, 150, 150, 100, 150],
        ],
      },
    ];
    const box = { x1: 0, y1: 0, x2: 60, y2: 60 };
    const result = findAnnotationsInBox(box, multiPolygonAnnotations, 1, 1);
    expect(result).toContain(1);
  });

  test('returns annotations with any bounding box overlap', () => {
    const box = { x1: 90, y1: 90, x2: 110, y2: 110 };
    const result = findAnnotationsInBox(box, mockAnnotations, 1, 1);
    expect(result).toContain(1);
    expect(result).toContain(3);
  });
});
