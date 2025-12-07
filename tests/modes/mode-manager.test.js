import { ModeManager } from '../../static/js/modes/mode-manager.js';
import { ModeRegistry } from '../../static/js/modes/mode-registry.js';
import { BaseMode } from '../../static/js/modes/base-mode.js';

// Mock mode classes for testing
class MockMode1 extends BaseMode {
  async init() {
    this.initialized = true;
  }
  getControls() {
    return '<div>Mode1 Controls</div>';
  }
  getCanvasConfig() {
    return { mode1Config: true };
  }
  getHelpText() {
    return 'Mode1 help';
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

class MockMode2 extends BaseMode {
  async init() {
    this.initialized = true;
  }
  getControls() {
    return '<div>Mode2 Controls</div>';
  }
  getCanvasConfig() {
    return { mode2Config: true };
  }
  getHelpText() {
    return 'Mode2 help';
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
    return false;
  }
  supportsMultipleBoxes() {
    return false;
  }
  supportsTextPrompts() {
    return true;
  }
  supportsNegativePrompts() {
    return false;
  }
}

describe('ModeManager', () => {
  let manager;
  let registry;

  beforeEach(() => {
    registry = new ModeRegistry();
    registry.register('mode1', MockMode1, { displayName: 'Mode 1' });
    registry.register('mode2', MockMode2, { displayName: 'Mode 2' });
    manager = new ModeManager(registry);
  });

  describe('constructor', () => {
    test('creates instance with registry', () => {
      expect(manager.registry).toBe(registry);
      expect(manager.currentMode).toBeNull();
      expect(manager.currentModeId).toBeNull();
    });

    test('throws error if registry not provided', () => {
      expect(() => new ModeManager()).toThrow('ModeRegistry instance is required');
    });
  });

  describe('switchMode', () => {
    test('activates initial mode', async () => {
      const config = { foo: 'bar' };
      await manager.switchMode('mode1', config);

      expect(manager.currentModeId).toBe('mode1');
      expect(manager.currentMode).toBeInstanceOf(MockMode1);
      expect(manager.currentMode.isActive).toBe(true);
      expect(manager.currentMode.initialized).toBe(true);
    });

    test('deactivates previous mode when switching', async () => {
      await manager.switchMode('mode1');
      const firstMode = manager.currentMode;

      await manager.switchMode('mode2');

      expect(firstMode.isActive).toBe(false);
      expect(manager.currentMode.isActive).toBe(true);
      expect(manager.currentModeId).toBe('mode2');
    });

    test('destroys previous mode after deactivation', async () => {
      await manager.switchMode('mode1');
      const firstMode = manager.currentMode;
      let destroyCalled = false;
      firstMode.destroy = () => {
        destroyCalled = true;
      };

      await manager.switchMode('mode2');

      expect(destroyCalled).toBe(true);
    });

    test('throws error if mode not registered', async () => {
      await expect(manager.switchMode('nonexistent')).rejects.toThrow(
        'Mode "nonexistent" is not registered'
      );
    });

    test('calls init on new mode', async () => {
      await manager.switchMode('mode1');

      expect(manager.currentMode.initialized).toBe(true);
    });

    test('passes config to mode constructor', async () => {
      const config = { testValue: 123 };
      await manager.switchMode('mode1', config);

      expect(manager.currentMode.config).toEqual(config);
    });

    test('does nothing if switching to same mode with no config changes', async () => {
      await manager.switchMode('mode1');
      const firstMode = manager.currentMode;

      await manager.switchMode('mode1');
      const secondMode = manager.currentMode;

      expect(secondMode).toBe(firstMode);
    });

    test('recreates mode if switching to same mode with different config', async () => {
      await manager.switchMode('mode1', { a: 1 });
      const firstMode = manager.currentMode;

      await manager.switchMode('mode1', { a: 2 });
      const secondMode = manager.currentMode;

      expect(secondMode).not.toBe(firstMode);
      expect(secondMode.config).toEqual({ a: 2 });
    });
  });

  describe('getCurrentMode', () => {
    test('returns null when no mode active', () => {
      expect(manager.getCurrentMode()).toBeNull();
    });

    test('returns current mode instance', async () => {
      await manager.switchMode('mode1');
      expect(manager.getCurrentMode()).toBeInstanceOf(MockMode1);
    });
  });

  describe('getCurrentModeId', () => {
    test('returns null when no mode active', () => {
      expect(manager.getCurrentModeId()).toBeNull();
    });

    test('returns current mode ID', async () => {
      await manager.switchMode('mode1');
      expect(manager.getCurrentModeId()).toBe('mode1');
    });
  });

  describe('hasActiveMode', () => {
    test('returns false when no mode active', () => {
      expect(manager.hasActiveMode()).toBe(false);
    });

    test('returns true when mode is active', async () => {
      await manager.switchMode('mode1');
      expect(manager.hasActiveMode()).toBe(true);
    });
  });

  describe('delegateEvent', () => {
    test('delegates event to current mode', async () => {
      await manager.switchMode('mode1');
      let eventReceived = null;
      manager.currentMode.onCanvasClick = (event) => {
        eventReceived = event;
      };
      const event = { clientX: 100, clientY: 200 };

      manager.delegateEvent('onCanvasClick', event);

      expect(eventReceived).toEqual(event);
    });

    test('does nothing if no mode active', () => {
      expect(() => {
        manager.delegateEvent('onCanvasClick', {});
      }).not.toThrow();
    });

    test('throws error if event handler not found on mode', async () => {
      await manager.switchMode('mode1');

      expect(() => {
        manager.delegateEvent('nonexistentHandler', {});
      }).toThrow('Mode "mode1" does not implement handler "nonexistentHandler"');
    });
  });

  describe('getCapabilities', () => {
    test('returns null when no mode active', () => {
      expect(manager.getCapabilities()).toBeNull();
    });

    test('returns capabilities of current mode', async () => {
      await manager.switchMode('mode1');
      const capabilities = manager.getCapabilities();

      expect(capabilities).toEqual({
        supportsPoints: true,
        supportsBoxes: true,
        supportsMultipleBoxes: false,
        supportsTextPrompts: false,
        supportsNegativePrompts: true,
      });
    });

    test('returns different capabilities for different modes', async () => {
      await manager.switchMode('mode2');
      const capabilities = manager.getCapabilities();

      expect(capabilities).toEqual({
        supportsPoints: true,
        supportsBoxes: false,
        supportsMultipleBoxes: false,
        supportsTextPrompts: true,
        supportsNegativePrompts: false,
      });
    });
  });
});
