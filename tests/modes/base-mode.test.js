import { BaseMode } from "../../static/js/modes/base-mode.js";

describe("BaseMode", () => {
  describe("constructor", () => {
    test("creates instance with config", () => {
      const config = { foo: "bar" };
      const mode = new BaseMode(config);
      expect(mode.config).toEqual(config);
      expect(mode.isActive).toBe(false);
    });

    test("creates instance with empty config if not provided", () => {
      const mode = new BaseMode();
      expect(mode.config).toEqual({});
      expect(mode.isActive).toBe(false);
    });
  });

  describe("lifecycle methods", () => {
    let mode;

    beforeEach(() => {
      mode = new BaseMode({ test: true });
    });

    test("init() throws NotImplementedError", async () => {
      await expect(mode.init()).rejects.toThrow(
        "BaseMode.init() must be implemented by subclass",
      );
    });

    test("activate() sets isActive to true", async () => {
      expect(mode.isActive).toBe(false);
      await mode.activate();
      expect(mode.isActive).toBe(true);
    });

    test("deactivate() sets isActive to false", async () => {
      await mode.activate();
      expect(mode.isActive).toBe(true);
      await mode.deactivate();
      expect(mode.isActive).toBe(false);
    });

    test("destroy() sets isActive to false", () => {
      mode.isActive = true;
      mode.destroy();
      expect(mode.isActive).toBe(false);
    });
  });

  describe("UI methods", () => {
    let mode;

    beforeEach(() => {
      mode = new BaseMode();
    });

    test("getControls() throws NotImplementedError", () => {
      expect(() => mode.getControls()).toThrow(
        "BaseMode.getControls() must be implemented by subclass",
      );
    });

    test("getCanvasConfig() throws NotImplementedError", () => {
      expect(() => mode.getCanvasConfig()).toThrow(
        "BaseMode.getCanvasConfig() must be implemented by subclass",
      );
    });

    test("getHelpText() throws NotImplementedError", () => {
      expect(() => mode.getHelpText()).toThrow(
        "BaseMode.getHelpText() must be implemented by subclass",
      );
    });
  });

  describe("event handlers", () => {
    let mode;

    beforeEach(() => {
      mode = new BaseMode();
    });

    test("onCanvasClick() does nothing by default", () => {
      const event = { clientX: 100, clientY: 200 };
      expect(() => mode.onCanvasClick(event)).not.toThrow();
    });

    test("onCanvasMouseMove() does nothing by default", () => {
      const event = { clientX: 100, clientY: 200 };
      expect(() => mode.onCanvasMouseMove(event)).not.toThrow();
    });

    test("onCanvasMouseDown() does nothing by default", () => {
      const event = { clientX: 100, clientY: 200 };
      expect(() => mode.onCanvasMouseDown(event)).not.toThrow();
    });

    test("onCanvasMouseUp() does nothing by default", () => {
      const event = { clientX: 100, clientY: 200 };
      expect(() => mode.onCanvasMouseUp(event)).not.toThrow();
    });

    test("onKeyDown() does nothing by default", () => {
      const event = { key: "Escape" };
      expect(() => mode.onKeyDown(event)).not.toThrow();
    });
  });

  describe("operations", () => {
    let mode;

    beforeEach(() => {
      mode = new BaseMode();
    });

    test("runSegmentation() throws NotImplementedError", async () => {
      await expect(mode.runSegmentation()).rejects.toThrow(
        "BaseMode.runSegmentation() must be implemented by subclass",
      );
    });

    test("saveAnnotation() throws NotImplementedError", async () => {
      await expect(mode.saveAnnotation()).rejects.toThrow(
        "BaseMode.saveAnnotation() must be implemented by subclass",
      );
    });

    test("clearPrompts() throws NotImplementedError", () => {
      expect(() => mode.clearPrompts()).toThrow(
        "BaseMode.clearPrompts() must be implemented by subclass",
      );
    });

    test("getSegmentationEndpoint() throws NotImplementedError", () => {
      expect(() => mode.getSegmentationEndpoint()).toThrow(
        "BaseMode.getSegmentationEndpoint() must be implemented by subclass",
      );
    });

    test("getModelInfoEndpoint() throws NotImplementedError", () => {
      expect(() => mode.getModelInfoEndpoint()).toThrow(
        "BaseMode.getModelInfoEndpoint() must be implemented by subclass",
      );
    });
  });

  describe("capabilities", () => {
    let mode;

    beforeEach(() => {
      mode = new BaseMode();
    });

    test("supportsPoints() throws NotImplementedError", () => {
      expect(() => mode.supportsPoints()).toThrow(
        "BaseMode.supportsPoints() must be implemented by subclass",
      );
    });

    test("supportsBoxes() throws NotImplementedError", () => {
      expect(() => mode.supportsBoxes()).toThrow(
        "BaseMode.supportsBoxes() must be implemented by subclass",
      );
    });

    test("supportsMultipleBoxes() throws NotImplementedError", () => {
      expect(() => mode.supportsMultipleBoxes()).toThrow(
        "BaseMode.supportsMultipleBoxes() must be implemented by subclass",
      );
    });

    test("supportsTextPrompts() throws NotImplementedError", () => {
      expect(() => mode.supportsTextPrompts()).toThrow(
        "BaseMode.supportsTextPrompts() must be implemented by subclass",
      );
    });

    test("supportsNegativePrompts() throws NotImplementedError", () => {
      expect(() => mode.supportsNegativePrompts()).toThrow(
        "BaseMode.supportsNegativePrompts() must be implemented by subclass",
      );
    });
  });
});
