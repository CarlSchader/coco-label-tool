import { ModeRegistry } from "../../static/js/modes/mode-registry.js";
import { BaseMode } from "../../static/js/modes/base-mode.js";

// Mock mode class for testing
class TestMode extends BaseMode {
  async init() {
    this.initialized = true;
  }
  getControls() {
    return "<div>Test Controls</div>";
  }
  getCanvasConfig() {
    return { testConfig: true };
  }
  getHelpText() {
    return "Test help text";
  }
  onCanvasClick() {}
  onCanvasMouseMove() {}
  onCanvasMouseDown() {}
  onCanvasMouseUp() {}
  onKeyDown() {}
  async runSegmentation() {}
  async saveAnnotation() {}
  clearPrompts() {}
  supportsPoints() {
    return true;
  }
  supportsBoxes() {
    return true;
  }
  supportsMultipleBoxes() {
    return false;
  }
  supportsTextPrompts() {
    return false;
  }
  supportsNegativePrompts() {
    return true;
  }
}

describe("ModeRegistry", () => {
  let registry;

  beforeEach(() => {
    registry = new ModeRegistry();
  });

  describe("register", () => {
    test("registers a mode with metadata", () => {
      const metadata = {
        displayName: "Test Mode",
        description: "A test mode",
        supportsPoints: true,
        supportsBoxes: true,
      };

      registry.register("test-mode", TestMode, metadata);

      expect(registry.has("test-mode")).toBe(true);
    });

    test("throws error if modeId is empty", () => {
      expect(() => {
        registry.register("", TestMode, {});
      }).toThrow("modeId must be a non-empty string");
    });

    test("throws error if ModeClass is not a function", () => {
      expect(() => {
        registry.register("test", null, {});
      }).toThrow("ModeClass must be a constructor function");
    });

    test("throws error if modeId already registered", () => {
      registry.register("test-mode", TestMode, {});
      expect(() => {
        registry.register("test-mode", TestMode, {});
      }).toThrow('Mode "test-mode" is already registered');
    });

    test("stores metadata with mode", () => {
      const metadata = {
        displayName: "Test Mode",
        description: "Description",
      };

      registry.register("test-mode", TestMode, metadata);
      const info = registry.getModeInfo("test-mode");

      expect(info.displayName).toBe("Test Mode");
      expect(info.description).toBe("Description");
    });
  });

  describe("create", () => {
    beforeEach(() => {
      registry.register("test-mode", TestMode, { displayName: "Test" });
    });

    test("creates mode instance with config", () => {
      const config = { foo: "bar" };
      const mode = registry.create("test-mode", config);

      expect(mode).toBeInstanceOf(TestMode);
      expect(mode.config).toEqual(config);
    });

    test("creates mode instance without config", () => {
      const mode = registry.create("test-mode");

      expect(mode).toBeInstanceOf(TestMode);
      expect(mode.config).toEqual({});
    });

    test("throws error if mode not registered", () => {
      expect(() => {
        registry.create("nonexistent-mode");
      }).toThrow('Mode "nonexistent-mode" is not registered');
    });
  });

  describe("has", () => {
    test("returns true for registered mode", () => {
      registry.register("test-mode", TestMode, {});
      expect(registry.has("test-mode")).toBe(true);
    });

    test("returns false for unregistered mode", () => {
      expect(registry.has("nonexistent")).toBe(false);
    });
  });

  describe("getModeInfo", () => {
    test("returns metadata for registered mode", () => {
      const metadata = {
        displayName: "Test Mode",
        description: "Test description",
        supportsPoints: true,
      };

      registry.register("test-mode", TestMode, metadata);
      const info = registry.getModeInfo("test-mode");

      expect(info).toEqual(metadata);
    });

    test("returns null for unregistered mode", () => {
      expect(registry.getModeInfo("nonexistent")).toBeNull();
    });
  });

  describe("getAllModes", () => {
    test("returns empty array when no modes registered", () => {
      expect(registry.getAllModes()).toEqual([]);
    });

    test("returns all registered modes with metadata", () => {
      registry.register("mode1", TestMode, { displayName: "Mode 1" });
      registry.register("mode2", TestMode, { displayName: "Mode 2" });

      const modes = registry.getAllModes();

      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ id: "mode1", displayName: "Mode 1" });
      expect(modes[1]).toEqual({ id: "mode2", displayName: "Mode 2" });
    });
  });

  describe("unregister", () => {
    test("removes registered mode", () => {
      registry.register("test-mode", TestMode, {});
      expect(registry.has("test-mode")).toBe(true);

      registry.unregister("test-mode");
      expect(registry.has("test-mode")).toBe(false);
    });

    test("does nothing if mode not registered", () => {
      expect(() => {
        registry.unregister("nonexistent");
      }).not.toThrow();
    });
  });
});
