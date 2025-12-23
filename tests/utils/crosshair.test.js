import {
  getCrosshairLines,
  isMouseInCanvas,
  CROSSHAIR_DEFAULTS,
} from "../../coco_label_tool/static/js/utils/crosshair.js";

describe("crosshair utilities", () => {
  describe("CROSSHAIR_DEFAULTS", () => {
    test("has expected default properties", () => {
      expect(CROSSHAIR_DEFAULTS).toHaveProperty("strokeStyle");
      expect(CROSSHAIR_DEFAULTS).toHaveProperty("lineWidth");
      expect(CROSSHAIR_DEFAULTS).toHaveProperty("dashPattern");
      expect(CROSSHAIR_DEFAULTS).toHaveProperty("globalAlpha");
    });

    test("has reasonable default values", () => {
      expect(CROSSHAIR_DEFAULTS.lineWidth).toBeGreaterThan(0);
      expect(CROSSHAIR_DEFAULTS.globalAlpha).toBeGreaterThan(0);
      expect(CROSSHAIR_DEFAULTS.globalAlpha).toBeLessThanOrEqual(1);
      expect(Array.isArray(CROSSHAIR_DEFAULTS.dashPattern)).toBe(true);
    });
  });

  describe("isMouseInCanvas", () => {
    test("returns true when mouse is inside canvas bounds", () => {
      expect(isMouseInCanvas(100, 100, 800, 600)).toBe(true);
      expect(isMouseInCanvas(0, 0, 800, 600)).toBe(true);
      expect(isMouseInCanvas(799, 599, 800, 600)).toBe(true);
    });

    test("returns false when mouse is outside canvas bounds", () => {
      expect(isMouseInCanvas(-1, 100, 800, 600)).toBe(false);
      expect(isMouseInCanvas(100, -1, 800, 600)).toBe(false);
      expect(isMouseInCanvas(800, 100, 800, 600)).toBe(false);
      expect(isMouseInCanvas(100, 600, 800, 600)).toBe(false);
    });

    test("returns false when mouse is at exact boundary", () => {
      // At width/height boundary is outside (0-indexed)
      expect(isMouseInCanvas(800, 0, 800, 600)).toBe(false);
      expect(isMouseInCanvas(0, 600, 800, 600)).toBe(false);
    });

    test("handles zero dimensions", () => {
      expect(isMouseInCanvas(0, 0, 0, 0)).toBe(false);
      expect(isMouseInCanvas(0, 0, 0, 100)).toBe(false);
      expect(isMouseInCanvas(0, 0, 100, 0)).toBe(false);
    });

    test("handles edge case at origin", () => {
      expect(isMouseInCanvas(0, 0, 1, 1)).toBe(true);
    });
  });

  describe("getCrosshairLines", () => {
    const canvasWidth = 800;
    const canvasHeight = 600;

    test("returns horizontal and vertical line coordinates", () => {
      const result = getCrosshairLines(400, 300, canvasWidth, canvasHeight);

      expect(result).toHaveProperty("horizontal");
      expect(result).toHaveProperty("vertical");
    });

    test("horizontal line spans full width at mouse Y", () => {
      const mouseY = 250;
      const result = getCrosshairLines(400, mouseY, canvasWidth, canvasHeight);

      expect(result.horizontal.x1).toBe(0);
      expect(result.horizontal.x2).toBe(canvasWidth);
      expect(result.horizontal.y1).toBe(mouseY);
      expect(result.horizontal.y2).toBe(mouseY);
    });

    test("vertical line spans full height at mouse X", () => {
      const mouseX = 350;
      const result = getCrosshairLines(mouseX, 300, canvasWidth, canvasHeight);

      expect(result.vertical.x1).toBe(mouseX);
      expect(result.vertical.x2).toBe(mouseX);
      expect(result.vertical.y1).toBe(0);
      expect(result.vertical.y2).toBe(canvasHeight);
    });

    test("lines intersect at mouse position", () => {
      const mouseX = 123;
      const mouseY = 456;
      const result = getCrosshairLines(
        mouseX,
        mouseY,
        canvasWidth,
        canvasHeight,
      );

      // Horizontal line passes through mouseY
      expect(result.horizontal.y1).toBe(mouseY);
      expect(result.horizontal.y2).toBe(mouseY);

      // Vertical line passes through mouseX
      expect(result.vertical.x1).toBe(mouseX);
      expect(result.vertical.x2).toBe(mouseX);
    });

    test("works at canvas edges", () => {
      // Top-left corner
      const topLeft = getCrosshairLines(0, 0, canvasWidth, canvasHeight);
      expect(topLeft.horizontal.y1).toBe(0);
      expect(topLeft.vertical.x1).toBe(0);

      // Bottom-right corner (just inside)
      const bottomRight = getCrosshairLines(
        799,
        599,
        canvasWidth,
        canvasHeight,
      );
      expect(bottomRight.horizontal.y1).toBe(599);
      expect(bottomRight.vertical.x1).toBe(799);
    });

    test("works with different canvas sizes", () => {
      const smallResult = getCrosshairLines(50, 50, 100, 100);
      expect(smallResult.horizontal.x2).toBe(100);
      expect(smallResult.vertical.y2).toBe(100);

      const largeResult = getCrosshairLines(1000, 500, 1920, 1080);
      expect(largeResult.horizontal.x2).toBe(1920);
      expect(largeResult.vertical.y2).toBe(1080);
    });

    test("handles fractional coordinates", () => {
      const result = getCrosshairLines(100.5, 200.7, canvasWidth, canvasHeight);

      expect(result.horizontal.y1).toBe(200.7);
      expect(result.vertical.x1).toBe(100.5);
    });
  });
});
