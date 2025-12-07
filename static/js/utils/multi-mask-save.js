/**
 * Utilities for saving multiple masks as separate annotations
 */

/**
 * Calculate bounding box from polygon coordinates
 * @param {Array<number>} polygon - Flat array of coordinates [x1, y1, x2, y2, ...]
 * @returns {Array<number>|null} Bounding box [x, y, width, height] or null if empty
 */
export function calculateBboxFromPolygon(polygon) {
  if (!polygon || polygon.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Process pairs of coordinates (x, y)
  for (let i = 0; i < polygon.length - 1; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return [minX, minY, width, height];
}

/**
 * Calculate area from polygon coordinates (using shoelace formula)
 * @param {Array<number>} polygon - Flat array of coordinates [x1, y1, x2, y2, ...]
 * @returns {number} Area in pixels
 */
export function calculateAreaFromPolygon(polygon) {
  // Need at least 3 points (6 coordinates) for a valid polygon
  if (!polygon || polygon.length < 6) {
    return 0;
  }

  let area = 0;
  const numPoints = Math.floor(polygon.length / 2);

  for (let i = 0; i < numPoints; i++) {
    const j = (i + 1) % numPoints;
    const x1 = polygon[i * 2];
    const y1 = polygon[i * 2 + 1];
    const x2 = polygon[j * 2];
    const y2 = polygon[j * 2 + 1];

    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

/**
 * Validate mask categories before saving
 * @param {Array<Array<number>>} segmentation - Array of polygon contours
 * @param {Array<number>} maskCategoryIds - Category IDs for each mask
 * @returns {Object|null} Error object {message: string} or null if valid
 */
export function validateMaskCategoriesForSaving(segmentation, maskCategoryIds) {
  if (!segmentation || segmentation.length === 0) {
    return null; // Empty is valid (nothing to save)
  }

  const numMasks = segmentation.length;

  // No categories provided
  if (maskCategoryIds.length === 0) {
    return { message: 'Please select a category for each mask' };
  }

  // Merged mask (single category for all masks)
  if (maskCategoryIds.length === 1 && numMasks > 1) {
    const categoryId = maskCategoryIds[0];
    if (!categoryId) {
      return { message: 'Please select a category for the merged mask' };
    }
    return null; // Valid
  }

  // Multiple separate masks
  if (maskCategoryIds.length !== numMasks) {
    return {
      message: `Category mismatch: ${numMasks} masks but ${maskCategoryIds.length} categories selected`,
    };
  }

  // Check all categories are selected
  for (let i = 0; i < numMasks; i++) {
    if (!maskCategoryIds[i]) {
      return { message: `Please select a category for mask ${i + 1}` };
    }
  }

  return null; // Valid
}

/**
 * Prepare masks for saving - splits multiple masks into separate save operations
 * @param {Array<Array<number>>} segmentation - Array of polygon contours
 * @param {Array<number>} maskCategoryIds - Category IDs for each mask
 * @returns {Array<Object>} Array of {segmentation, bbox, area, categoryId} objects
 */
export function prepareMasksForSaving(segmentation, maskCategoryIds = []) {
  if (!segmentation || segmentation.length === 0) {
    return [];
  }

  const numMasks = segmentation.length;

  // For merged mask (single category for all masks)
  if (maskCategoryIds.length === 1 && numMasks > 1) {
    const categoryId = maskCategoryIds[0];
    return segmentation.map((polygon) => ({
      segmentation: [polygon],
      bbox: calculateBboxFromPolygon(polygon),
      area: calculateAreaFromPolygon(polygon),
      categoryId: categoryId,
    }));
  }

  // For multiple separate masks, each has its own category
  return segmentation.map((polygon, index) => ({
    segmentation: [polygon],
    bbox: calculateBboxFromPolygon(polygon),
    area: calculateAreaFromPolygon(polygon),
    categoryId: maskCategoryIds[index] || null,
  }));
}
