import { SAM3PVSImageMode } from "../../coco_label_tool/static/js/modes/sam3-pvs-image-mode.js";

describe("SAM3PVSImageMode", () => {
  let mode;

  beforeEach(() => {
    mode = new SAM3PVSImageMode({
      modelType: "sam3",
      modelSize: "large",
    });
  });

  describe("constructor", () => {
    test("creates instance with config", () => {
      expect(mode.config).toBeDefined();
      expect(mode.config.modelType).toBe("sam3");
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

    test("supportsMultipleBoxes() returns true", () => {
      expect(mode.supportsMultipleBoxes()).toBe(true);
    });

    test("supportsTextPrompts() returns false", () => {
      expect(mode.supportsTextPrompts()).toBe(false);
    });

    test("supportsNegativePrompts() returns true for points", () => {
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
      expect(controls.showMultiBoxControls).toBe(true);
    });

    test("getCanvasConfig() returns config object", () => {
      const config = mode.getCanvasConfig();
      expect(config).toBeDefined();
      expect(config.enablePointClick).toBe(true);
      expect(config.enableBoxDraw).toBe(true);
      expect(config.enableMultipleBoxes).toBe(true);
    });

    test("getHelpText() returns help string", () => {
      const help = mode.getHelpText();
      expect(typeof help).toBe("string");
      expect(help).toContain("SAM3 PVS");
      expect(help).toContain("multiple boxes");
    });
  });

  describe("segmentation", () => {
    test("getSegmentationEndpoint() returns SAM3 endpoint", () => {
      expect(mode.getSegmentationEndpoint()).toBe("/api/segment-sam3");
    });

    test("getModelInfoEndpoint() returns SAM3 endpoint", () => {
      expect(mode.getModelInfoEndpoint()).toBe("/api/model-info-sam3");
    });
  });
});
