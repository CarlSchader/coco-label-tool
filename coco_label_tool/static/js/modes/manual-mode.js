import { BaseMode } from "./base-mode.js";

/**
 * Manual Mode - Creates rectangular masks directly from user-drawn boxes
 * No ML model inference required - masks are generated entirely in the frontend
 */
export class ManualMode extends BaseMode {
  async init() {
    // No model loading required for manual mode
  }

  getControls() {
    return {
      showPointMode: false,
      showBoxMode: true,
      showTextPrompt: false,
      showMultiBoxControls: true,
    };
  }

  getCanvasConfig() {
    return {
      enablePointClick: false,
      enableBoxDraw: true,
      enableMultipleBoxes: true,
      cursor: "crosshair",
    };
  }

  getHelpText() {
    return "Manual Mode: Draw boxes to create rectangular masks. Each box becomes a separate mask. No ML model required.";
  }

  async runSegmentation() {
    throw new Error(
      "runSegmentation() should be called from app.js (not yet extracted)",
    );
  }

  async saveAnnotation() {
    throw new Error(
      "saveAnnotation() should be called from app.js (not yet extracted)",
    );
  }

  clearPrompts() {
    throw new Error(
      "clearPrompts() should be called from app.js (not yet extracted)",
    );
  }

  getSegmentationEndpoint() {
    return null;
  }

  getModelInfoEndpoint() {
    return null;
  }

  supportsPoints() {
    return false;
  }

  supportsBoxes() {
    return true;
  }

  supportsMultipleBoxes() {
    return true;
  }

  supportsTextPrompts() {
    return false;
  }

  supportsNegativePrompts() {
    return false;
  }

  requiresModelLoading() {
    return false;
  }
}
