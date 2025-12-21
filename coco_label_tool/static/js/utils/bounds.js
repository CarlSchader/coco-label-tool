/**
 * Frame bounds checking utilities
 *
 * Pure functions for checking if points and boxes are within frame bounds.
 * All functions use natural image coordinates (not screen coordinates).
 */

/**
 * Check if a point is within frame bounds
 * @param {number} x - X coordinate in natural image space
 * @param {number} y - Y coordinate in natural image space
 * @param {number} frameWidth - Frame width in natural image space
 * @param {number} frameHeight - Frame height in natural image space
 * @returns {boolean} True if point is inside frame
 */
export function isPointInBounds(x, y, frameWidth, frameHeight) {
  return x >= 0 && x <= frameWidth && y >= 0 && y <= frameHeight;
}

/**
 * Check if at least one corner of a box is within frame bounds
 * @param {Object} box - Box with x1, y1, x2, y2 in natural image space
 * @param {number} frameWidth - Frame width in natural image space
 * @param {number} frameHeight - Frame height in natural image space
 * @returns {boolean} True if at least one corner is inside frame
 */
export function hasBoxCornerInBounds(box, frameWidth, frameHeight) {
  if (!box) return false;

  const corners = [
    { x: box.x1, y: box.y1 },
    { x: box.x2, y: box.y1 },
    { x: box.x1, y: box.y2 },
    { x: box.x2, y: box.y2 },
  ];

  return corners.some((corner) =>
    isPointInBounds(corner.x, corner.y, frameWidth, frameHeight),
  );
}
