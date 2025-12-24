/**
 * Manual mask utilities
 * Converts boxes to COCO polygon format for manual mask creation without ML inference
 */

/**
 * Convert a box to a COCO polygon format (flat array of x,y coordinates)
 * @param {Object} box - Box with {x1, y1, x2, y2} coordinates
 * @returns {number[]|null} Flat array [x1,y1, x2,y1, x2,y2, x1,y2] or null if invalid
 */
export function boxToPolygon(box) {
  if (
    !box ||
    box.x1 === undefined ||
    box.y1 === undefined ||
    box.x2 === undefined ||
    box.y2 === undefined
  ) {
    return null;
  }

  // Normalize coordinates (handle inverted boxes from drag direction)
  const minX = Math.min(box.x1, box.x2);
  const maxX = Math.max(box.x1, box.x2);
  const minY = Math.min(box.y1, box.y2);
  const maxY = Math.max(box.y1, box.y2);

  // Return clockwise polygon: top-left, top-right, bottom-right, bottom-left
  return [minX, minY, maxX, minY, maxX, maxY, minX, maxY];
}

/**
 * Convert multiple boxes to a segmentation array (array of polygons)
 * @param {Object[]} boxes - Array of boxes with {x1, y1, x2, y2}
 * @returns {number[][]} Array of polygons, each polygon is a flat coordinate array
 */
export function boxesToSegmentation(boxes) {
  if (!boxes || !Array.isArray(boxes)) {
    return [];
  }

  return boxes.map(boxToPolygon).filter((polygon) => polygon !== null);
}

/**
 * Calculate bounding box from a polygon in COCO format [x, y, width, height]
 * @param {number[]} polygon - Flat array of x,y coordinates
 * @returns {number[]|null} COCO bbox [x, y, width, height] or null if invalid
 */
export function calculateBboxFromPolygon(polygon) {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 2) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < polygon.length; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX - minX, maxY - minY];
}

/**
 * Calculate area of a polygon using the Shoelace formula
 * @param {number[]} polygon - Flat array of x,y coordinates
 * @returns {number} Area of the polygon (always positive)
 */
export function calculateAreaFromPolygon(polygon) {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 6) {
    return 0;
  }

  let area = 0;
  const n = polygon.length / 2;

  for (let i = 0; i < n; i++) {
    const x1 = polygon[i * 2];
    const y1 = polygon[i * 2 + 1];
    const x2 = polygon[((i + 1) % n) * 2];
    const y2 = polygon[((i + 1) % n) * 2 + 1];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

/**
 * Create a complete segmentation result from boxes (mimics SAM API response format)
 * @param {Object[]} boxes - Array of boxes with {x1, y1, x2, y2}
 * @returns {Object|null} Segmentation result with {segmentation, bbox, area} or null if no valid boxes
 */
export function createManualSegmentationResult(boxes) {
  const segmentation = boxesToSegmentation(boxes);

  if (segmentation.length === 0) {
    return null;
  }

  // Calculate combined bbox across all polygons
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const polygon of segmentation) {
    for (let i = 0; i < polygon.length; i += 2) {
      const x = polygon[i];
      const y = polygon[i + 1];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  // Calculate total area across all polygons
  let totalArea = 0;
  for (const polygon of segmentation) {
    totalArea += calculateAreaFromPolygon(polygon);
  }

  return {
    segmentation,
    bbox: [minX, minY, maxX - minX, maxY - minY],
    area: totalArea,
  };
}
