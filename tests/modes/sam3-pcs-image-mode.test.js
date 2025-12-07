import { SAM3PCSImageMode } from '../../static/js/modes/sam3-pcs-image-mode.js';

describe('SAM3PCSImageMode', () => {
  let mode;

  beforeEach(() => {
    mode = new SAM3PCSImageMode({
      modelType: 'sam3-pcs',
      modelSize: 'base',
    });
  });

  describe('constructor', () => {
    test('creates instance with config', () => {
      expect(mode.config).toBeDefined();
      expect(mode.config.modelType).toBe('sam3-pcs');
      expect(mode.isActive).toBe(false);
    });
  });

  describe('lifecycle', () => {
    test('init() succeeds', async () => {
      await expect(mode.init()).resolves.not.toThrow();
    });

    test('activate() sets isActive to true', async () => {
      await mode.init();
      await mode.activate();
      expect(mode.isActive).toBe(true);
    });

    test('deactivate() sets isActive to false', async () => {
      await mode.init();
      await mode.activate();
      await mode.deactivate();
      expect(mode.isActive).toBe(false);
    });
  });

  describe('capabilities', () => {
    test('supportsPoints() returns false - PCS does not support points yet', () => {
      expect(mode.supportsPoints()).toBe(false);
    });

    test('supportsBoxes() returns true', () => {
      expect(mode.supportsBoxes()).toBe(true);
    });

    test('supportsMultipleBoxes() returns true', () => {
      expect(mode.supportsMultipleBoxes()).toBe(true);
    });

    test('supportsTextPrompts() returns true - KEY FEATURE OF PCS', () => {
      expect(mode.supportsTextPrompts()).toBe(true);
    });

    test('supportsNegativePrompts() returns true for boxes', () => {
      expect(mode.supportsNegativePrompts()).toBe(true);
    });
  });

  describe('UI methods', () => {
    test('getControls() returns config object', () => {
      const controls = mode.getControls();
      expect(controls).toBeDefined();
      expect(controls.showPointMode).toBe(false);
      expect(controls.showBoxMode).toBe(true);
      expect(controls.showTextPrompt).toBe(true); // NEW: Text prompt shown
      expect(controls.showMultiBoxControls).toBe(true);
    });

    test('getCanvasConfig() returns config object', () => {
      const config = mode.getCanvasConfig();
      expect(config).toBeDefined();
      expect(config.enablePointClick).toBe(false);
      expect(config.enableBoxDraw).toBe(true);
      expect(config.enableMultipleBoxes).toBe(true);
    });

    test('getHelpText() returns help string', () => {
      const help = mode.getHelpText();
      expect(typeof help).toBe('string');
      expect(help).toContain('SAM3 PCS');
      expect(help).toContain('text');
      expect(help).toContain('ALL instances');
    });
  });

  describe('segmentation', () => {
    test('getSegmentationEndpoint() returns SAM3 PCS endpoint', () => {
      expect(mode.getSegmentationEndpoint()).toBe('/api/segment-sam3-pcs');
    });

    test('getModelInfoEndpoint() returns SAM3 PCS endpoint', () => {
      expect(mode.getModelInfoEndpoint()).toBe('/api/model-info-sam3-pcs');
    });
  });

  describe('PCS-specific features', () => {
    test('text prompt capability distinguishes PCS from other modes', () => {
      // PCS is the ONLY mode that supports text prompts
      expect(mode.supportsTextPrompts()).toBe(true);
      expect(mode.getControls().showTextPrompt).toBe(true);
    });

    test('help text emphasizes concept search capability', () => {
      const help = mode.getHelpText();
      expect(help.toLowerCase()).toContain('concept');
      expect(help).toContain('ALL instances');
    });

    test('points are disabled in PCS mode', () => {
      // PCS does not support point prompts yet
      expect(mode.supportsPoints()).toBe(false);
      expect(mode.getControls().showPointMode).toBe(false);
      expect(mode.getCanvasConfig().enablePointClick).toBe(false);
    });
  });
});
