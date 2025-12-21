/**
 * Utilities for drawing segmentation masks
 */

/**
 * Get a distinct color for a mask at given index
 * @param {number} index - Mask index (0-based)
 * @returns {string} RGBA color string
 */
export function getMaskColor(index) {
  // Color palette for multiple masks - vibrant, distinct colors
  const colors = [
    { r: 255, g: 0, b: 0 }, // Red
    { r: 0, g: 128, b: 255 }, // Blue
    { r: 0, g: 255, b: 0 }, // Green
    { r: 255, g: 128, b: 0 }, // Orange
    { r: 255, g: 0, b: 255 }, // Magenta
    { r: 0, g: 255, b: 255 }, // Cyan
    { r: 255, g: 255, b: 0 }, // Yellow
    { r: 128, g: 0, b: 255 }, // Purple
  ];

  // Cycle through colors if index exceeds palette
  const color = colors[index % colors.length];
  const alpha = 0.3; // Semi-transparent

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * Check if segmentation contains multiple masks
 * @param {Array} segmentation - Segmentation data (array of contours)
 * @returns {boolean} True if multiple masks should be drawn
 */
export function shouldDrawMultipleMasks(segmentation) {
  if (!segmentation || !Array.isArray(segmentation)) {
    return false;
  }

  return segmentation.length > 1;
}
