import { CONFIG } from '../config.js';

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getSupercategoryColor(supercategory, categories, supercategoryColors) {
  if (!supercategory || supercategory === 'none') {
    return [180, 180, 180];
  }
  if (!supercategoryColors[supercategory]) {
    const allSupercategories = [
      ...new Set(categories.map((c) => c.supercategory).filter((s) => s && s !== 'none')),
    ];
    const sortedSupers = allSupercategories.sort();
    const index = sortedSupers.indexOf(supercategory);
    if (index >= 0) {
      supercategoryColors[supercategory] =
        CONFIG.primaryColors[index % CONFIG.primaryColors.length];
    } else {
      const fallbackIndex = hashString(supercategory) % CONFIG.primaryColors.length;
      supercategoryColors[supercategory] = CONFIG.primaryColors[fallbackIndex];
    }
  }
  return supercategoryColors[supercategory];
}

export function getCategoryColor(category, categories, supercategoryColors, categoryColors) {
  if (!category) {
    return [180, 180, 180];
  }
  const categoryKey = category.id + '_' + category.name;
  if (!categoryColors[categoryKey]) {
    const baseColor = getSupercategoryColor(
      category.supercategory,
      categories,
      supercategoryColors
    );
    const categoriesInSuper = categories.filter((c) => c.supercategory === category.supercategory);
    const indexInSuper = categoriesInSuper.findIndex((c) => c.id === category.id);
    const numInSuper = categoriesInSuper.length;

    if (numInSuper === 1) {
      categoryColors[categoryKey] = baseColor;
    } else {
      const brightness = 0.6 + (indexInSuper / (numInSuper - 1)) * 0.8;

      const r = Math.min(255, Math.round(baseColor[0] * brightness));
      const g = Math.min(255, Math.round(baseColor[1] * brightness));
      const b = Math.min(255, Math.round(baseColor[2] * brightness));

      categoryColors[categoryKey] = [r, g, b];
    }
  }
  return categoryColors[categoryKey];
}

export function rgbToHex(rgb) {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}
