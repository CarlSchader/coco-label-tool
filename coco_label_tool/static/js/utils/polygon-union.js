/**
 * Utilities for computing polygon unions (merging overlapping polygons)
 *
 * Uses a rasterization approach for robust handling of complex overlaps:
 * 1. Rasterize polygons to a binary grid
 * 2. Trace contours from the grid back to polygon coordinates
 */

import { isPointInPolygon } from "./geometry.js";

/**
 * Get bounding box of a polygon
 * @param {Array<number>} polygon - Flat array [x1, y1, x2, y2, ...]
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null}
 */
export function getPolygonBoundingBox(polygon) {
  if (!polygon || polygon.length < 6) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < polygon.length; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Check if two polygons' bounding boxes overlap
 * @param {Array<number>} poly1
 * @param {Array<number>} poly2
 * @returns {boolean}
 */
export function polygonsBoundingBoxesOverlap(poly1, poly2) {
  const bbox1 = getPolygonBoundingBox(poly1);
  const bbox2 = getPolygonBoundingBox(poly2);

  if (!bbox1 || !bbox2) {
    return false;
  }

  return !(
    bbox1.maxX < bbox2.minX ||
    bbox1.minX > bbox2.maxX ||
    bbox1.maxY < bbox2.minY ||
    bbox1.minY > bbox2.maxY
  );
}

/**
 * Check if two polygons actually overlap (not just bounding boxes)
 * Uses point-in-polygon tests and edge intersection checks
 * @param {Array<number>} poly1
 * @param {Array<number>} poly2
 * @returns {boolean}
 */
export function doPolygonsOverlap(poly1, poly2) {
  if (!poly1 || !poly2 || poly1.length < 6 || poly2.length < 6) {
    return false;
  }

  // Quick reject using bounding boxes
  if (!polygonsBoundingBoxesOverlap(poly1, poly2)) {
    return false;
  }

  // Check if any vertex of poly1 is strictly inside poly2
  for (let i = 0; i < poly1.length; i += 2) {
    if (isPointInPolygon(poly1[i], poly1[i + 1], poly2)) {
      return true;
    }
  }

  // Check if any vertex of poly2 is strictly inside poly1
  for (let i = 0; i < poly2.length; i += 2) {
    if (isPointInPolygon(poly2[i], poly2[i + 1], poly1)) {
      return true;
    }
  }

  // Check for edge intersections
  if (doEdgesIntersect(poly1, poly2)) {
    return true;
  }

  return false;
}

/**
 * Check if any edges of two polygons intersect
 */
function doEdgesIntersect(poly1, poly2) {
  const n1 = poly1.length / 2;
  const n2 = poly2.length / 2;

  for (let i = 0; i < n1; i++) {
    const a1x = poly1[i * 2];
    const a1y = poly1[i * 2 + 1];
    const a2x = poly1[((i + 1) % n1) * 2];
    const a2y = poly1[((i + 1) % n1) * 2 + 1];

    for (let j = 0; j < n2; j++) {
      const b1x = poly2[j * 2];
      const b1y = poly2[j * 2 + 1];
      const b2x = poly2[((j + 1) % n2) * 2];
      const b2y = poly2[((j + 1) % n2) * 2 + 1];

      if (segmentsIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if two line segments intersect (proper intersection, not just touching)
 */
function segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const d1 = direction(bx1, by1, bx2, by2, ax1, ay1);
  const d2 = direction(bx1, by1, bx2, by2, ax2, ay2);
  const d3 = direction(ax1, ay1, ax2, ay2, bx1, by1);
  const d4 = direction(ax1, ay1, ax2, ay2, bx2, by2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  return false;
}

/**
 * Compute cross product direction
 */
function direction(px, py, qx, qy, rx, ry) {
  return (qx - px) * (ry - py) - (qy - py) * (rx - px);
}

/**
 * Union overlapping polygons using rasterization
 * @param {Array<Array<number>>} polygons - Array of polygon arrays
 * @returns {Array<Array<number>>} - Merged polygons
 */
export function unionOverlappingPolygons(polygons) {
  if (!polygons || polygons.length === 0) {
    return [];
  }

  // Filter valid polygons
  const validPolygons = polygons.filter((p) => p && p.length >= 6);
  if (validPolygons.length === 0) {
    return [];
  }

  if (validPolygons.length === 1) {
    return [validPolygons[0]];
  }

  // Group overlapping polygons using union-find
  const groups = groupOverlappingPolygons(validPolygons);

  // Process each group
  const result = [];

  for (const group of groups) {
    if (group.length === 1) {
      // Single polygon, no merging needed
      result.push(group[0]);
    } else {
      // Multiple overlapping polygons - merge them
      const merged = mergePolygonGroup(group);
      result.push(merged);
    }
  }

  return result;
}

/**
 * Group overlapping polygons using union-find algorithm
 */
function groupOverlappingPolygons(polygons) {
  const n = polygons.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x) {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  function union(x, y) {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent[px] = py;
    }
  }

  // Check all pairs for overlap
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (doPolygonsOverlap(polygons[i], polygons[j])) {
        union(i, j);
      }
    }
  }

  // Collect groups
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(polygons[i]);
  }

  return Array.from(groups.values());
}

/**
 * Merge a group of overlapping polygons using rasterization
 */
function mergePolygonGroup(polygons) {
  // Calculate combined bounding box
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const poly of polygons) {
    const bbox = getPolygonBoundingBox(poly);
    if (bbox) {
      minX = Math.min(minX, bbox.minX);
      minY = Math.min(minY, bbox.minY);
      maxX = Math.max(maxX, bbox.maxX);
      maxY = Math.max(maxY, bbox.maxY);
    }
  }

  // Determine resolution (pixels per unit)
  const width = maxX - minX;
  const height = maxY - minY;

  // Use a reasonable resolution that balances accuracy and performance
  const maxDim = Math.max(width, height);
  const resolution = Math.min(1, 256 / maxDim); // At most 256 pixels in largest dimension
  const gridWidth = Math.ceil(width * resolution) + 2;
  const gridHeight = Math.ceil(height * resolution) + 2;

  // Create raster grid
  const grid = new Uint8Array(gridWidth * gridHeight);

  // Rasterize all polygons
  for (const poly of polygons) {
    rasterizePolygon(poly, grid, gridWidth, gridHeight, minX, minY, resolution);
  }

  // Trace contour
  const contour = traceContour(
    grid,
    gridWidth,
    gridHeight,
    minX,
    minY,
    resolution,
  );

  return contour;
}

/**
 * Rasterize a polygon onto a grid using scanline fill
 */
function rasterizePolygon(
  polygon,
  grid,
  gridWidth,
  gridHeight,
  offsetX,
  offsetY,
  resolution,
) {
  const n = polygon.length / 2;
  if (n < 3) return;

  // Convert polygon to grid coordinates
  const points = [];
  for (let i = 0; i < n; i++) {
    points.push({
      x: (polygon[i * 2] - offsetX) * resolution + 1,
      y: (polygon[i * 2 + 1] - offsetY) * resolution + 1,
    });
  }

  // Get bounding box in grid coords
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(gridHeight - 1, Math.ceil(maxY));

  // Scanline fill
  for (let y = minY; y <= maxY; y++) {
    const intersections = [];

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];

      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        const x = p1.x + ((y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x);
        intersections.push(x);
      }
    }

    intersections.sort((a, b) => a - b);

    for (let i = 0; i < intersections.length - 1; i += 2) {
      const x1 = Math.max(0, Math.floor(intersections[i]));
      const x2 = Math.min(gridWidth - 1, Math.ceil(intersections[i + 1]));
      for (let x = x1; x <= x2; x++) {
        grid[y * gridWidth + x] = 1;
      }
    }
  }
}

/**
 * Trace the outer contour of a binary grid using marching squares
 */
function traceContour(
  grid,
  gridWidth,
  gridHeight,
  offsetX,
  offsetY,
  resolution,
) {
  // Find starting point on the boundary
  let startX = -1,
    startY = -1;
  outer: for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (grid[y * gridWidth + x] === 1) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }

  if (startX === -1) {
    return [];
  }

  // Simple boundary tracing using 8-connectivity
  const contourPoints = [];
  const visited = new Set();

  // Direction vectors for 8-connectivity (clockwise from right)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let x = startX;
  let y = startY;
  let dir = 0; // Start by looking right

  // Add starting point
  contourPoints.push({ x, y });
  visited.add(`${x},${y}`);

  // Trace boundary
  let maxIterations = gridWidth * gridHeight * 2;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Look for next boundary pixel, starting from direction perpendicular to current
    let found = false;
    const startDir = (dir + 6) % 8; // Start looking from "left" relative to current direction

    for (let i = 0; i < 8; i++) {
      const checkDir = (startDir + i) % 8;
      const nx = x + dx[checkDir];
      const ny = y + dy[checkDir];

      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        if (grid[ny * gridWidth + nx] === 1) {
          // Check if this is a boundary pixel (has at least one empty neighbor)
          let isBoundary = false;
          for (let d = 0; d < 8; d++) {
            const bx = nx + dx[d];
            const by = ny + dy[d];
            if (
              bx < 0 ||
              bx >= gridWidth ||
              by < 0 ||
              by >= gridHeight ||
              grid[by * gridWidth + bx] === 0
            ) {
              isBoundary = true;
              break;
            }
          }

          if (isBoundary) {
            x = nx;
            y = ny;
            dir = checkDir;
            found = true;

            const key = `${x},${y}`;
            if (x === startX && y === startY && contourPoints.length > 2) {
              // Back to start
              found = false;
              break;
            }

            if (!visited.has(key)) {
              contourPoints.push({ x, y });
              visited.add(key);
            }
            break;
          }
        }
      }
    }

    if (!found) {
      break;
    }
  }

  // Convert grid coordinates back to original coordinates
  const result = [];

  // Simplify contour by removing collinear points
  const simplified = simplifyContour(contourPoints);

  for (const p of simplified) {
    result.push((p.x - 1) / resolution + offsetX);
    result.push((p.y - 1) / resolution + offsetY);
  }

  return result;
}

/**
 * Simplify contour by removing nearly collinear points
 */
function simplifyContour(points) {
  if (points.length <= 3) {
    return points;
  }

  const result = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Check if curr is on the line between prev and next
    const cross =
      (curr.x - prev.x) * (next.y - prev.y) -
      (curr.y - prev.y) * (next.x - prev.x);

    if (Math.abs(cross) > 0.5) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);

  // Ensure we have at least 3 points
  if (result.length < 3 && points.length >= 3) {
    return points;
  }

  return result;
}
