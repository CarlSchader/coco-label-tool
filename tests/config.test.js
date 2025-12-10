import { CONFIG } from "../static/js/config.js";

describe("CONFIG object structure", () => {
  test("CONFIG object exists", () => {
    expect(CONFIG).toBeDefined();
    expect(typeof CONFIG).toBe("object");
  });

  test("has canvas configuration", () => {
    expect(CONFIG.canvas).toBeDefined();
    expect(typeof CONFIG.canvas).toBe("object");
  });

  test("has colors configuration", () => {
    expect(CONFIG.colors).toBeDefined();
    expect(typeof CONFIG.colors).toBe("object");
  });

  test("has validation configuration", () => {
    expect(CONFIG.validation).toBeDefined();
    expect(typeof CONFIG.validation).toBe("object");
  });

  test("has cache configuration", () => {
    expect(CONFIG.cache).toBeDefined();
    expect(typeof CONFIG.cache).toBe("object");
  });

  test("has api configuration", () => {
    expect(CONFIG.api).toBeDefined();
    expect(typeof CONFIG.api).toBe("object");
  });

  test("has primaryColors array", () => {
    expect(CONFIG.primaryColors).toBeDefined();
    expect(Array.isArray(CONFIG.primaryColors)).toBe(true);
  });
});

describe("CONFIG.canvas properties", () => {
  test("has valid numeric properties", () => {
    expect(typeof CONFIG.canvas.pointRadius).toBe("number");
    expect(typeof CONFIG.canvas.pointHoverRadius).toBe("number");
    expect(typeof CONFIG.canvas.pointHoverGlowRadius).toBe("number");
    expect(typeof CONFIG.canvas.deleteButtonSize).toBe("number");
    expect(typeof CONFIG.canvas.hoverHitArea).toBe("number");
    expect(typeof CONFIG.canvas.lineWidth).toBe("number");
    expect(typeof CONFIG.canvas.lineWidthHover).toBe("number");
    expect(typeof CONFIG.canvas.minBoxSize).toBe("number");
  });

  test("has positive numeric values", () => {
    expect(CONFIG.canvas.pointRadius).toBeGreaterThan(0);
    expect(CONFIG.canvas.pointHoverRadius).toBeGreaterThan(0);
    expect(CONFIG.canvas.deleteButtonSize).toBeGreaterThan(0);
    expect(CONFIG.canvas.hoverHitArea).toBeGreaterThan(0);
    expect(CONFIG.canvas.lineWidth).toBeGreaterThan(0);
    expect(CONFIG.canvas.minBoxSize).toBeGreaterThan(0);
  });

  test("hover radius is larger than point radius", () => {
    expect(CONFIG.canvas.pointHoverRadius).toBeGreaterThan(
      CONFIG.canvas.pointRadius,
    );
  });

  test("hover glow radius is larger than hover radius", () => {
    expect(CONFIG.canvas.pointHoverGlowRadius).toBeGreaterThan(
      CONFIG.canvas.pointHoverRadius,
    );
  });
});

describe("CONFIG.colors properties", () => {
  test("has all required color properties", () => {
    expect(CONFIG.colors.positive).toBeDefined();
    expect(CONFIG.colors.negative).toBeDefined();
    expect(CONFIG.colors.hover).toBeDefined();
    expect(CONFIG.colors.segmentation).toBeDefined();
    expect(CONFIG.colors.segmentationBorder).toBeDefined();
    expect(CONFIG.colors.boxBorder).toBeDefined();
    expect(CONFIG.colors.boxBorderHover).toBeDefined();
    expect(CONFIG.colors.deleteButton).toBeDefined();
    expect(CONFIG.colors.deleteButtonHover).toBeDefined();
    expect(CONFIG.colors.white).toBeDefined();
  });

  test("all colors are strings", () => {
    Object.values(CONFIG.colors).forEach((color) => {
      expect(typeof color).toBe("string");
    });
  });

  test("hex colors are valid format", () => {
    const hexColors = [
      CONFIG.colors.positive,
      CONFIG.colors.negative,
      CONFIG.colors.hover,
      CONFIG.colors.segmentationBorder,
      CONFIG.colors.boxBorder,
      CONFIG.colors.boxBorderHover,
      CONFIG.colors.deleteButton,
      CONFIG.colors.deleteButtonHover,
      CONFIG.colors.white,
    ];

    hexColors.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  test("rgba color has valid format", () => {
    expect(CONFIG.colors.segmentation).toMatch(
      /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/,
    );
  });
});

describe("CONFIG.validation properties", () => {
  test("has containmentThreshold as number", () => {
    expect(typeof CONFIG.validation.containmentThreshold).toBe("number");
  });

  test("containmentThreshold is between 0 and 1", () => {
    expect(CONFIG.validation.containmentThreshold).toBeGreaterThan(0);
    expect(CONFIG.validation.containmentThreshold).toBeLessThanOrEqual(1);
  });

  test("has minPolygonPoints as positive integer", () => {
    expect(typeof CONFIG.validation.minPolygonPoints).toBe("number");
    expect(CONFIG.validation.minPolygonPoints).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG.validation.minPolygonPoints)).toBe(true);
  });
});

describe("CONFIG.cache properties", () => {
  test("has refreshThreshold as positive integer", () => {
    expect(typeof CONFIG.cache.refreshThreshold).toBe("number");
    expect(CONFIG.cache.refreshThreshold).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG.cache.refreshThreshold)).toBe(true);
  });

  test("has margin as positive integer", () => {
    expect(typeof CONFIG.cache.margin).toBe("number");
    expect(CONFIG.cache.margin).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG.cache.margin)).toBe(true);
  });

  test("margin is larger than refreshThreshold", () => {
    expect(CONFIG.cache.margin).toBeGreaterThan(CONFIG.cache.refreshThreshold);
  });
});

describe("CONFIG.api properties", () => {
  test("has timeout as positive number", () => {
    expect(typeof CONFIG.api.timeout).toBe("number");
    expect(CONFIG.api.timeout).toBeGreaterThan(0);
  });

  test("has headers object", () => {
    expect(typeof CONFIG.api.headers).toBe("object");
    expect(CONFIG.api.headers).not.toBeNull();
  });

  test("headers contains Content-Type", () => {
    expect(CONFIG.api.headers["Content-Type"]).toBeDefined();
    expect(CONFIG.api.headers["Content-Type"]).toBe("application/json");
  });
});

describe("CONFIG.primaryColors array", () => {
  test("has exactly 56 colors", () => {
    expect(CONFIG.primaryColors.length).toBe(56);
  });

  test("each color is an RGB array", () => {
    CONFIG.primaryColors.forEach((color) => {
      expect(Array.isArray(color)).toBe(true);
      expect(color.length).toBe(3);
    });
  });

  test("all RGB values are valid (0-255)", () => {
    CONFIG.primaryColors.forEach((color) => {
      color.forEach((value) => {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(255);
        expect(Number.isInteger(value)).toBe(true);
      });
    });
  });

  test("colors are unique", () => {
    const colorStrings = CONFIG.primaryColors.map((c) => JSON.stringify(c));
    const uniqueColors = new Set(colorStrings);
    expect(uniqueColors.size).toBe(CONFIG.primaryColors.length);
  });
});
