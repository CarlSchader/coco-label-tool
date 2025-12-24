/**
 * Abstract base class for segmentation modes.
 * All modes must extend this class and implement the required methods.
 */
export class BaseMode {
  constructor(config = {}) {
    this.config = config;
    this.isActive = false;
  }

  // Lifecycle methods
  async init() {
    throw new Error("BaseMode.init() must be implemented by subclass");
  }

  async activate() {
    this.isActive = true;
  }

  async deactivate() {
    this.isActive = false;
  }

  destroy() {
    this.isActive = false;
  }

  // UI methods
  getControls() {
    throw new Error("BaseMode.getControls() must be implemented by subclass");
  }

  getCanvasConfig() {
    throw new Error(
      "BaseMode.getCanvasConfig() must be implemented by subclass",
    );
  }

  getHelpText() {
    throw new Error("BaseMode.getHelpText() must be implemented by subclass");
  }

  // Event handlers (optional - modes can choose not to implement)
  onCanvasClick(_event) {
    // No-op by default
  }

  onCanvasMouseMove(_event) {
    // No-op by default
  }

  onCanvasMouseDown(_event) {
    // No-op by default
  }

  onCanvasMouseUp(_event) {
    // No-op by default
  }

  onKeyDown(_event) {
    // No-op by default
  }

  // Operations (must implement in subclass)
  async runSegmentation() {
    throw new Error(
      "BaseMode.runSegmentation() must be implemented by subclass",
    );
  }

  async saveAnnotation() {
    throw new Error(
      "BaseMode.saveAnnotation() must be implemented by subclass",
    );
  }

  clearPrompts() {
    throw new Error("BaseMode.clearPrompts() must be implemented by subclass");
  }

  // API endpoints
  getSegmentationEndpoint() {
    throw new Error(
      "BaseMode.getSegmentationEndpoint() must be implemented by subclass",
    );
  }

  getModelInfoEndpoint() {
    throw new Error(
      "BaseMode.getModelInfoEndpoint() must be implemented by subclass",
    );
  }

  // Capabilities
  supportsPoints() {
    throw new Error(
      "BaseMode.supportsPoints() must be implemented by subclass",
    );
  }

  supportsBoxes() {
    throw new Error("BaseMode.supportsBoxes() must be implemented by subclass");
  }

  supportsMultipleBoxes() {
    throw new Error(
      "BaseMode.supportsMultipleBoxes() must be implemented by subclass",
    );
  }

  supportsTextPrompts() {
    throw new Error(
      "BaseMode.supportsTextPrompts() must be implemented by subclass",
    );
  }

  supportsNegativePrompts() {
    throw new Error(
      "BaseMode.supportsNegativePrompts() must be implemented by subclass",
    );
  }

  supportsMaskDrawing() {
    throw new Error(
      "BaseMode.supportsMaskDrawing() must be implemented by subclass",
    );
  }
}
