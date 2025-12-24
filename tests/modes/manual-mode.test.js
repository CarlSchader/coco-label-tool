/**
 * Tests for ManualMode class
 * Manual mode creates rectangular masks directly from user-drawn boxes
 */

import { ManualMode } from "../../coco_label_tool/static/js/modes/manual-mode.js";

describe("ManualMode", () => {
  let mode;

  beforeEach(() => {
    mode = new ManualMode({
      modelType: "manual",
    });
  });

  describe("constructor", () => {
    test("creates instance with config", () => {
      expect(mode.config).toBeDefined();
      expect(mode.config.modelType).toBe("manual");
      expect(mode.isActive).toBe(false);
    });

    test("creates instance without config", () => {
      const bareMode = new ManualMode();
      expect(bareMode.config).toEqual({});
      expect(bareMode.isActive).toBe(false);
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

    test("destroy() sets isActive to false", async () => {
      await mode.init();
      await mode.activate();
      await mode.destroy();
      expect(mode.isActive).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("supportsPoints() returns false", () => {
      expect(mode.supportsPoints()).toBe(false);
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

    test("supportsNegativePrompts() returns false", () => {
      expect(mode.supportsNegativePrompts()).toBe(false);
    });

    test("supportsMaskDrawing() returns true", () => {
      expect(mode.supportsMaskDrawing()).toBe(true);
    });
  });

  describe("UI configuration", () => {
    test("getControls() returns correct config", () => {
      const controls = mode.getControls();
      expect(controls).toEqual({
        showPointMode: false,
        showBoxMode: true,
        showTextPrompt: false,
        showMultiBoxControls: true,
      });
    });

    test("getCanvasConfig() returns correct config", () => {
      const config = mode.getCanvasConfig();
      expect(config).toEqual({
        enablePointClick: false,
        enableBoxDraw: true,
        enableMultipleBoxes: true,
        cursor: "crosshair",
      });
    });

    test("getHelpText() returns informative help string", () => {
      const help = mode.getHelpText();
      expect(typeof help).toBe("string");
      expect(help.length).toBeGreaterThan(0);
      expect(help.toLowerCase()).toContain("draw");
      expect(help.toLowerCase()).toContain("box");
    });
  });

  describe("endpoints", () => {
    test("getSegmentationEndpoint() returns null (frontend-only)", () => {
      expect(mode.getSegmentationEndpoint()).toBeNull();
    });

    test("getModelInfoEndpoint() returns null (no ML model)", () => {
      expect(mode.getModelInfoEndpoint()).toBeNull();
    });
  });

  describe("segmentation operations", () => {
    test("runSegmentation() throws (delegated to app.js)", async () => {
      await expect(mode.runSegmentation()).rejects.toThrow(
        "runSegmentation() should be called from app.js",
      );
    });

    test("saveAnnotation() throws (delegated to app.js)", async () => {
      await expect(mode.saveAnnotation()).rejects.toThrow(
        "saveAnnotation() should be called from app.js",
      );
    });

    test("clearPrompts() throws (delegated to app.js)", () => {
      expect(() => mode.clearPrompts()).toThrow(
        "clearPrompts() should be called from app.js",
      );
    });
  });

  describe("requiresModelLoading", () => {
    test("returns false (no ML model to load)", () => {
      expect(mode.requiresModelLoading()).toBe(false);
    });
  });
});
