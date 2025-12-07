import { CONFIG } from '../config.js';

export function isPolygonInsidePolygon(innerSegmentation, outerSegmentation) {
  if (!innerSegmentation || !outerSegmentation) return false;
  if (innerSegmentation.length === 0 || outerSegmentation.length === 0) return false;

  const innerPolygon = innerSegmentation[0];
  const outerPolygon = outerSegmentation[0];

  if (!innerPolygon || !outerPolygon) return false;
  if (innerPolygon.length < 6 || outerPolygon.length < 6) return false;

  let pointsInside = 0;
  let totalPoints = 0;

  for (let i = 0; i < innerPolygon.length; i += 2) {
    const x = innerPolygon[i];
    const y = innerPolygon[i + 1];

    if (isPointInPolygon(x, y, outerPolygon)) {
      pointsInside++;
    }
    totalPoints++;
  }

  return pointsInside > totalPoints * CONFIG.validation.containmentThreshold;
}

export function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; i += 2) {
    const xi = polygon[i];
    const yi = polygon[i + 1];
    const xj = polygon[j];
    const yj = polygon[j + 1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;

    j = i;
  }
  return inside;
}
