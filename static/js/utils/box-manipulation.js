/**
 * Utilities for manipulating boxes in currentBoxes array
 * Supports dragging, resizing, and finding boxes
 */

/**
 * Update a box at a specific index in the array
 * @param {Array} boxes - Array of box objects
 * @param {number} index - Index to update
 * @param {Object} newBox - New box object {x1, y1, x2, y2}
 * @returns {Array} New array with updated box (immutable)
 */
export function updateBoxInArray(boxes, index, newBox) {
  if (!boxes || boxes.length === 0) {
    throw new Error('Cannot update box in empty array');
  }

  if (index < 0 || index >= boxes.length) {
    throw new Error(`Index ${index} out of bounds for array of length ${boxes.length}`);
  }

  // Create new array with updated box (immutable)
  const newBoxes = [...boxes];
  newBoxes[index] = newBox;
  return newBoxes;
}

/**
 * Find the index of a box containing the given point
 * Returns the LAST matching box (topmost in z-order)
 * @param {Array} boxes - Array of box objects
 * @param {number} mouseX - Mouse X coordinate (screen space)
 * @param {number} mouseY - Mouse Y coordinate (screen space)
 * @param {number} scaleX - Scale factor for X (naturalWidth / displayWidth)
 * @param {number} scaleY - Scale factor for Y (naturalHeight / displayHeight)
 * @returns {number} Index of box, or -1 if not found
 */
export function findBoxIndexAtPoint(boxes, mouseX, mouseY, scaleX, scaleY) {
  if (!boxes || boxes.length === 0) {
    return -1;
  }

  // Convert mouse coords to natural image space
  const x = mouseX * scaleX;
  const y = mouseY * scaleY;

  // Find last matching box (topmost in drawing order)
  let foundIndex = -1;

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
      foundIndex = i;
    }
  }

  return foundIndex;
}
