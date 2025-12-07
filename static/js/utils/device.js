export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function isSmallScreen() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function isMobileDevice() {
  return isTouchDevice() && isSmallScreen();
}

export function getTouchConfig() {
  const touch = isTouchDevice();

  return {
    pointRadius: touch ? 12 : 5,
    pointHoverRadius: touch ? 16 : 8,
    hoverHitArea: touch ? 24 : 12,
    edgeThreshold: touch ? 20 : 8,
    cornerThreshold: touch ? 28 : 12,
    deleteButtonSize: touch ? 32 : 20,
  };
}
