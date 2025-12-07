import { isPointInPolygon } from './geometry.js';

export function findAnnotationAtPoint(x, y, annotations, _scaleX, _scaleY) {
  if (!annotations || annotations.length === 0) {
    return null;
  }

  for (let i = annotations.length - 1; i >= 0; i--) {
    const annotation = annotations[i];
    if (!annotation.segmentation) continue;

    for (const polygon of annotation.segmentation) {
      if (isPointInPolygon(x, y, polygon)) {
        return annotation.id;
      }
    }
  }

  return null;
}

export function getAnnotationBoundingBox(annotation, scaleX, scaleY) {
  if (!annotation || !annotation.segmentation || annotation.segmentation.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const polygon of annotation.segmentation) {
    for (let i = 0; i < polygon.length; i += 2) {
      const x = polygon[i] / scaleX;
      const y = polygon[i + 1] / scaleY;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (minX === Infinity) {
    return null;
  }

  return {
    x1: minX,
    y1: minY,
    x2: maxX,
    y2: maxY,
  };
}

export function boxesOverlap(box1, box2) {
  if (!box1 || !box2) {
    return false;
  }

  return !(box1.x2 < box2.x1 || box1.x1 > box2.x2 || box1.y2 < box2.y1 || box1.y1 > box2.y2);
}

export function findAnnotationsInBox(box, annotations, scaleX, scaleY) {
  if (!box || !annotations || annotations.length === 0) {
    return [];
  }

  const selectedIds = [];

  for (const annotation of annotations) {
    const annotationBox = getAnnotationBoundingBox(annotation, scaleX, scaleY);
    if (annotationBox && boxesOverlap(box, annotationBox)) {
      selectedIds.push(annotation.id);
    }
  }

  return selectedIds;
}
