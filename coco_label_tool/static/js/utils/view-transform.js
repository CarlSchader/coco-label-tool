/**
 * Manages view transformation (zoom, pan) for canvas rendering.
 * Provides coordinate conversion between screen and natural (image) space.
 */
export class ViewTransform {
  // Constants
  static MIN_SCALE = 0.1; // 10%
  static MAX_SCALE = 10; // 1000%
  static ZOOM_STEP = 0.1; // 10% per step

  constructor() {
    this.scale = 1; // Zoom level (MIN_SCALE to MAX_SCALE)
    this.panX = 0; // Pan offset in screen pixels
    this.panY = 0; // Pan offset in screen pixels
  }

  /**
   * Convert screen coordinates to natural (image) coordinates.
   * Used for mouse events to get coordinates for SAM prompts.
   *
   * @param {number} screenX - X coordinate in screen/canvas space
   * @param {number} screenY - Y coordinate in screen/canvas space
   * @param {number} imageScaleX - Ratio of natural width to display width
   * @param {number} imageScaleY - Ratio of natural height to display height
   * @returns {[number, number]} Natural coordinates [x, y]
   */
  screenToNatural(screenX, screenY, imageScaleX, imageScaleY) {
    // Apply inverse pan, then inverse zoom, then image scale
    const x = ((screenX - this.panX) / this.scale) * imageScaleX;
    const y = ((screenY - this.panY) / this.scale) * imageScaleY;
    return [x, y];
  }

  /**
   * Convert natural (image) coordinates to screen coordinates.
   * Used for drawing annotations and masks.
   *
   * @param {number} naturalX - X coordinate in natural/image space
   * @param {number} naturalY - Y coordinate in natural/image space
   * @param {number} imageScaleX - Ratio of natural width to display width
   * @param {number} imageScaleY - Ratio of natural height to display height
   * @returns {[number, number]} Screen coordinates [x, y]
   */
  naturalToScreen(naturalX, naturalY, imageScaleX, imageScaleY) {
    const x = (naturalX / imageScaleX) * this.scale + this.panX;
    const y = (naturalY / imageScaleY) * this.scale + this.panY;
    return [x, y];
  }

  /**
   * Zoom in centered on a point.
   *
   * @param {number} centerX - X coordinate to zoom towards (screen space)
   * @param {number} centerY - Y coordinate to zoom towards (screen space)
   */
  zoomIn(centerX, centerY) {
    this.zoomTo(this.scale + ViewTransform.ZOOM_STEP, centerX, centerY);
  }

  /**
   * Zoom out centered on a point.
   *
   * @param {number} centerX - X coordinate to zoom away from (screen space)
   * @param {number} centerY - Y coordinate to zoom away from (screen space)
   */
  zoomOut(centerX, centerY) {
    this.zoomTo(this.scale - ViewTransform.ZOOM_STEP, centerX, centerY);
  }

  /**
   * Zoom to specific level, keeping centerX/centerY fixed on screen.
   *
   * @param {number} newScale - Target scale level
   * @param {number} centerX - X coordinate to keep fixed (screen space)
   * @param {number} centerY - Y coordinate to keep fixed (screen space)
   */
  zoomTo(newScale, centerX, centerY) {
    newScale = Math.max(
      ViewTransform.MIN_SCALE,
      Math.min(ViewTransform.MAX_SCALE, newScale),
    );

    // Adjust pan to keep center point stationary
    const scaleRatio = newScale / this.scale;
    this.panX = centerX - (centerX - this.panX) * scaleRatio;
    this.panY = centerY - (centerY - this.panY) * scaleRatio;
    this.scale = newScale;
  }

  /**
   * Pan by delta amounts.
   *
   * @param {number} deltaX - Amount to pan horizontally
   * @param {number} deltaY - Amount to pan vertically
   */
  pan(deltaX, deltaY) {
    this.panX += deltaX;
    this.panY += deltaY;
  }

  /**
   * Reset to default view (no zoom, no pan).
   */
  reset() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Get scale as percentage string.
   *
   * @returns {string} Scale as percentage (e.g., "100%", "150%")
   */
  getScalePercent() {
    return Math.round(this.scale * 100) + "%";
  }

  /**
   * Check if view is at default (no zoom, no pan).
   *
   * @returns {boolean} True if at default view
   */
  isAtDefaultView() {
    return this.scale === 1 && this.panX === 0 && this.panY === 0;
  }

  /**
   * Get the transformation matrix for canvas context.
   * Can be used with ctx.setTransform(a, b, c, d, e, f).
   *
   * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}}
   */
  getTransformMatrix() {
    return {
      a: this.scale,
      b: 0,
      c: 0,
      d: this.scale,
      e: this.panX,
      f: this.panY,
    };
  }
}
