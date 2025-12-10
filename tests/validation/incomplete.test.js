import { checkIncompleteSupercategories } from "../../static/js/validation/incomplete.js";

describe("checkIncompleteSupercategories", () => {
  const mockCategories = [
    { id: 1, name: "dog", supercategory: "animal" },
    { id: 2, name: "cat", supercategory: "animal" },
    { id: 3, name: "bird", supercategory: "animal" },
    { id: 4, name: "car", supercategory: "vehicle" },
    { id: 5, name: "truck", supercategory: "vehicle" },
  ];

  test("returns null when currentImage is null", () => {
    const annotations = {};
    const result = checkIncompleteSupercategories(
      null,
      annotations,
      mockCategories,
    );
    expect(result).toBeNull();
  });

  test("returns null when no annotations exist for image", () => {
    const currentImage = { id: 1 };
    const annotations = {};
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );
    expect(result).toBeNull();
  });

  test("returns null when annotations array is empty", () => {
    const currentImage = { id: 1 };
    const annotations = { 1: [] };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );
    expect(result).toBeNull();
  });

  test("returns null when all categories in supercategory are annotated", () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 2 },
        { id: 103, category_id: 3 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );
    expect(result).toBeNull();
  });

  test("detects incomplete supercategory with one missing subcategory", () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 2 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].supercategory).toBe("animal");
    expect(result[0].annotated).toEqual(["dog", "cat"]);
    expect(result[0].missing).toEqual(["bird"]);
  });

  test("detects multiple incomplete supercategories", () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 4 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(2);

    const animalSuper = result.find((r) => r.supercategory === "animal");
    expect(animalSuper).toBeDefined();
    expect(animalSuper.annotated).toEqual(["dog"]);
    expect(animalSuper.missing).toEqual(["cat", "bird"]);

    const vehicleSuper = result.find((r) => r.supercategory === "vehicle");
    expect(vehicleSuper).toBeDefined();
    expect(vehicleSuper.annotated).toEqual(["car"]);
    expect(vehicleSuper.missing).toEqual(["truck"]);
  });

  test("handles supercategory with only one category", () => {
    const currentImage = { id: 1 };
    const singleCatSuper = [{ id: 1, name: "unique", supercategory: "rare" }];
    const annotations = {
      1: [{ id: 101, category_id: 1 }],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      singleCatSuper,
    );

    expect(result).toBeNull();
  });

  test("ignores annotations with unknown category_id", () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 999 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].supercategory).toBe("animal");
  });

  test("handles multiple images correctly", () => {
    const currentImage = { id: 2 };
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 2 },
        { id: 103, category_id: 3 },
      ],
      2: [{ id: 201, category_id: 1 }],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].supercategory).toBe("animal");
    expect(result[0].annotated).toEqual(["dog"]);
    expect(result[0].missing).toEqual(["cat", "bird"]);
  });

  test("handles duplicate annotations for same category", () => {
    const currentImage = { id: 1 };
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 1 },
        { id: 103, category_id: 2 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      mockCategories,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].annotated).toEqual(["dog", "cat"]);
    expect(result[0].missing).toEqual(["bird"]);
  });

  test('ignores categories with supercategory "none"', () => {
    const currentImage = { id: 1 };
    const categoriesWithNone = [
      { id: 1, name: "dog", supercategory: "animal" },
      { id: 2, name: "cat", supercategory: "animal" },
      { id: 3, name: "standalone", supercategory: "none" },
    ];
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 3 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      categoriesWithNone,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].supercategory).toBe("animal");
    expect(result[0].missing).toEqual(["cat"]);
  });

  test("ignores categories with null supercategory", () => {
    const currentImage = { id: 1 };
    const categoriesWithNull = [
      { id: 1, name: "dog", supercategory: "animal" },
      { id: 2, name: "cat", supercategory: "animal" },
      { id: 3, name: "standalone", supercategory: null },
    ];
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 3 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      categoriesWithNull,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].supercategory).toBe("animal");
    expect(result[0].missing).toEqual(["cat"]);
  });

  test("ignores categories with empty string supercategory", () => {
    const currentImage = { id: 1 };
    const categoriesWithEmpty = [
      { id: 1, name: "dog", supercategory: "animal" },
      { id: 2, name: "cat", supercategory: "animal" },
      { id: 3, name: "standalone", supercategory: "" },
    ];
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 3 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      categoriesWithEmpty,
    );

    expect(result).not.toBeNull();
    expect(result.length).toBe(1);
    expect(result[0].supercategory).toBe("animal");
    expect(result[0].missing).toEqual(["cat"]);
  });

  test("returns null when only categories without supercategory are annotated", () => {
    const currentImage = { id: 1 };
    const categoriesWithNone = [
      { id: 1, name: "standalone1", supercategory: "none" },
      { id: 2, name: "standalone2", supercategory: null },
      { id: 3, name: "standalone3", supercategory: "" },
    ];
    const annotations = {
      1: [
        { id: 101, category_id: 1 },
        { id: 102, category_id: 2 },
        { id: 103, category_id: 3 },
      ],
    };
    const result = checkIncompleteSupercategories(
      currentImage,
      annotations,
      categoriesWithNone,
    );

    expect(result).toBeNull();
  });
});
