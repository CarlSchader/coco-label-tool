import { BaseMode } from './base-mode.js';

/**
 * SAM2 Mode - Original SAM2 model with point and box prompts
 * Supports single box, positive/negative points
 */
export class SAM2Mode extends BaseMode {
  async init() {
    // Mode is initialized
    // Actual prompts are managed by app.js for now (future: extract to mode)
  }

  getControls() {
    return {
      showPointMode: true,
      showBoxMode: true,
      showTextPrompt: false,
      showMultiBoxControls: false,
    };
  }

  getCanvasConfig() {
    return {
      enablePointClick: true,
      enableBoxDraw: true,
      enableMultipleBoxes: false,
      cursor: 'crosshair',
    };
  }

  getHelpText() {
    return 'SAM2 Mode: Click to add positive points, right-click for negative points. Draw boxes by dragging. Both prompts work together.';
  }

  async runSegmentation() {
    throw new Error('runSegmentation() should be called from app.js (not yet extracted)');
  }

  async saveAnnotation() {
    throw new Error('saveAnnotation() should be called from app.js (not yet extracted)');
  }

  clearPrompts() {
    throw new Error('clearPrompts() should be called from app.js (not yet extracted)');
  }

  getSegmentationEndpoint() {
    return '/api/segment';
  }

  getModelInfoEndpoint() {
    return '/api/model-info';
  }

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
