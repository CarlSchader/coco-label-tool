/**
 * Tests for saving multiple masks as separate annotations
 */

import {
  prepareMasksForSaving,
  calculateBboxFromPolygon,
  validateMaskCategoriesForSaving,
  calculateAreaFromPolygon,
} from "../static/js/utils/multi-mask-save.js";

describe("Multi-mask save workflow", () => {
  describe("prepareMasksForSaving", () => {
    test("returns single item array for single mask with category", () => {
      const segmentation = [[0, 0, 10, 0, 5, 10]]; // Triangle
      const maskCategoryIds = [42];

      const result = prepareMasksForSaving(segmentation, maskCategoryIds);

      expect(result).toHaveLength(1);
      expect(result[0].segmentation).toEqual([[0, 0, 10, 0, 5, 10]]);
      expect(result[0].bbox).toEqual([0, 0, 10, 10]);
      expect(result[0].categoryId).toBe(42);
      expect(result[0].area).toBe(50); // Triangle area
    });

    test("returns multiple items for multiple masks with categories", () => {
      const segmentation = [
        [10, 20, 30, 40, 50, 60], // Polygon 1
        [100, 200, 300, 400, 500, 600], // Polygon 2
      ];
      const maskCategoryIds = [1, 2];

      const result = prepareMasksForSaving(segmentation, maskCategoryIds);

      expect(result).toHaveLength(2);
      expect(result[0].segmentation).toEqual([[10, 20, 30, 40, 50, 60]]);
      expect(result[0].categoryId).toBe(1);
      expect(result[1].segmentation).toEqual([[100, 200, 300, 400, 500, 600]]);
      expect(result[1].categoryId).toBe(2);
    });

    test("handles merged mask (single category for multiple polygons)", () => {
      const segmentation = [
        [10, 20, 30, 40, 50, 60], // Polygon 1
        [100, 200, 300, 400, 500, 600], // Polygon 2
      ];
      const maskCategoryIds = [42]; // Single category for all

      const result = prepareMasksForSaving(segmentation, maskCategoryIds);

      expect(result).toHaveLength(2);
      expect(result[0].categoryId).toBe(42);
      expect(result[1].categoryId).toBe(42);
    });

    test("calculates individual bboxes and areas for each mask", () => {
      const segmentation = [
        [0, 0, 10, 0, 10, 5, 0, 5], // Rectangle 10x5
        [0, 0, 10, 0, 5, 10], // Triangle
      ];
      const maskCategoryIds = [1, 2];

      const result = prepareMasksForSaving(segmentation, maskCategoryIds);

      // Bbox format: [x, y, width, height]
      expect(result[0].bbox).toEqual([0, 0, 10, 5]); // Rectangle bounds
      expect(result[1].bbox).toEqual([0, 0, 10, 10]); // Triangle bounds
      expect(result[0].area).toBe(50); // Rectangle area = 10 * 5
      expect(result[1].area).toBe(50); // Triangle area = 0.5 * 10 * 10
    });

    test("handles empty segmentation", () => {
      const result = prepareMasksForSaving([]);
      expect(result).toEqual([]);
    });

    test("handles null segmentation", () => {
      const result = prepareMasksForSaving(null);
      expect(result).toEqual([]);
    });
  });

  describe("validateMaskCategoriesForSaving", () => {
    test("returns null for valid single mask", () => {
      const segmentation = [[10, 20, 30, 40]];
      const maskCategoryIds = [1];
      expect(
        validateMaskCategoriesForSaving(segmentation, maskCategoryIds),
      ).toBeNull();
    });

    test("returns null for valid multiple masks", () => {
      const segmentation = [
        [10, 20, 30, 40],
        [50, 60, 70, 80],
      ];
      const maskCategoryIds = [1, 2];
      expect(
        validateMaskCategoriesForSaving(segmentation, maskCategoryIds),
      ).toBeNull();
    });

    test("returns null for valid merged mask", () => {
      const segmentation = [
        [10, 20, 30, 40],
        [50, 60, 70, 80],
      ];
      const maskCategoryIds = [1]; // Single category for all
      expect(
        validateMaskCategoriesForSaving(segmentation, maskCategoryIds),
      ).toBeNull();
    });

    test("returns error when no categories provided", () => {
      const segmentation = [[10, 20, 30, 40]];
      const maskCategoryIds = [];
      const error = validateMaskCategoriesForSaving(
        segmentation,
        maskCategoryIds,
      );
      expect(error).not.toBeNull();
      expect(error.message).toContain("select a category");
    });

    test("returns error when category count mismatch", () => {
      const segmentation = [
        [10, 20, 30, 40],
        [50, 60, 70, 80],
      ];
      const maskCategoryIds = [1, 2, 3]; // Too many
      const error = validateMaskCategoriesForSaving(
        segmentation,
        maskCategoryIds,
      );
      expect(error).not.toBeNull();
      expect(error.message).toContain("mismatch");
    });

    test("returns error when merged mask has no category", () => {
      const segmentation = [
        [10, 20, 30, 40],
        [50, 60, 70, 80],
      ];
      const maskCategoryIds = [null]; // No category
      const error = validateMaskCategoriesForSaving(
        segmentation,
        maskCategoryIds,
      );
      expect(error).not.toBeNull();
      expect(error.message).toContain("merged mask");
    });

    test("returns error when individual mask has no category", () => {
      const segmentation = [
        [10, 20, 30, 40],
        [50, 60, 70, 80],
      ];
      const maskCategoryIds = [1, null]; // Second mask has no category
      const error = validateMaskCategoriesForSaving(
        segmentation,
        maskCategoryIds,
      );
      expect(error).not.toBeNull();
      expect(error.message).toContain("mask 2");
    });

    test("returns null for empty segmentation", () => {
      const segmentation = [];
      const maskCategoryIds = [];
      expect(
        validateMaskCategoriesForSaving(segmentation, maskCategoryIds),
      ).toBeNull();
    });
  });

  describe("calculateAreaFromPolygon", () => {
    test("calculates area for triangle", () => {
      // Triangle with vertices at (0,0), (10,0), (5,10)
      const polygon = [0, 0, 10, 0, 5, 10];
      const area = calculateAreaFromPolygon(polygon);
      expect(area).toBe(50); // Area = 0.5 * base * height = 0.5 * 10 * 10 = 50
    });

    test("calculates area for rectangle", () => {
      // Rectangle with corners at (0,0), (10,0), (10,5), (0,5)
      const polygon = [0, 0, 10, 0, 10, 5, 0, 5];
      const area = calculateAreaFromPolygon(polygon);
      expect(area).toBe(50); // Area = width * height = 10 * 5 = 50
    });

    test("returns 0 for empty polygon", () => {
      expect(calculateAreaFromPolygon([])).toBe(0);
    });

    test("returns 0 for polygon with less than 3 points", () => {
      expect(calculateAreaFromPolygon([10, 20])).toBe(0);
      expect(calculateAreaFromPolygon([10, 20, 30, 40])).toBe(0);
    });
  });

  describe("calculateBboxFromPolygon", () => {
    test("calculates bbox from polygon points", () => {
      const polygon = [10, 20, 50, 30, 40, 60, 15, 55];
      // Points: (10,20), (50,30), (40,60), (15,55)
      // Min: (10, 20), Max: (50, 60)
      // Bbox: [10, 20, 40, 40] (x, y, width, height)

      const result = calculateBboxFromPolygon(polygon);

      expect(result).toEqual([10, 20, 40, 40]);
    });

    test("handles single point", () => {
      const polygon = [100, 200];
      const result = calculateBboxFromPolygon(polygon);
      expect(result).toEqual([100, 200, 0, 0]);
    });

    test("handles empty polygon", () => {
      const result = calculateBboxFromPolygon([]);
      expect(result).toBeNull();
    });

    test("handles odd number of coordinates (incomplete point)", () => {
      const polygon = [10, 20, 30]; // Missing y for last point
      // Should only process complete points: (10, 20)
      const result = calculateBboxFromPolygon(polygon);
      expect(result).toEqual([10, 20, 0, 0]);
    });
  });
});
