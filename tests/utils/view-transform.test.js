/**
 * Tests for ViewTransform utility class.
 */

import { ViewTransform } from "../../coco_label_tool/static/js/utils/view-transform.js";

describe("ViewTransform", () => {
  let transform;

  beforeEach(() => {
    transform = new ViewTransform();
  });

  describe("constructor", () => {
    test("initializes with default values", () => {
      expect(transform.scale).toBe(1);
      expect(transform.panX).toBe(0);
      expect(transform.panY).toBe(0);
    });
  });

  describe("static constants", () => {
    test("has MIN_SCALE constant", () => {
      expect(ViewTransform.MIN_SCALE).toBe(0.1);
    });

    test("has MAX_SCALE constant", () => {
      expect(ViewTransform.MAX_SCALE).toBe(10);
    });

    test("has ZOOM_FACTOR constant", () => {
      expect(ViewTransform.ZOOM_FACTOR).toBe(1.1);
    });
  });

  describe("screenToNatural", () => {
    test("returns same coordinates at default transform with 1:1 image scale", () => {
      const [x, y] = transform.screenToNatural(100, 200, 1, 1);
      expect(x).toBe(100);
      expect(y).toBe(200);
    });

    test("applies image scale correctly", () => {
      // Image is displayed at half size (imageScale = 2 means natural is 2x screen)
      const [x, y] = transform.screenToNatural(100, 200, 2, 2);
      expect(x).toBe(200);
      expect(y).toBe(400);
    });

    test("applies pan offset correctly", () => {
      transform.panX = 50;
      transform.panY = 100;
      const [x, y] = transform.screenToNatural(150, 300, 1, 1);
      expect(x).toBe(100); // 150 - 50
      expect(y).toBe(200); // 300 - 100
    });

    test("applies zoom scale correctly", () => {
      transform.scale = 2; // Zoomed in 2x
      const [x, y] = transform.screenToNatural(200, 400, 1, 1);
      expect(x).toBe(100); // 200 / 2
      expect(y).toBe(200); // 400 / 2
    });

    test("applies combined transform correctly", () => {
      transform.scale = 2;
      transform.panX = 100;
      transform.panY = 50;
      // Screen (300, 250) -> subtract pan (200, 200) -> divide by zoom (100, 100) -> multiply by imageScale
      const [x, y] = transform.screenToNatural(300, 250, 1, 1);
      expect(x).toBe(100);
      expect(y).toBe(100);
    });

    test("handles different x and y image scales", () => {
      const [x, y] = transform.screenToNatural(100, 100, 2, 4);
      expect(x).toBe(200);
      expect(y).toBe(400);
    });
  });

  describe("naturalToScreen", () => {
    test("returns same coordinates at default transform with 1:1 image scale", () => {
      const [x, y] = transform.naturalToScreen(100, 200, 1, 1);
      expect(x).toBe(100);
      expect(y).toBe(200);
    });

    test("applies image scale correctly", () => {
      const [x, y] = transform.naturalToScreen(200, 400, 2, 2);
      expect(x).toBe(100);
      expect(y).toBe(200);
    });

    test("applies pan offset correctly", () => {
      transform.panX = 50;
      transform.panY = 100;
      const [x, y] = transform.naturalToScreen(100, 200, 1, 1);
      expect(x).toBe(150);
      expect(y).toBe(300);
    });

    test("applies zoom scale correctly", () => {
      transform.scale = 2;
      const [x, y] = transform.naturalToScreen(100, 200, 1, 1);
      expect(x).toBe(200);
      expect(y).toBe(400);
    });

    test("roundtrip conversion is accurate", () => {
      transform.scale = 1.5;
      transform.panX = 75;
      transform.panY = -30;
      const imageScaleX = 1.2;
      const imageScaleY = 0.8;

      const originalX = 150;
      const originalY = 250;

      const [screenX, screenY] = transform.naturalToScreen(
        originalX,
        originalY,
        imageScaleX,
        imageScaleY,
      );
      const [backX, backY] = transform.screenToNatural(
        screenX,
        screenY,
        imageScaleX,
        imageScaleY,
      );

      expect(backX).toBeCloseTo(originalX, 10);
      expect(backY).toBeCloseTo(originalY, 10);
    });
  });

  describe("zoomIn", () => {
    test("increases scale by ZOOM_FACTOR (multiplicative)", () => {
      transform.zoomIn(0, 0);
      expect(transform.scale).toBeCloseTo(1.1, 10); // 1 * 1.1 = 1.1
    });

    test("zoom is multiplicative - consistent percentage at different scales", () => {
      // At scale 2, zooming in should give 2 * 1.1 = 2.2
      transform.scale = 2;
      transform.zoomIn(0, 0);
      expect(transform.scale).toBeCloseTo(2.2, 10);

      // At scale 0.5, zooming in should give 0.5 * 1.1 = 0.55
      transform.scale = 0.5;
      transform.zoomIn(0, 0);
      expect(transform.scale).toBeCloseTo(0.55, 10);
    });

    test("respects MAX_SCALE limit", () => {
      transform.scale = ViewTransform.MAX_SCALE;
      transform.zoomIn(0, 0);
      expect(transform.scale).toBe(ViewTransform.MAX_SCALE);
    });

    test("zooms centered on provided point", () => {
      const centerX = 200;
      const centerY = 150;

      // Get initial screen position of center in natural coords
      const [naturalX, naturalY] = transform.screenToNatural(
        centerX,
        centerY,
        1,
        1,
      );

      transform.zoomIn(centerX, centerY);

      // After zoom, the same natural point should still be at the center
      const [newScreenX, newScreenY] = transform.naturalToScreen(
        naturalX,
        naturalY,
        1,
        1,
      );

      expect(newScreenX).toBeCloseTo(centerX, 5);
      expect(newScreenY).toBeCloseTo(centerY, 5);
    });
  });

  describe("zoomOut", () => {
    test("decreases scale by ZOOM_FACTOR (multiplicative)", () => {
      transform.zoomOut(0, 0);
      expect(transform.scale).toBeCloseTo(1 / 1.1, 10); // ~0.909
    });

    test("zoom out is multiplicative - consistent percentage at different scales", () => {
      // At scale 2, zooming out should give 2 / 1.1 = ~1.818
      transform.scale = 2;
      transform.zoomOut(0, 0);
      expect(transform.scale).toBeCloseTo(2 / 1.1, 10);

      // At scale 5, zooming out should give 5 / 1.1 = ~4.545
      transform.scale = 5;
      transform.zoomOut(0, 0);
      expect(transform.scale).toBeCloseTo(5 / 1.1, 10);
    });

    test("respects MIN_SCALE limit", () => {
      transform.scale = ViewTransform.MIN_SCALE;
      transform.zoomOut(0, 0);
      expect(transform.scale).toBe(ViewTransform.MIN_SCALE);
    });

    test("zooms centered on provided point", () => {
      transform.scale = 2;
      const centerX = 200;
      const centerY = 150;

      const [naturalX, naturalY] = transform.screenToNatural(
        centerX,
        centerY,
        1,
        1,
      );

      transform.zoomOut(centerX, centerY);

      const [newScreenX, newScreenY] = transform.naturalToScreen(
        naturalX,
        naturalY,
        1,
        1,
      );

      expect(newScreenX).toBeCloseTo(centerX, 5);
      expect(newScreenY).toBeCloseTo(centerY, 5);
    });
  });

  describe("zoomTo", () => {
    test("sets scale to specified value", () => {
      transform.zoomTo(2.5, 0, 0);
      expect(transform.scale).toBe(2.5);
    });

    test("clamps scale to MIN_SCALE", () => {
      transform.zoomTo(0.01, 0, 0);
      expect(transform.scale).toBe(ViewTransform.MIN_SCALE);
    });

    test("clamps scale to MAX_SCALE", () => {
      transform.zoomTo(100, 0, 0);
      expect(transform.scale).toBe(ViewTransform.MAX_SCALE);
    });

    test("keeps center point fixed on screen", () => {
      transform.scale = 1;
      transform.panX = 50;
      transform.panY = 30;

      const centerX = 300;
      const centerY = 200;

      const [naturalX, naturalY] = transform.screenToNatural(
        centerX,
        centerY,
        1,
        1,
      );

      transform.zoomTo(3, centerX, centerY);

      const [newScreenX, newScreenY] = transform.naturalToScreen(
        naturalX,
        naturalY,
        1,
        1,
      );

      expect(newScreenX).toBeCloseTo(centerX, 5);
      expect(newScreenY).toBeCloseTo(centerY, 5);
    });
  });

  describe("pan", () => {
    test("adds delta to panX and panY", () => {
      transform.pan(100, -50);
      expect(transform.panX).toBe(100);
      expect(transform.panY).toBe(-50);
    });

    test("accumulates multiple pan calls", () => {
      transform.pan(50, 30);
      transform.pan(25, -10);
      expect(transform.panX).toBe(75);
      expect(transform.panY).toBe(20);
    });

    test("handles negative deltas", () => {
      transform.pan(-100, -200);
      expect(transform.panX).toBe(-100);
      expect(transform.panY).toBe(-200);
    });
  });

  describe("reset", () => {
    test("resets scale to 1", () => {
      transform.scale = 5;
      transform.reset();
      expect(transform.scale).toBe(1);
    });

    test("resets panX to 0", () => {
      transform.panX = 100;
      transform.reset();
      expect(transform.panX).toBe(0);
    });

    test("resets panY to 0", () => {
      transform.panY = -50;
      transform.reset();
      expect(transform.panY).toBe(0);
    });

    test("resets all values together", () => {
      transform.scale = 3;
      transform.panX = 200;
      transform.panY = -100;
      transform.reset();
      expect(transform.scale).toBe(1);
      expect(transform.panX).toBe(0);
      expect(transform.panY).toBe(0);
    });
  });

  describe("getScalePercent", () => {
    test("returns 100% at default scale", () => {
      expect(transform.getScalePercent()).toBe("100%");
    });

    test("returns 200% at 2x scale", () => {
      transform.scale = 2;
      expect(transform.getScalePercent()).toBe("200%");
    });

    test("returns 50% at 0.5x scale", () => {
      transform.scale = 0.5;
      expect(transform.getScalePercent()).toBe("50%");
    });

    test("rounds to nearest integer", () => {
      transform.scale = 1.234;
      expect(transform.getScalePercent()).toBe("123%");
    });

    test("handles MIN_SCALE", () => {
      transform.scale = ViewTransform.MIN_SCALE;
      expect(transform.getScalePercent()).toBe("10%");
    });

    test("handles MAX_SCALE", () => {
      transform.scale = ViewTransform.MAX_SCALE;
      expect(transform.getScalePercent()).toBe("1000%");
    });
  });

  describe("isAtDefaultView", () => {
    test("returns true at default values", () => {
      expect(transform.isAtDefaultView()).toBe(true);
    });

    test("returns false when zoomed", () => {
      transform.scale = 2;
      expect(transform.isAtDefaultView()).toBe(false);
    });

    test("returns false when panned horizontally", () => {
      transform.panX = 10;
      expect(transform.isAtDefaultView()).toBe(false);
    });

    test("returns false when panned vertically", () => {
      transform.panY = -5;
      expect(transform.isAtDefaultView()).toBe(false);
    });

    test("returns true after reset", () => {
      transform.scale = 3;
      transform.panX = 100;
      transform.panY = -50;
      transform.reset();
      expect(transform.isAtDefaultView()).toBe(true);
    });
  });

  describe("getTransformMatrix", () => {
    test("returns identity matrix at default values", () => {
      const matrix = transform.getTransformMatrix();
      expect(matrix).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    });

    test("returns correct matrix when zoomed", () => {
      transform.scale = 2;
      const matrix = transform.getTransformMatrix();
      expect(matrix).toEqual({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
    });

    test("returns correct matrix when panned", () => {
      transform.panX = 100;
      transform.panY = 50;
      const matrix = transform.getTransformMatrix();
      expect(matrix).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 100, f: 50 });
    });

    test("returns correct matrix with combined transform", () => {
      transform.scale = 1.5;
      transform.panX = 75;
      transform.panY = -30;
      const matrix = transform.getTransformMatrix();
      expect(matrix).toEqual({ a: 1.5, b: 0, c: 0, d: 1.5, e: 75, f: -30 });
    });
  });

  describe("edge cases", () => {
    test("handles zero coordinates", () => {
      const [x, y] = transform.screenToNatural(0, 0, 1, 1);
      expect(x).toBe(0);
      expect(y).toBe(0);
    });

    test("handles very small scale", () => {
      transform.scale = ViewTransform.MIN_SCALE;
      const [x, y] = transform.screenToNatural(10, 10, 1, 1);
      expect(x).toBeCloseTo(100, 5);
      expect(y).toBeCloseTo(100, 5);
    });

    test("handles very large scale", () => {
      transform.scale = ViewTransform.MAX_SCALE;
      const [x, y] = transform.screenToNatural(100, 100, 1, 1);
      expect(x).toBeCloseTo(10, 5);
      expect(y).toBeCloseTo(10, 5);
    });

    test("handles negative pan values", () => {
      transform.panX = -100;
      transform.panY = -200;
      const [x, y] = transform.screenToNatural(0, 0, 1, 1);
      expect(x).toBe(100);
      expect(y).toBe(200);
    });
  });
});
