/**
 * Utilities for merging multiple mask polygons into a single mask
 */

import { unionOverlappingPolygons } from "./polygon-union.js";

/**
 * Calculate area of a polygon using the shoelace formula
 * @param {Array<number>} polygon - Flat array of coordinates [x1, y1, x2, y2, ...]
 * @returns {number} Area of the polygon (always positive)
 */
export function calculatePolygonArea(polygon) {
  if (!polygon || polygon.length < 6) {
    // Need at least 3 points (6 numbers) for a valid polygon
    return 0;
  }

  let area = 0;
  const numPoints = polygon.length / 2;

  for (let i = 0; i < numPoints; i++) {
    const x1 = polygon[i * 2];
    const y1 = polygon[i * 2 + 1];
    const x2 = polygon[((i + 1) % numPoints) * 2];
    const y2 = polygon[((i + 1) % numPoints) * 2 + 1];

    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate total area of multiple polygons
 * @param {Array<Array<number>>} polygons - Array of polygon coordinate arrays
 * @returns {number} Total area of all polygons
 */
export function calculateTotalArea(polygons) {
  if (!polygons || polygons.length === 0) {
    return 0;
  }

  return polygons.reduce((total, polygon) => {
    return total + calculatePolygonArea(polygon);
  }, 0);
}

/**
 * Calculate combined bounding box from multiple polygons
 * @param {Array<Array<number>>} polygons - Array of polygon coordinate arrays
 * @returns {Array<number>|null} Bounding box [x, y, width, height] or null if empty
 */
export function calculateCombinedBbox(polygons) {
  if (!polygons || polygons.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  polygons.forEach((polygon) => {
    if (!polygon || polygon.length < 2) return;

    for (let i = 0; i < polygon.length - 1; i += 2) {
      const x = polygon[i];
      const y = polygon[i + 1];

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  });

  if (minX === Infinity) {
    return null;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return [minX, minY, width, height];
}

/**
 * Merge multiple mask polygons into a single logical mask
 * Preserves all polygons to maintain non-contiguous regions
 * @param {Array<Array<number>>} polygons - Array of polygon coordinate arrays
 * @returns {{mergedPolygons: Array<Array<number>>, bbox: Array<number>, area: number}|null}
 */
export function mergeMaskPolygons(polygons) {
  if (!polygons || polygons.length === 0) {
    return null;
  }

  // Filter out invalid polygons (need at least 3 points = 6 numbers)
  const validPolygons = polygons.filter((p) => p && p.length >= 6);

  if (validPolygons.length === 0) {
    return null;
  }

  // Keep all valid polygons (preserves non-contiguous regions)
  const mergedPolygons = validPolygons;

  // Calculate combined bbox and total area
  const bbox = calculateCombinedBbox(mergedPolygons);
  const area = calculateTotalArea(mergedPolygons);

  return {
    mergedPolygons,
    bbox,
    area,
  };
}

/**
 * Merge segmentations from multiple annotations into one combined result.
 * Collects all polygons from all annotations, unions overlapping ones,
 * and combines them into a single annotation.
 * @param {Array} annotations - Array of annotation objects with segmentation arrays
 * @returns {{mergedPolygons: Array<Array<number>>, bbox: Array<number>, area: number}|null}
 */
export function mergeAnnotationSegmentations(annotations) {
  if (!annotations || annotations.length === 0) {
    return null;
  }

  // Collect all polygons from all annotations
  const allPolygons = [];

  for (const annotation of annotations) {
    if (!annotation.segmentation || !Array.isArray(annotation.segmentation)) {
      continue;
    }

    for (const polygon of annotation.segmentation) {
      if (polygon && Array.isArray(polygon) && polygon.length >= 6) {
        allPolygons.push(polygon);
      }
    }
  }

  if (allPolygons.length === 0) {
    return null;
  }

  // Union overlapping polygons to merge them into single shapes
  const unionedPolygons = unionOverlappingPolygons(allPolygons);

  if (unionedPolygons.length === 0) {
    return null;
  }

  // Calculate combined bbox and total area
  const bbox = calculateCombinedBbox(unionedPolygons);
  const area = calculateTotalArea(unionedPolygons);

  return {
    mergedPolygons: unionedPolygons,
    bbox,
    area,
  };
}
