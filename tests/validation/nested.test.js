import { checkNestedMaskSupercategoryMismatch } from '../../static/js/validation/nested.js';

describe('checkNestedMaskSupercategoryMismatch', () => {
  const mockCategories = [
    { id: 1, name: 'dog', supercategory: 'animal' },
    { id: 2, name: 'cat', supercategory: 'animal' },
    { id: 3, name: 'car', supercategory: 'vehicle' },
    { id: 4, name: 'wheel', supercategory: 'part' },
  ];

  test('returns null when currentImage is null', () => {
    const annotations = {};
    const result = checkNestedMaskSupercategoryMismatch(null, annotations, mockCategories);
    expect(result).toBeNull();
  });

  test('returns null when no annotations exist for image', () => {
    const currentImage = { id: 1 };
    const annotations = {};
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);
    expect(result).toBeNull();
  });

  test('returns null when only one annotation exists', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 1,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);
    expect(result).toBeNull();
  });

  test('returns null when annotations have same supercategory', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 1,
          segmentation: [[25, 25, 75, 25, 75, 75, 25, 75]],
        },
        {
          id: 102,
          category_id: 2,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);
    expect(result).toBeNull();
  });

  test('returns null when masks are not nested', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 1,
          segmentation: [[0, 0, 50, 0, 50, 50, 0, 50]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[100, 100, 150, 100, 150, 150, 100, 150]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);
    expect(result).toBeNull();
  });

  test('detects nested masks with different supercategories', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 4,
          segmentation: [[30, 30, 70, 30, 70, 70, 30, 70]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].inner.id).toBe(101);
    expect(result[0].inner.category).toBe('wheel');
    expect(result[0].inner.supercategory).toBe('part');
    expect(result[0].outer.id).toBe(102);
    expect(result[0].outer.category).toBe('car');
    expect(result[0].outer.supercategory).toBe('vehicle');
  });

  test('detects multiple nested mask mismatches', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 4,
          segmentation: [[30, 30, 45, 30, 45, 45, 30, 45]],
        },
        {
          id: 102,
          category_id: 4,
          segmentation: [[55, 55, 70, 55, 70, 70, 55, 70]],
        },
        {
          id: 103,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).not.toBeNull();
    expect(result.length).toBe(2);

    const mismatch1 = result.find((m) => m.inner.id === 101);
    expect(mismatch1).toBeDefined();
    expect(mismatch1.outer.id).toBe(103);

    const mismatch2 = result.find((m) => m.inner.id === 102);
    expect(mismatch2).toBeDefined();
    expect(mismatch2.outer.id).toBe(103);
  });

  test('avoids duplicate mismatch entries', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 4,
          segmentation: [[30, 30, 70, 30, 70, 70, 30, 70]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
  });

  test('handles annotations with unknown category_id', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 999,
          segmentation: [[30, 30, 70, 30, 70, 70, 30, 70]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).toBeNull();
  });

  test('handles multiple images correctly', () => {
    const currentImage = { id: 2 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 4,
          segmentation: [[30, 30, 70, 30, 70, 70, 30, 70]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
      2: [
        {
          id: 201,
          category_id: 1,
          segmentation: [[0, 0, 50, 0, 50, 50, 0, 50]],
        },
        {
          id: 202,
          category_id: 2,
          segmentation: [[100, 100, 150, 100, 150, 150, 100, 150]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).toBeNull();
  });

  test('handles partially overlapping masks', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 1,
          segmentation: [[0, 0, 60, 0, 60, 60, 0, 60]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[40, 40, 100, 40, 100, 100, 40, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).toBeNull();
  });

  test('handles complex polygon shapes', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 4,
          segmentation: [[40, 40, 60, 40, 60, 60, 40, 60]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
  });

  test('returns proper structure for mismatch object', () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        {
          id: 101,
          category_id: 4,
          segmentation: [[30, 30, 70, 30, 70, 70, 30, 70]],
        },
        {
          id: 102,
          category_id: 3,
          segmentation: [[0, 0, 100, 0, 100, 100, 0, 100]],
        },
      ],
    };
    const result = checkNestedMaskSupercategoryMismatch(currentImage, annotations, mockCategories);

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);

    const mismatch = result[0];
    expect(mismatch).toHaveProperty('inner');
    expect(mismatch).toHaveProperty('outer');
    expect(mismatch.inner).toHaveProperty('id');
    expect(mismatch.inner).toHaveProperty('category');
    expect(mismatch.inner).toHaveProperty('supercategory');
    expect(mismatch.outer).toHaveProperty('id');
    expect(mismatch.outer).toHaveProperty('category');
    expect(mismatch.outer).toHaveProperty('supercategory');
  });
});
