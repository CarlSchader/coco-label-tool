/**
 * Manages the lifecycle of modes and handles mode switching.
 * Orchestrates initialization, activation, deactivation, and destruction.
 */
export class ModeManager {
  constructor(registry) {
    if (!registry) {
      throw new Error("ModeRegistry instance is required");
    }

    this.registry = registry;
    this.currentMode = null;
    this.currentModeId = null;
    this.currentConfig = null;
  }

  async switchMode(modeId, config = {}) {
    if (!this.registry.has(modeId)) {
      throw new Error(`Mode "${modeId}" is not registered`);
    }

    // Check if already on this mode with same config
    if (
      this.currentModeId === modeId &&
      this._configsEqual(this.currentConfig, config)
    ) {
      return;
    }

    // Deactivate and destroy current mode
    if (this.currentMode) {
      await this.currentMode.deactivate();
      this.currentMode.destroy();
    }

    // Create and initialize new mode
    this.currentMode = this.registry.create(modeId, config);
    this.currentModeId = modeId;
    this.currentConfig = config;

    await this.currentMode.init();
    await this.currentMode.activate();
  }

  getCurrentMode() {
    return this.currentMode;
  }

  getCurrentModeId() {
    return this.currentModeId;
  }

  hasActiveMode() {
    return this.currentMode !== null && this.currentMode.isActive;
  }

  delegateEvent(eventHandlerName, ...args) {
    if (!this.currentMode) {
      return;
    }

    if (typeof this.currentMode[eventHandlerName] !== "function") {
      throw new Error(
        `Mode "${this.currentModeId}" does not implement handler "${eventHandlerName}"`,
      );
    }

    return this.currentMode[eventHandlerName](...args);
  }

  getCapabilities() {
    if (!this.currentMode) {
      return null;
    }

    return {
      supportsPoints: this.currentMode.supportsPoints(),
      supportsBoxes: this.currentMode.supportsBoxes(),
      supportsMultipleBoxes: this.currentMode.supportsMultipleBoxes(),
      supportsTextPrompts: this.currentMode.supportsTextPrompts(),
      supportsNegativePrompts: this.currentMode.supportsNegativePrompts(),
    };
  }

  _configsEqual(config1, config2) {
    return JSON.stringify(config1) === JSON.stringify(config2);
  }
}
