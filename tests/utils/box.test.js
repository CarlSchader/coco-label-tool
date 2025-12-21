import {
  detectBoxInteraction,
  calculateBoxResize,
  normalizeBox,
  getCursorForBoxInteraction,
} from "../../coco_label_tool/static/js/utils/box.js";

describe("detectBoxInteraction", () => {
  const box = { x1: 100, y1: 100, x2: 300, y2: 200 };
  const scaleX = 1;
  const scaleY = 1;

  describe("corner detection", () => {
    test("detects northwest corner", () => {
      const result = detectBoxInteraction(100, 100, box, scaleX, scaleY);
      expect(result).toEqual({ type: "corner", corner: "nw" });
    });

    test("detects northeast corner", () => {
      const result = detectBoxInteraction(300, 100, box, scaleX, scaleY);
      expect(result).toEqual({ type: "corner", corner: "ne" });
    });

    test("detects southwest corner", () => {
      const result = detectBoxInteraction(100, 200, box, scaleX, scaleY);
      expect(result).toEqual({ type: "corner", corner: "sw" });
    });

    test("detects southeast corner", () => {
      const result = detectBoxInteraction(300, 200, box, scaleX, scaleY);
      expect(result).toEqual({ type: "corner", corner: "se" });
    });

    test("detects corner within threshold (12px)", () => {
      const result = detectBoxInteraction(105, 105, box, scaleX, scaleY);
      expect(result).toEqual({ type: "corner", corner: "nw" });
    });

    test("does not detect corner outside threshold", () => {
      const result = detectBoxInteraction(115, 115, box, scaleX, scaleY);
      expect(result).not.toEqual({ type: "corner", corner: "nw" });
    });
  });

  describe("edge detection", () => {
    test("detects left edge", () => {
      const result = detectBoxInteraction(100, 150, box, scaleX, scaleY);
      expect(result).toEqual({ type: "edge", edge: "left" });
    });

    test("detects right edge", () => {
      const result = detectBoxInteraction(300, 150, box, scaleX, scaleY);
      expect(result).toEqual({ type: "edge", edge: "right" });
    });

    test("detects top edge", () => {
      const result = detectBoxInteraction(200, 100, box, scaleX, scaleY);
      expect(result).toEqual({ type: "edge", edge: "top" });
    });

    test("detects bottom edge", () => {
      const result = detectBoxInteraction(200, 200, box, scaleX, scaleY);
      expect(result).toEqual({ type: "edge", edge: "bottom" });
    });

    test("detects edge within threshold (8px)", () => {
      const result = detectBoxInteraction(106, 150, box, scaleX, scaleY);
      expect(result).toEqual({ type: "edge", edge: "left" });
    });

    test("does not detect edge outside threshold", () => {
      const result = detectBoxInteraction(112, 150, box, scaleX, scaleY);
      expect(result).not.toEqual({ type: "edge", edge: "left" });
    });
  });

  describe("move detection", () => {
    test("detects move for center of box", () => {
      const result = detectBoxInteraction(200, 150, box, scaleX, scaleY);
      expect(result).toEqual({ type: "move" });
    });

    test("detects move for any point inside box (not near edges)", () => {
      const result = detectBoxInteraction(150, 130, box, scaleX, scaleY);
      expect(result).toEqual({ type: "move" });
    });

    test("detects move near center but away from edges", () => {
      const result = detectBoxInteraction(180, 160, box, scaleX, scaleY);
      expect(result).toEqual({ type: "move" });
    });
  });

  describe("no interaction", () => {
    test("returns null for point outside box", () => {
      const result = detectBoxInteraction(50, 50, box, scaleX, scaleY);
      expect(result).toBeNull();
    });

    test("returns null for null box", () => {
      const result = detectBoxInteraction(200, 150, null, scaleX, scaleY);
      expect(result).toBeNull();
    });

    test("returns null for undefined box", () => {
      const result = detectBoxInteraction(200, 150, undefined, scaleX, scaleY);
      expect(result).toBeNull();
    });

    test("returns null for point far from box", () => {
      const result = detectBoxInteraction(500, 500, box, scaleX, scaleY);
      expect(result).toBeNull();
    });
  });

  describe("scaling", () => {
    test("handles scaled box correctly", () => {
      const scaledBox = { x1: 200, y1: 200, x2: 600, y2: 400 };
      const scaleX = 2;
      const scaleY = 2;

      const result = detectBoxInteraction(100, 100, scaledBox, scaleX, scaleY);
      expect(result).toEqual({ type: "corner", corner: "nw" });
    });

    test("handles non-uniform scaling", () => {
      const scaledBox = { x1: 200, y1: 100, x2: 600, y2: 400 };
      const scaleX = 2;
      const scaleY = 1;

      const result = detectBoxInteraction(100, 250, scaledBox, scaleX, scaleY);
      expect(result).toEqual({ type: "edge", edge: "left" });
    });
  });

  describe("priority", () => {
    test("corner has priority over edge when near both", () => {
      const result = detectBoxInteraction(100, 100, box, scaleX, scaleY);
      expect(result.type).toBe("corner");
    });
  });
});

describe("calculateBoxResize", () => {
  const originalBox = { x1: 100, y1: 100, x2: 300, y2: 200 };

  describe("move mode", () => {
    test("moves box by delta", () => {
      const data = {
        startX: 200,
        startY: 150,
        originalBox,
      };
      const result = calculateBoxResize("move", data, 250, 180);
      expect(result).toEqual({
        x1: 150,
        y1: 130,
        x2: 350,
        y2: 230,
      });
    });

    test("moves box with negative delta", () => {
      const data = {
        startX: 200,
        startY: 150,
        originalBox,
      };
      const result = calculateBoxResize("move", data, 150, 120);
      expect(result).toEqual({
        x1: 50,
        y1: 70,
        x2: 250,
        y2: 170,
      });
    });
  });

  describe("corner mode", () => {
    test("resizes from northwest corner", () => {
      const data = {
        startX: 100,
        startY: 100,
        originalBox,
        corner: "nw",
      };
      const result = calculateBoxResize("corner", data, 120, 120);
      expect(result).toEqual({
        x1: 120,
        y1: 120,
        x2: 300,
        y2: 200,
      });
    });

    test("resizes from northeast corner", () => {
      const data = {
        startX: 300,
        startY: 100,
        originalBox,
        corner: "ne",
      };
      const result = calculateBoxResize("corner", data, 320, 90);
      expect(result).toEqual({
        x1: 100,
        y1: 90,
        x2: 320,
        y2: 200,
      });
    });

    test("resizes from southwest corner", () => {
      const data = {
        startX: 100,
        startY: 200,
        originalBox,
        corner: "sw",
      };
      const result = calculateBoxResize("corner", data, 80, 220);
      expect(result).toEqual({
        x1: 80,
        y1: 100,
        x2: 300,
        y2: 220,
      });
    });

    test("resizes from southeast corner", () => {
      const data = {
        startX: 300,
        startY: 200,
        originalBox,
        corner: "se",
      };
      const result = calculateBoxResize("corner", data, 350, 250);
      expect(result).toEqual({
        x1: 100,
        y1: 100,
        x2: 350,
        y2: 250,
      });
    });

    test("normalizes box when dragging past opposite corner", () => {
      const data = {
        startX: 300,
        startY: 200,
        originalBox,
        corner: "se",
      };
      const result = calculateBoxResize("corner", data, 50, 50);
      expect(result).toEqual({
        x1: 50,
        y1: 50,
        x2: 100,
        y2: 100,
      });
    });
  });

  describe("edge mode", () => {
    test("resizes left edge", () => {
      const data = {
        startX: 100,
        startY: 150,
        originalBox,
        edge: "left",
      };
      const result = calculateBoxResize("edge", data, 120, 150);
      expect(result).toEqual({
        x1: 120,
        y1: 100,
        x2: 300,
        y2: 200,
      });
    });

    test("resizes right edge", () => {
      const data = {
        startX: 300,
        startY: 150,
        originalBox,
        edge: "right",
      };
      const result = calculateBoxResize("edge", data, 350, 150);
      expect(result).toEqual({
        x1: 100,
        y1: 100,
        x2: 350,
        y2: 200,
      });
    });

    test("resizes top edge", () => {
      const data = {
        startX: 200,
        startY: 100,
        originalBox,
        edge: "top",
      };
      const result = calculateBoxResize("edge", data, 200, 80);
      expect(result).toEqual({
        x1: 100,
        y1: 80,
        x2: 300,
        y2: 200,
      });
    });

    test("resizes bottom edge", () => {
      const data = {
        startX: 200,
        startY: 200,
        originalBox,
        edge: "bottom",
      };
      const result = calculateBoxResize("edge", data, 200, 250);
      expect(result).toEqual({
        x1: 100,
        y1: 100,
        x2: 300,
        y2: 250,
      });
    });

    test("normalizes box when dragging edge past opposite edge", () => {
      const data = {
        startX: 300,
        startY: 150,
        originalBox,
        edge: "right",
      };
      const result = calculateBoxResize("edge", data, 50, 150);
      expect(result).toEqual({
        x1: 50,
        y1: 100,
        x2: 100,
        y2: 200,
      });
    });
  });

  describe("invalid inputs", () => {
    test("returns null for null mode", () => {
      const result = calculateBoxResize(null, {}, 100, 100);
      expect(result).toBeNull();
    });

    test("returns null for null data", () => {
      const result = calculateBoxResize("move", null, 100, 100);
      expect(result).toBeNull();
    });

    test("returns null for undefined mode", () => {
      const result = calculateBoxResize(undefined, {}, 100, 100);
      expect(result).toBeNull();
    });

    test("returns null for undefined data", () => {
      const result = calculateBoxResize("move", undefined, 100, 100);
      expect(result).toBeNull();
    });

    test("returns null for unknown mode", () => {
      const result = calculateBoxResize("invalid", { originalBox }, 100, 100);
      expect(result).toBeNull();
    });
  });
});

describe("normalizeBox", () => {
  test("normalizes box with reversed x coordinates", () => {
    const box = { x1: 300, y1: 100, x2: 100, y2: 200 };
    const result = normalizeBox(box);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 200,
    });
  });

  test("normalizes box with reversed y coordinates", () => {
    const box = { x1: 100, y1: 200, x2: 300, y2: 100 };
    const result = normalizeBox(box);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 200,
    });
  });

  test("normalizes box with both coordinates reversed", () => {
    const box = { x1: 300, y1: 200, x2: 100, y2: 100 };
    const result = normalizeBox(box);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 200,
    });
  });

  test("returns unchanged box when already normalized", () => {
    const box = { x1: 100, y1: 100, x2: 300, y2: 200 };
    const result = normalizeBox(box);
    expect(result).toEqual(box);
  });

  test("does not mutate original box", () => {
    const box = { x1: 300, y1: 200, x2: 100, y2: 100 };
    const original = { ...box };
    normalizeBox(box);
    expect(box).toEqual(original);
  });
});

describe("getCursorForBoxInteraction", () => {
  test("returns move cursor for move interaction", () => {
    const result = getCursorForBoxInteraction({ type: "move" });
    expect(result).toBe("move");
  });

  test("returns nwse-resize for northwest corner", () => {
    const result = getCursorForBoxInteraction({ type: "corner", corner: "nw" });
    expect(result).toBe("nwse-resize");
  });

  test("returns nesw-resize for northeast corner", () => {
    const result = getCursorForBoxInteraction({ type: "corner", corner: "ne" });
    expect(result).toBe("nesw-resize");
  });

  test("returns nwse-resize for southeast corner", () => {
    const result = getCursorForBoxInteraction({ type: "corner", corner: "se" });
    expect(result).toBe("nwse-resize");
  });

  test("returns nesw-resize for southwest corner", () => {
    const result = getCursorForBoxInteraction({ type: "corner", corner: "sw" });
    expect(result).toBe("nesw-resize");
  });

  test("returns ew-resize for left edge", () => {
    const result = getCursorForBoxInteraction({ type: "edge", edge: "left" });
    expect(result).toBe("ew-resize");
  });

  test("returns ew-resize for right edge", () => {
    const result = getCursorForBoxInteraction({ type: "edge", edge: "right" });
    expect(result).toBe("ew-resize");
  });

  test("returns ns-resize for top edge", () => {
    const result = getCursorForBoxInteraction({ type: "edge", edge: "top" });
    expect(result).toBe("ns-resize");
  });

  test("returns ns-resize for bottom edge", () => {
    const result = getCursorForBoxInteraction({ type: "edge", edge: "bottom" });
    expect(result).toBe("ns-resize");
  });

  test("returns crosshair for null interaction", () => {
    const result = getCursorForBoxInteraction(null);
    expect(result).toBe("crosshair");
  });

  test("returns crosshair for undefined interaction", () => {
    const result = getCursorForBoxInteraction(undefined);
    expect(result).toBe("crosshair");
  });

  test("returns crosshair for unknown interaction type", () => {
    const result = getCursorForBoxInteraction({ type: "unknown" });
    expect(result).toBe("crosshair");
  });
});
