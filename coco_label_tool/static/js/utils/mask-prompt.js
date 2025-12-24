/**
 * Mask prompt utilities
 * Functions for freehand mask drawing and polygon manipulation
 */

/**
 * Simplify a path using the Ramer-Douglas-Peucker algorithm
 * Reduces the number of points while preserving the shape
 * @param {Array<{x: number, y: number}>} points - Array of points
 * @param {number} tolerance - Maximum distance a point can deviate from the line
 * @returns {Array<{x: number, y: number}>} Simplified array of points
 */
export function simplifyPath(points, tolerance) {
  if (!points || !Array.isArray(points) || points.length <= 2) {
    return points || [];
  }

  // Find the point with maximum distance from the line between first and last
  const first = points[0];
  const last = points[points.length - 1];

  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);

    // Concatenate results, removing duplicate point at junction
    return left.slice(0, -1).concat(right);
  }

  // All points are within tolerance, return just endpoints
  return [first, last];
}

/**
 * Calculate perpendicular distance from a point to a line
 * @param {Object} point - The point {x, y}
 * @param {Object} lineStart - Start of line {x, y}
 * @param {Object} lineEnd - End of line {x, y}
 * @returns {number} Perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // If line is a point, return distance to that point
  const lineLengthSquared = dx * dx + dy * dy;
  if (lineLengthSquared === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2),
    );
  }

  // Calculate perpendicular distance using cross product method
  const numerator = Math.abs(
    dy * point.x -
      dx * point.y +
      lineEnd.x * lineStart.y -
      lineEnd.y * lineStart.x,
  );
  const denominator = Math.sqrt(lineLengthSquared);

  return numerator / denominator;
}

/**
 * Check if a path is closed (start and end points are within threshold distance)
 * @param {Array<{x: number, y: number}>} points - Array of points
 * @param {number} threshold - Maximum distance to consider closed
 * @returns {boolean} True if path is closed
 */
export function isPathClosed(points, threshold) {
  if (!points || !Array.isArray(points) || points.length < 2) {
    return false;
  }

  const first = points[0];
  const last = points[points.length - 1];

  const distance = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2),
  );

  return distance <= threshold;
}

/**
 * Close a path by adding the start point to the end if not already closed
 * @param {Array<{x: number, y: number}>} points - Array of points
 * @returns {Array<{x: number, y: number}>} Closed array of points
 */
export function closePath(points) {
  if (!points || !Array.isArray(points) || points.length < 2) {
    return points || [];
  }

  const first = points[0];
  const last = points[points.length - 1];

  // Check if already closed (exact match)
  if (first.x === last.x && first.y === last.y) {
    return [...points];
  }

  // Add start point to end to close
  return [...points, { x: first.x, y: first.y }];
}

/**
 * Convert screen coordinates to natural image coordinates
 * @param {Array<{x: number, y: number}>} points - Points in screen coordinates
 * @param {number} scaleX - Scale factor for X (naturalWidth / displayWidth)
 * @param {number} scaleY - Scale factor for Y (naturalHeight / displayHeight)
 * @returns {Array<{x: number, y: number}>} Points in natural coordinates
 */
export function screenToNaturalPolygon(points, scaleX, scaleY) {
  if (!points || !Array.isArray(points)) {
    return [];
  }

  return points.map((p) => ({
    x: p.x * scaleX,
    y: p.y * scaleY,
  }));
}

/**
 * Convert natural image coordinates to screen coordinates
 * @param {Array<{x: number, y: number}>} points - Points in natural coordinates
 * @param {number} scaleX - Scale factor for X (naturalWidth / displayWidth)
 * @param {number} scaleY - Scale factor for Y (naturalHeight / displayHeight)
 * @returns {Array<{x: number, y: number}>} Points in screen coordinates
 */
export function naturalToScreenPolygon(points, scaleX, scaleY) {
  if (!points || !Array.isArray(points)) {
    return [];
  }

  return points.map((p) => ({
    x: p.x / scaleX,
    y: p.y / scaleY,
  }));
}

/**
 * Convert array of {x, y} points to COCO flat format [x1, y1, x2, y2, ...]
 * @param {Array<{x: number, y: number}>} points - Array of points
 * @returns {number[]} Flat array of coordinates
 */
export function flattenPolygon(points) {
  if (!points || !Array.isArray(points)) {
    return [];
  }

  const result = [];
  for (const p of points) {
    result.push(p.x, p.y);
  }
  return result;
}

/**
 * Convert COCO flat format [x1, y1, x2, y2, ...] to array of {x, y} points
 * @param {number[]} flat - Flat array of coordinates
 * @returns {Array<{x: number, y: number}>} Array of points
 */
export function unflattenPolygon(flat) {
  if (!flat || !Array.isArray(flat)) {
    return [];
  }

  const result = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    result.push({ x: flat[i], y: flat[i + 1] });
  }
  return result;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param {number} x - X coordinate of point
 * @param {number} y - Y coordinate of point
 * @param {Array<{x: number, y: number}>} polygon - Array of polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(x, y, polygon) {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    // Check if point is on vertex
    if (xi === x && yi === y) {
      return true;
    }

    // Ray casting
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  // Also check if point is on edge
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (isPointOnLineSegment(x, y, polygon[j], polygon[i])) {
      return true;
    }
  }

  return inside;
}

/**
 * Check if a point lies on a line segment
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} p1 - Start point of segment
 * @param {Object} p2 - End point of segment
 * @returns {boolean} True if point is on segment
 */
function isPointOnLineSegment(x, y, p1, p2) {
  const tolerance = 0.001;

  // Check if point is within bounding box of segment
  const minX = Math.min(p1.x, p2.x) - tolerance;
  const maxX = Math.max(p1.x, p2.x) + tolerance;
  const minY = Math.min(p1.y, p2.y) - tolerance;
  const maxY = Math.max(p1.y, p2.y) + tolerance;

  if (x < minX || x > maxX || y < minY || y > maxY) {
    return false;
  }

  // Check if point is collinear with segment using cross product
  const crossProduct = (y - p1.y) * (p2.x - p1.x) - (x - p1.x) * (p2.y - p1.y);
  return (
    Math.abs(crossProduct) <
    tolerance * Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y), 1)
  );
}

/**
 * Calculate the centroid (center of mass) of a polygon
 * @param {Array<{x: number, y: number}>} polygon - Array of polygon vertices
 * @returns {{x: number, y: number}|null} Centroid point or null if invalid
 */
export function calculatePolygonCentroid(polygon) {
  if (!polygon || !Array.isArray(polygon) || polygon.length === 0) {
    return null;
  }

  if (polygon.length === 1) {
    return { x: polygon[0].x, y: polygon[0].y };
  }

  // For simple centroid calculation, use average of vertices
  // This works well for convex polygons and is close enough for concave
  let sumX = 0;
  let sumY = 0;

  for (const p of polygon) {
    sumX += p.x;
    sumY += p.y;
  }

  return {
    x: sumX / polygon.length,
    y: sumY / polygon.length,
  };
}

/**
 * Calculate the area of a polygon using the Shoelace formula
 * @param {Array<{x: number, y: number}>} polygon - Array of polygon vertices
 * @returns {number} Area of polygon (always positive)
 */
export function calculatePolygonArea(polygon) {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
    return 0;
  }

  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate the bounding box of a polygon in COCO format [x, y, width, height]
 * @param {Array<{x: number, y: number}>} polygon - Array of polygon vertices
 * @returns {number[]|null} Bounding box [x, y, width, height] or null if invalid
 */
export function calculatePolygonBbox(polygon) {
  if (!polygon || !Array.isArray(polygon) || polygon.length === 0) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return [minX, minY, maxX - minX, maxY - minY];
}

/**
 * Create a segmentation result object from drawn mask polygons
 * Matches the format returned by SAM API
 * @param {Array<number[]>} polygons - Array of polygons in COCO flat format
 * @returns {{segmentation: number[][], bbox: number[], area: number}|null} Result object or null
 */
export function createMaskSegmentationResult(polygons) {
  if (!polygons || !Array.isArray(polygons)) {
    return null;
  }

  // Filter out empty polygons
  const validPolygons = polygons.filter((p) => p && p.length >= 6);

  if (validPolygons.length === 0) {
    return null;
  }

  // Calculate combined bbox and total area
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let totalArea = 0;

  for (const flat of validPolygons) {
    const points = unflattenPolygon(flat);

    // Update bbox
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // Add area
    totalArea += calculatePolygonArea(points);
  }

  return {
    segmentation: validPolygons,
    bbox: [minX, minY, maxX - minX, maxY - minY],
    area: totalArea,
  };
}
