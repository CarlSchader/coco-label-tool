import {
  hashString,
  getSupercategoryColor,
  getCategoryColor,
  rgbToHex,
} from "../../static/js/utils/colors.js";

describe("hashString", () => {
  test("returns consistent hash for same string", () => {
    const hash1 = hashString("test");
    const hash2 = hashString("test");
    expect(hash1).toBe(hash2);
  });

  test("returns different hashes for different strings", () => {
    const hash1 = hashString("test1");
    const hash2 = hashString("test2");
    expect(hash1).not.toBe(hash2);
  });

  test("returns positive number", () => {
    const hash = hashString("test");
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  test("handles empty string", () => {
    const hash = hashString("");
    expect(hash).toBe(0);
  });
});

describe("getSupercategoryColor", () => {
  const mockCategories = [
    { id: 1, name: "cat1", supercategory: "animal" },
    { id: 2, name: "cat2", supercategory: "vehicle" },
    { id: 3, name: "cat3", supercategory: "animal" },
  ];

  test("returns gray for none supercategory", () => {
    const supercategoryColors = {};
    const color = getSupercategoryColor(
      "none",
      mockCategories,
      supercategoryColors,
    );
    expect(color).toEqual([180, 180, 180]);
  });

  test("returns gray for null supercategory", () => {
    const supercategoryColors = {};
    const color = getSupercategoryColor(
      null,
      mockCategories,
      supercategoryColors,
    );
    expect(color).toEqual([180, 180, 180]);
  });

  test("caches supercategory color", () => {
    const supercategoryColors = {};
    const color1 = getSupercategoryColor(
      "animal",
      mockCategories,
      supercategoryColors,
    );
    const color2 = getSupercategoryColor(
      "animal",
      mockCategories,
      supercategoryColors,
    );

    expect(color1).toEqual(color2);
    expect(supercategoryColors["animal"]).toEqual(color1);
  });

  test("returns different colors for different supercategories", () => {
    const supercategoryColors = {};
    const color1 = getSupercategoryColor(
      "animal",
      mockCategories,
      supercategoryColors,
    );
    const color2 = getSupercategoryColor(
      "vehicle",
      mockCategories,
      supercategoryColors,
    );

    expect(color1).not.toEqual(color2);
  });

  test("returns RGB array with 3 elements", () => {
    const supercategoryColors = {};
    const color = getSupercategoryColor(
      "animal",
      mockCategories,
      supercategoryColors,
    );

    expect(Array.isArray(color)).toBe(true);
    expect(color.length).toBe(3);
  });
});

describe("getCategoryColor", () => {
  const mockCategories = [
    { id: 1, name: "dog", supercategory: "animal" },
    { id: 2, name: "cat", supercategory: "animal" },
    { id: 3, name: "car", supercategory: "vehicle" },
  ];

  test("returns gray for null category", () => {
    const supercategoryColors = {};
    const categoryColors = {};
    const color = getCategoryColor(
      null,
      mockCategories,
      supercategoryColors,
      categoryColors,
    );
    expect(color).toEqual([180, 180, 180]);
  });

  test("caches category color", () => {
    const supercategoryColors = {};
    const categoryColors = {};
    const category = mockCategories[0];

    const color1 = getCategoryColor(
      category,
      mockCategories,
      supercategoryColors,
      categoryColors,
    );
    const color2 = getCategoryColor(
      category,
      mockCategories,
      supercategoryColors,
      categoryColors,
    );

    expect(color1).toEqual(color2);
    const key = category.id + "_" + category.name;
    expect(categoryColors[key]).toEqual(color1);
  });

  test("returns base color for single category in supercategory", () => {
    const supercategoryColors = {};
    const categoryColors = {};
    const singleCategories = [{ id: 1, name: "car", supercategory: "vehicle" }];

    const category = singleCategories[0];
    const color = getCategoryColor(
      category,
      singleCategories,
      supercategoryColors,
      categoryColors,
    );
    const superColor = getSupercategoryColor(
      "vehicle",
      singleCategories,
      supercategoryColors,
    );

    expect(color).toEqual(superColor);
  });

  test("returns different brightness for multiple categories in supercategory", () => {
    const supercategoryColors = {};
    const categoryColors = {};

    const color1 = getCategoryColor(
      mockCategories[0],
      mockCategories,
      supercategoryColors,
      categoryColors,
    );
    const color2 = getCategoryColor(
      mockCategories[1],
      mockCategories,
      supercategoryColors,
      categoryColors,
    );

    expect(color1).not.toEqual(color2);
  });

  test("returns RGB array with 3 elements", () => {
    const supercategoryColors = {};
    const categoryColors = {};
    const category = mockCategories[0];

    const color = getCategoryColor(
      category,
      mockCategories,
      supercategoryColors,
      categoryColors,
    );

    expect(Array.isArray(color)).toBe(true);
    expect(color.length).toBe(3);
  });

  test("RGB values are within valid range", () => {
    const supercategoryColors = {};
    const categoryColors = {};
    const category = mockCategories[0];

    const color = getCategoryColor(
      category,
      mockCategories,
      supercategoryColors,
      categoryColors,
    );

    color.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    });
  });
});

describe("rgbToHex", () => {
  test("converts RGB to hex correctly", () => {
    expect(rgbToHex([255, 0, 0])).toBe("#ff0000");
    expect(rgbToHex([0, 255, 0])).toBe("#00ff00");
    expect(rgbToHex([0, 0, 255])).toBe("#0000ff");
  });

  test("handles zero padding", () => {
    expect(rgbToHex([10, 20, 30])).toBe("#0a141e");
  });

  test("handles white", () => {
    expect(rgbToHex([255, 255, 255])).toBe("#ffffff");
  });

  test("handles black", () => {
    expect(rgbToHex([0, 0, 0])).toBe("#000000");
  });

  test("handles gray", () => {
    expect(rgbToHex([180, 180, 180])).toBe("#b4b4b4");
  });
});
