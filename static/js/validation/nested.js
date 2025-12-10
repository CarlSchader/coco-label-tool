import { isPolygonInsidePolygon } from "../utils/geometry.js";

export function checkNestedMaskSupercategoryMismatch(
  currentImage,
  annotations,
  categories,
) {
  if (!currentImage) return null;

  const currentAnnotations = annotations[currentImage.id] || [];
  if (currentAnnotations.length < 2) return null;

  const categoryMap = {};
  categories.forEach((cat) => {
    categoryMap[cat.id] = cat;
  });

  const mismatches = [];

  for (let i = 0; i < currentAnnotations.length; i++) {
    for (let j = 0; j < currentAnnotations.length; j++) {
      if (i === j) continue;

      const annA = currentAnnotations[i];
      const annB = currentAnnotations[j];
      const catA = categoryMap[annA.category_id];
      const catB = categoryMap[annB.category_id];

      if (!catA || !catB) continue;
      if (catA.supercategory === catB.supercategory) continue;

      if (isPolygonInsidePolygon(annA.segmentation, annB.segmentation)) {
        const alreadyExists = mismatches.some(
          (m) =>
            (m.inner.id === annA.id && m.outer.id === annB.id) ||
            (m.inner.id === annB.id && m.outer.id === annA.id),
        );

        if (!alreadyExists) {
          mismatches.push({
            inner: {
              id: annA.id,
              category: catA.name,
              supercategory: catA.supercategory,
            },
            outer: {
              id: annB.id,
              category: catB.name,
              supercategory: catB.supercategory,
            },
          });
        }
      }
    }
  }

  return mismatches.length > 0 ? mismatches : null;
}
