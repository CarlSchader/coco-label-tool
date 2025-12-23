/**
 * Crosshair guide utilities for canvas overlay.
 * Pure functions for calculating crosshair line positions.
 */

export const CROSSHAIR_DEFAULTS = {
  strokeStyle: "#ffffff",
  lineWidth: 1,
  dashPattern: [8, 8],
};

/**
 * Check if mouse position is within canvas bounds.
 * @param {number} mouseX - Mouse X coordinate relative to canvas
 * @param {number} mouseY - Mouse Y coordinate relative to canvas
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @returns {boolean} True if mouse is inside canvas
 */
export function isMouseInCanvas(mouseX, mouseY, canvasWidth, canvasHeight) {
  if (canvasWidth <= 0 || canvasHeight <= 0) return false;
  return (
    mouseX >= 0 && mouseX < canvasWidth && mouseY >= 0 && mouseY < canvasHeight
  );
}

/**
 * Calculate crosshair line coordinates.
 * Returns coordinates for horizontal and vertical lines that intersect at mouse position.
 * @param {number} mouseX - Mouse X coordinate
 * @param {number} mouseY - Mouse Y coordinate
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @returns {{horizontal: {x1: number, y1: number, x2: number, y2: number}, vertical: {x1: number, y1: number, x2: number, y2: number}}}
 */
export function getCrosshairLines(mouseX, mouseY, canvasWidth, canvasHeight) {
  return {
    horizontal: {
      x1: 0,
      y1: mouseY,
      x2: canvasWidth,
      y2: mouseY,
    },
    vertical: {
      x1: mouseX,
      y1: 0,
      x2: mouseX,
      y2: canvasHeight,
    },
  };
}
