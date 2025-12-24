import { BaseMode } from "./base-mode.js";

/**
 * SAM3 PVS (Promptable Visual Segmentation) Image Mode
 * Supports multiple boxes, positive/negative points
 * NOTE: All boxes are treated as positive (SAM3 Tracker limitation)
 */
export class SAM3PVSImageMode extends BaseMode {
  async init() {
    // Mode is initialized
    // Actual prompts are managed by app.js for now (future: extract to mode)
  }

  getControls() {
    return {
      showPointMode: true,
      showBoxMode: true,
      showTextPrompt: false,
      showMultiBoxControls: true,
    };
  }

  getCanvasConfig() {
    return {
      enablePointClick: true,
      enableBoxDraw: true,
      enableMultipleBoxes: true,
      cursor: "crosshair",
    };
  }

  getHelpText() {
    return "SAM3 PVS Mode: Draw multiple boxes for multi-object segmentation. Click to add positive points, right-click for negative points. Note: All boxes are positive prompts (SAM3 Tracker limitation).";
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
    return "/api/segment-sam3";
  }

  getModelInfoEndpoint() {
    return "/api/model-info-sam3";
  }

  supportsPoints() {
    return true;
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
    return true; // For points only, not boxes
  }

  supportsMaskDrawing() {
    return false;
  }
}
