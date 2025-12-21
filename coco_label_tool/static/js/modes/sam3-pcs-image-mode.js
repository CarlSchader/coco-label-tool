import { BaseMode } from "./base-mode.js";

/**
 * SAM3 PCS (Promptable Concept Segmentation) Image Mode
 * Finds ALL instances of a concept in the image
 * Supports text prompts, multiple boxes with positive/negative labels
 * Does NOT support point prompts (yet)
 */
export class SAM3PCSImageMode extends BaseMode {
  async init() {
    // Mode is initialized
    // Actual prompts are managed by app.js for now (future: extract to mode)
  }

  getControls() {
    return {
      showPointMode: false, // PCS doesn't support points yet
      showBoxMode: true,
      showTextPrompt: true, // NEW: Show text input field
      showMultiBoxControls: true,
    };
  }

  getCanvasConfig() {
    return {
      enablePointClick: false, // PCS doesn't support points yet
      enableBoxDraw: true,
      enableMultipleBoxes: true,
      cursor: "crosshair",
    };
  }

  getHelpText() {
    return 'SAM3 PCS Mode: Enter text to find ALL instances of a concept (e.g., "laptop", "handle"). Draw boxes to add positive/negative visual prompts. Finds multiple instances automatically.';
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
    return "/api/segment-sam3-pcs";
  }

  getModelInfoEndpoint() {
    return "/api/model-info-sam3-pcs";
  }

  supportsPoints() {
    return false; // PCS doesn't support points yet
  }

  supportsBoxes() {
    return true;
  }

  supportsMultipleBoxes() {
    return true;
  }

  supportsTextPrompts() {
    return true; // NEW: PCS supports text prompts!
  }

  supportsNegativePrompts() {
    return true; // For boxes only (not points since points aren't supported)
  }
}
