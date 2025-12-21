export function checkIncompleteSupercategories(
  currentImage,
  annotations,
  categories,
) {
  if (!currentImage) return null;

  const currentAnnotations = annotations[currentImage.id] || [];
  if (currentAnnotations.length === 0) return null;

  const annotatedCategoryIds = new Set(
    currentAnnotations.map((ann) => ann.category_id),
  );
  const annotatedSupercategories = new Set();

  categories.forEach((cat) => {
    if (
      annotatedCategoryIds.has(cat.id) &&
      cat.supercategory &&
      cat.supercategory !== "none"
    ) {
      annotatedSupercategories.add(cat.supercategory);
    }
  });

  const incompleteSupers = [];
  annotatedSupercategories.forEach((supercat) => {
    const allSubcats = categories.filter(
      (cat) => cat.supercategory === supercat,
    );
    const annotatedSubcats = allSubcats.filter((cat) =>
      annotatedCategoryIds.has(cat.id),
    );

    if (annotatedSubcats.length < allSubcats.length) {
      const missingSubcats = allSubcats.filter(
        (cat) => !annotatedCategoryIds.has(cat.id),
      );
      incompleteSupers.push({
        supercategory: supercat,
        missing: missingSubcats.map((cat) => cat.name),
        annotated: annotatedSubcats.map((cat) => cat.name),
      });
    }
  });

  return incompleteSupers.length > 0 ? incompleteSupers : null;
}
