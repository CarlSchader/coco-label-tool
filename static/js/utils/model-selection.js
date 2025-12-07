/**
 * Model selection utilities for SAM2/SAM3/SAM3-PCS switching
 */

/**
 * Get the segmentation API endpoint for the given model type
 * @param {string} modelType - 'sam2', 'sam3', or 'sam3-pcs'
 * @returns {string} API endpoint path
 */
export function getSegmentEndpoint(modelType) {
  const normalized = (modelType || '').toLowerCase();
  if (normalized === 'sam3') {
    return '/api/segment-sam3';
  }
  if (normalized === 'sam3-pcs') {
    return '/api/segment-sam3-pcs';
  }
  return '/api/segment';
}

/**
 * Get the model info API endpoint for the given model type
 * @param {string} modelType - 'sam2', 'sam3', or 'sam3-pcs'
 * @returns {string} API endpoint path
 */
export function getModelInfoEndpoint(modelType) {
  const normalized = (modelType || '').toLowerCase();
  if (normalized === 'sam3') {
    return '/api/model-info-sam3';
  }
  if (normalized === 'sam3-pcs') {
    return '/api/model-info-sam3-pcs';
  }
  return '/api/model-info';
}

/**
 * Get the set model size API endpoint for the given model type
 * @param {string} modelType - 'sam2', 'sam3', or 'sam3-pcs'
 * @returns {string} API endpoint path
 */
export function getSetModelSizeEndpoint(modelType) {
  const normalized = (modelType || '').toLowerCase();
  if (normalized === 'sam3') {
    return '/api/set-model-size-sam3';
  }
  if (normalized === 'sam3-pcs') {
    return '/api/set-model-size-sam3-pcs';
  }
  return '/api/set-model-size';
}

/**
 * Format model display name for UI
 * @param {string} modelType - 'sam2', 'sam3', or 'sam3-pcs'
 * @param {string} size - Model size (e.g., 'tiny', 'small', 'base', 'large')
 * @returns {string} Formatted display name (e.g., 'SAM2 TINY')
 */
export function formatModelDisplayName(modelType, size) {
  const normalized = (modelType || '').toLowerCase();
  let displayType = 'SAM2';
  if (normalized === 'sam3') {
    displayType = 'SAM3';
  } else if (normalized === 'sam3-pcs') {
    displayType = 'SAM3 PCS';
  }
  const displaySize = (size || '').toUpperCase();
  return `${displayType} ${displaySize}`;
}
