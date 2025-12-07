/**
 * Utilities for per-mask category selection
 */

/**
 * Find the top-most point of a mask polygon that is within frame bounds
 * If multiple points at same Y, returns leftmost
 * @param {Array<number>} polygon - Flat array [x1,y1,x2,y2,...]
 * @param {number} frameWidth - Image natural width
 * @param {number} frameHeight - Image natural height
 * @returns {{x: number, y: number}|null} Top point or null if all outside frame
 */
export function findTopPointOfMask(polygon, frameWidth, frameHeight) {
  if (!polygon || polygon.length < 2) {
    return null;
  }

  let topPoint = null;
  let minY = Infinity;

  // Scan polygon for top-most point within bounds
  for (let i = 0; i < polygon.length - 1; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];

    // Check if point is within frame (inclusive boundaries)
    if (x >= 0 && x <= frameWidth && y >= 0 && y <= frameHeight) {
      // Update if this is higher (lower Y) or same height but more left
      if (y < minY || (y === minY && (!topPoint || x < topPoint.x))) {
        minY = y;
        topPoint = { x, y };
      }
    }
  }

  return topPoint;
}

/**
 * Initialize mask category IDs array with default category
 * @param {number} maskCount - Number of masks
 * @param {number|null} defaultCategoryId - Default category (or null)
 * @returns {Array<number|null>} Array of category IDs
 */
export function initializeMaskCategories(maskCount, defaultCategoryId) {
  return Array(maskCount).fill(defaultCategoryId);
}

/**
 * Validate that all masks have categories assigned
 * @param {Array<number|null>} maskCategoryIds - Array of category IDs
 * @returns {{valid: boolean, missingIndices: Array<number>}} Validation result
 */
export function validateMaskCategories(maskCategoryIds) {
  const missingIndices = [];

  maskCategoryIds.forEach((categoryId, index) => {
    if (categoryId === null || categoryId === undefined) {
      missingIndices.push(index);
    }
  });

  return {
    valid: missingIndices.length === 0,
    missingIndices,
  };
}

/**
 * Convert natural coordinates to screen coordinates
 * @param {number} x - Natural X coordinate
 * @param {number} y - Natural Y coordinate
 * @param {number} scaleX - Scale factor X
 * @param {number} scaleY - Scale factor Y
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function naturalToScreen(x, y, scaleX, scaleY) {
  return {
    x: x * scaleX,
    y: y * scaleY,
  };
}

/**
 * Detect which dropdowns overlap based on threshold
 * @param {Array<{x: number, y: number}>} positions - Dropdown positions
 * @param {number} threshold - Distance threshold to consider overlap
 * @returns {Array<{index: number, overlaps: Array<number>}>} Overlapping dropdown info
 */
export function detectDropdownOverlap(positions, threshold) {
  const overlaps = [];

  for (let i = 1; i < positions.length; i++) {
    const current = positions[i];
    const overlappingWith = [];

    for (let j = 0; j < i; j++) {
      const other = positions[j];
      const distance = Math.abs(current.x - other.x);

      // Check if at similar Y (within 10px) and within horizontal threshold
      if (Math.abs(current.y - other.y) < 10 && distance < threshold) {
        overlappingWith.push(j);
      }
    }

    if (overlappingWith.length > 0) {
      overlaps.push({ index: i, overlaps: overlappingWith });
    }
  }

  return overlaps;
}

/**
 * Offset overlapping dropdowns horizontally to prevent visual overlap
 * @param {Array<{x: number, y: number}>} positions - Dropdown positions
 * @param {number} threshold - Distance threshold to consider overlap
 * @param {number} offset - Horizontal offset to apply
 * @returns {Array<{x: number, y: number}>} Adjusted positions (new array)
 */
export function offsetOverlappingDropdowns(positions, threshold, offset) {
  // Create a copy to avoid mutating original
  const result = positions.map((pos) => ({ ...pos }));
  const overlaps = detectDropdownOverlap(positions, threshold);

  overlaps.forEach(({ index }) => {
    result[index] = {
      ...result[index],
      x: result[index].x + offset,
    };
  });

  return result;
}
