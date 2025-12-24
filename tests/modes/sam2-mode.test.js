import { SAM2Mode } from "../../coco_label_tool/static/js/modes/sam2-mode.js";

describe("SAM2Mode", () => {
  let mode;

  beforeEach(() => {
    mode = new SAM2Mode({
      modelType: "sam2",
      modelSize: "large",
    });
  });

  describe("constructor", () => {
    test("creates instance with config", () => {
      expect(mode.config).toBeDefined();
      expect(mode.config.modelType).toBe("sam2");
      expect(mode.isActive).toBe(false);
    });
  });

  describe("lifecycle", () => {
    test("init() succeeds", async () => {
      await expect(mode.init()).resolves.not.toThrow();
    });

    test("activate() sets isActive to true", async () => {
      await mode.init();
      await mode.activate();
      expect(mode.isActive).toBe(true);
    });

    test("deactivate() sets isActive to false", async () => {
      await mode.init();
      await mode.activate();
      await mode.deactivate();
      expect(mode.isActive).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("supportsPoints() returns true", () => {
      expect(mode.supportsPoints()).toBe(true);
    });

    test("supportsBoxes() returns true", () => {
      expect(mode.supportsBoxes()).toBe(true);
    });

    test("supportsMultipleBoxes() returns false", () => {
      expect(mode.supportsMultipleBoxes()).toBe(false);
    });

    test("supportsTextPrompts() returns false", () => {
      expect(mode.supportsTextPrompts()).toBe(false);
    });

    test("supportsNegativePrompts() returns true", () => {
      expect(mode.supportsNegativePrompts()).toBe(true);
    });

    test("supportsMaskDrawing() returns false", () => {
      expect(mode.supportsMaskDrawing()).toBe(false);
    });
  });

  describe("UI methods", () => {
    test("getControls() returns config object", () => {
      const controls = mode.getControls();
      expect(controls).toBeDefined();
      expect(controls.showPointMode).toBe(true);
      expect(controls.showBoxMode).toBe(true);
      expect(controls.showTextPrompt).toBe(false);
    });

    test("getCanvasConfig() returns config object", () => {
      const config = mode.getCanvasConfig();
      expect(config).toBeDefined();
      expect(config.enablePointClick).toBe(true);
      expect(config.enableBoxDraw).toBe(true);
    });

    test("getHelpText() returns help string", () => {
      const help = mode.getHelpText();
      expect(typeof help).toBe("string");
      expect(help).toContain("Click to add positive points");
      expect(help).toContain("right-click for negative points");
    });
  });

  describe("segmentation", () => {
    test("getSegmentationEndpoint() returns SAM2 endpoint", () => {
      expect(mode.getSegmentationEndpoint()).toBe("/api/segment");
    });

    test("getModelInfoEndpoint() returns SAM2 endpoint", () => {
      expect(mode.getModelInfoEndpoint()).toBe("/api/model-info");
    });
  });
});
