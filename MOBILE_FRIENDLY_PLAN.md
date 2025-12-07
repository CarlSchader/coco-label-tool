# Mobile-Friendly Implementation Plan

**Goal:** Make the COCO labeling tool usable on mobile devices (phones/tablets) while maintaining 100% desktop browser functionality and appearance.

**Constraint:** Zero impact to desktop browser layout, interactions, or behavior.

**Approach:** Progressive enhancement with mobile-specific media queries, touch event additions (not replacements), and feature detection.

---

## Phase 1: Foundation (Zero Desktop Impact)

### 1.1 Add Viewport Meta Tag

**File:** `templates/index.html`
**Change:** Add to `<head>`:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
/>
```

**Impact:** Mobile-only (desktop browsers ignore this)
**Testing:** None needed (standard HTML5 meta tag)

### 1.2 Add Mobile Detection Utilities

**File:** `static/js/utils/device.js` (NEW)
**Contents:**

```javascript
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
  return {
    pointRadius: isTouchDevice() ? 12 : 5,
    pointHoverRadius: isTouchDevice() ? 16 : 8,
    hoverHitArea: isTouchDevice() ? 24 : 12,
    edgeThreshold: isTouchDevice() ? 20 : 8,
    cornerThreshold: isTouchDevice() ? 28 : 12,
    deleteButtonSize: isTouchDevice() ? 32 : 20,
  };
}
```

**Impact:** None (utility functions only)
**Testing:** Unit tests in `tests/utils/device.test.js`

### 1.3 Add Mobile-Specific CSS Variables

**File:** `static/css/styles.css`
**Change:** Add to `:root`:

```css
:root {
  /* Existing variables... */

  /* Mobile-specific (will be used in media queries) */
  --mobile-button-height: 48px;
  --mobile-spacing: 16px;
  --mobile-font-size: 16px;
  --mobile-touch-target: 44px;
}
```

**Impact:** None (variables defined but not used yet)
**Testing:** None needed

---

## Phase 2: Responsive Layout (Desktop Unaffected)

### 2.1 Add Mobile Layout Media Queries

**File:** `static/css/styles.css`
**Change:** Add at end of file:

```css
/* ============================================
   MOBILE RESPONSIVE STYLES (max-width: 768px)
   ============================================ */

@media (max-width: 768px) {
  body {
    padding: var(--spacing-sm);
  }

  /* Stack main layout vertically */
  .main-layout {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  /* Category badges: horizontal scroll bar at top */
  .category-badges {
    width: 100%;
    max-width: 100%;
    max-height: none;
    position: static;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    padding: var(--spacing-sm);
  }

  #category-badges {
    flex-direction: row;
    gap: var(--spacing-sm);
    display: inline-flex;
  }

  .badge {
    flex-shrink: 0;
    white-space: nowrap;
    min-width: 120px;
  }

  /* Image container: full width */
  .image-container {
    width: 100%;
  }

  .image-container img {
    height: 60vh; /* Shorter on mobile */
    max-width: 100%;
  }

  /* Annotation editor: full width, not sticky */
  .annotation-editor {
    width: 100%;
    position: static;
  }

  /* Controls: stack vertically with larger touch targets */
  .controls {
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .controls button,
  .controls select,
  .controls input {
    width: 100%;
    min-height: var(--mobile-button-height);
    font-size: var(--mobile-font-size);
    padding: var(--spacing-md);
  }

  /* Hide keyboard hints (no physical keyboard on mobile) */
  .keyboard-hints {
    display: none;
  }

  /* Make modals full-screen on mobile */
  .modal-content {
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    margin: var(--spacing-md);
  }

  /* Annotation list: shorter on mobile */
  .annotation-list {
    max-height: 300px;
  }

  #annotation-items {
    height: 200px;
    min-height: 200px;
  }

  /* Cache info: smaller and repositioned */
  .cache-info {
    bottom: var(--spacing-sm);
    right: var(--spacing-sm);
    font-size: 10px;
    padding: var(--spacing-xs);
  }
}

/* Tablet portrait (medium screens) */
@media (min-width: 769px) and (max-width: 1024px) {
  .category-badges {
    width: 200px;
  }

  .annotation-editor {
    width: 240px;
  }
}
```

**Impact:** Desktop unaffected (only applies below 768px)
**Testing:**

- Desktop: Verify no visual changes at 1920x1080, 1440x900, 1024x768
- Mobile: Test at 375x667 (iPhone SE), 390x844 (iPhone 12), 360x740 (Android)

### 2.2 Add Touch-Friendly Scrollbars (Mobile)

**File:** `static/css/styles.css`
**Change:** Add to mobile media query:

```css
@media (max-width: 768px) {
  /* ... existing mobile styles ... */

  /* Wider scrollbars for touch */
  .category-badges::-webkit-scrollbar,
  #annotation-items::-webkit-scrollbar {
    height: 12px;
    width: 12px;
  }

  /* Hide scrollbar but keep functionality on some mobile elements */
  .category-badges::-webkit-scrollbar {
    height: 0;
  }
}
```

**Impact:** Desktop unaffected
**Testing:** Verify scrollbars unchanged on desktop

---

## Phase 3: Touch Event Support (Additive)

### 3.1 Update CONFIG with Dynamic Values

**File:** `static/js/config.js`
**Change:** Add at bottom (after CONFIG definition):

```javascript
// Import device detection (will be added in next step)
import { getTouchConfig } from './utils/device.js';

// Apply touch-specific config on touch devices
const touchConfig = getTouchConfig();
CONFIG.canvas = {
  ...CONFIG.canvas,
  ...touchConfig,
};

// Add new config for touch
CONFIG.touch = {
  enablePinchZoom: true,
  enablePanGesture: true,
  doubleTapZoomFactor: 2.0,
  maxZoom: 5.0,
  minZoom: 0.5,
};
```

**Impact:** Desktop uses existing values (isTouchDevice() returns false)
**Testing:**

- Desktop: Verify CONFIG.canvas values unchanged
- Touch device: Verify larger hit zones apply

### 3.2 Add Touch Event Utilities

**File:** `static/js/utils/touch.js` (NEW)
**Contents:**

```javascript
/**
 * Normalizes touch/mouse events into consistent coordinate format
 */
export function normalizePointerEvent(event) {
  if (event.touches && event.touches.length > 0) {
    // Touch event
    return {
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY,
      pageX: event.touches[0].pageX,
      pageY: event.touches[0].pageY,
      isTouch: true,
      touchCount: event.touches.length,
    };
  } else if (event.changedTouches && event.changedTouches.length > 0) {
    // Touch end event
    return {
      clientX: event.changedTouches[0].clientX,
      clientY: event.changedTouches[0].clientY,
      pageX: event.changedTouches[0].pageX,
      pageY: event.changedTouches[0].pageY,
      isTouch: true,
      touchCount: 0,
    };
  } else {
    // Mouse event
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      isTouch: false,
      touchCount: 0,
    };
  }
}

/**
 * Calculates distance between two touch points (for pinch gestures)
 */
export function getTouchDistance(touch1, touch2) {
  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates midpoint between two touch points
 */
export function getTouchMidpoint(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

/**
 * Prevents default browser touch behaviors (zoom, scroll, etc.)
 */
export function preventDefaultTouch(event) {
  event.preventDefault();
  event.stopPropagation();
}
```

**Impact:** None (utility functions only)
**Testing:** Unit tests in `tests/utils/touch.test.js`

### 3.3 Add Touch Event Listeners to Canvas

**File:** `static/js/app.js`
**Change:** In `setupEventListeners()` function, add after existing mouse listeners:

```javascript
function setupEventListeners() {
  // ... existing mouse listeners ...

  // ADD: Touch event listeners (keep mouse listeners above!)
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  // ... rest of existing listeners ...
}
```

**Impact:** None on desktop (touch events don't fire on non-touch devices)
**Testing:**

- Desktop: Verify mouse events still work
- Touch: Verify touch events fire

### 3.4 Implement Touch Event Handlers

**File:** `static/js/app.js`
**Change:** Add new functions (before `setupEventListeners()`):

```javascript
import {
  normalizePointerEvent,
  getTouchDistance,
  getTouchMidpoint,
  preventDefaultTouch,
} from './utils/touch.js';

let lastTouchDistance = null;
let lastTouchMidpoint = null;
let touchStartTime = 0;

function handleTouchStart(e) {
  preventDefaultTouch(e);

  if (e.touches.length === 1) {
    // Single touch: treat as mouse down
    touchStartTime = Date.now();
    const pointer = normalizePointerEvent(e);

    // Call existing mouse handler with normalized event
    const syntheticEvent = {
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      button: 0, // Left button
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    handleMouseDown(syntheticEvent);
  } else if (e.touches.length === 2) {
    // Two-finger touch: pinch/pan gesture
    lastTouchDistance = getTouchDistance(e.touches[0], e.touches[1]);
    lastTouchMidpoint = getTouchMidpoint(e.touches[0], e.touches[1]);

    // Cancel any ongoing single-touch interaction
    resetPrompts();
  }
}

function handleTouchMove(e) {
  preventDefaultTouch(e);

  if (e.touches.length === 1) {
    // Single touch: treat as mouse move
    const pointer = normalizePointerEvent(e);

    const syntheticEvent = {
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    handleMouseMove(syntheticEvent);
  } else if (e.touches.length === 2) {
    // Two-finger pinch/pan
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const currentMidpoint = getTouchMidpoint(e.touches[0], e.touches[1]);

    if (lastTouchDistance && CONFIG.touch.enablePinchZoom) {
      // Calculate zoom (future: implement canvas zoom)
      const zoomRatio = currentDistance / lastTouchDistance;
      // TODO: Apply zoom to canvas (Phase 4)
    }

    if (lastTouchMidpoint && CONFIG.touch.enablePanGesture) {
      // Calculate pan (future: implement canvas pan)
      const panX = currentMidpoint.x - lastTouchMidpoint.x;
      const panY = currentMidpoint.y - lastTouchMidpoint.y;
      // TODO: Apply pan to canvas (Phase 4)
    }

    lastTouchDistance = currentDistance;
    lastTouchMidpoint = currentMidpoint;
  }
}

function handleTouchEnd(e) {
  preventDefaultTouch(e);

  if (e.changedTouches.length === 1) {
    const pointer = normalizePointerEvent(e);
    const touchDuration = Date.now() - touchStartTime;

    // Detect long press (future: context menu)
    const isLongPress = touchDuration > 500;

    const syntheticEvent = {
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      button: isLongPress ? 2 : 0, // Right-click if long press
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    handleMouseUp(syntheticEvent);
  }

  // Reset touch tracking
  lastTouchDistance = null;
  lastTouchMidpoint = null;
  touchStartTime = 0;
}

function handleTouchCancel(e) {
  preventDefaultTouch(e);

  // Reset everything on touch cancel
  lastTouchDistance = null;
  lastTouchMidpoint = null;
  touchStartTime = 0;
  resetPrompts();
}
```

**Impact:** Desktop unaffected (functions only called by touch events)
**Testing:**

- Desktop: Full regression test (mouse still works)
- Touch: Test single-finger drag, long-press, two-finger gestures

---

## Phase 4: Touch-Specific Enhancements (Optional)

### 4.1 Add Touch Feedback (Visual)

**File:** `static/css/styles.css`
**Change:** Add to mobile media query:

```css
@media (max-width: 768px) {
  /* ... existing mobile styles ... */

  /* Active state for touch feedback */
  button:active {
    background-color: var(--btn-primary-hover);
    transform: scale(0.98);
  }

  .badge:active {
    transform: translateX(2px) scale(0.98);
  }

  .annotation-item:active {
    background: rgba(72, 209, 204, 0.15);
  }

  /* Remove hover effects on touch (they stick) */
  @media (hover: none) {
    button:hover {
      background-color: var(--btn-secondary);
      border-color: var(--border-secondary);
    }

    .badge:hover {
      transform: none;
      filter: none;
    }
  }
}
```

**Impact:** Desktop unaffected (scoped to mobile + hover:none)
**Testing:** Touch device only

### 4.2 Add Canvas Zoom/Pan State Management

**File:** `static/js/app.js`
**Change:** Add to global state variables:

```javascript
// ... existing state variables ...

// Canvas zoom/pan (mobile only)
let canvasZoom = 1.0;
let canvasPanX = 0;
let canvasPanY = 0;
```

### 4.3 Implement Canvas Transform (Mobile)

**File:** `static/js/app.js`
**Change:** Add helper functions:

```javascript
function applyCanvasTransform() {
  if (!isMobileDevice()) return; // Desktop unaffected

  const img = document.getElementById('image');
  img.style.transform = `scale(${canvasZoom}) translate(${canvasPanX}px, ${canvasPanY}px)`;
  img.style.transformOrigin = 'center center';

  // Update canvas to match
  drawEverything();
}

function resetCanvasTransform() {
  canvasZoom = 1.0;
  canvasPanX = 0;
  canvasPanY = 0;
  applyCanvasTransform();
}
```

### 4.4 Connect Zoom/Pan to Touch Gestures

**File:** `static/js/app.js`
**Change:** Update `handleTouchMove()`:

```javascript
function handleTouchMove(e) {
  preventDefaultTouch(e);

  if (e.touches.length === 1) {
    // ... existing single-touch code ...
  } else if (e.touches.length === 2) {
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const currentMidpoint = getTouchMidpoint(e.touches[0], e.touches[1]);

    if (lastTouchDistance && CONFIG.touch.enablePinchZoom) {
      // Apply zoom
      const zoomRatio = currentDistance / lastTouchDistance;
      canvasZoom = Math.max(
        CONFIG.touch.minZoom,
        Math.min(CONFIG.touch.maxZoom, canvasZoom * zoomRatio)
      );
      applyCanvasTransform();
    }

    if (lastTouchMidpoint && CONFIG.touch.enablePanGesture) {
      // Apply pan
      const panDeltaX = currentMidpoint.x - lastTouchMidpoint.x;
      const panDeltaY = currentMidpoint.y - lastTouchMidpoint.y;
      canvasPanX += panDeltaX / canvasZoom;
      canvasPanY += panDeltaY / canvasZoom;
      applyCanvasTransform();
    }

    lastTouchDistance = currentDistance;
    lastTouchMidpoint = currentMidpoint;
  }
}
```

**Impact:** Desktop unaffected (only fires on touch + two fingers)
**Testing:** Touch device only

---

## Phase 5: Mobile UX Improvements (Optional)

### 5.1 Add Bottom Action Bar (Mobile)

**File:** `templates/index.html`
**Change:** Add before closing `</body>`:

```html
<!-- Mobile bottom action bar (hidden on desktop) -->
<div class="mobile-action-bar" id="mobile-action-bar">
  <button id="mobile-btn-previous" title="Previous">◀</button>
  <button id="mobile-btn-reset" title="Reset">↻</button>
  <button id="mobile-btn-save" title="Save" style="background-color: #28a745">✓</button>
  <button id="mobile-btn-menu" title="Menu">☰</button>
  <button id="mobile-btn-next" title="Next">▶</button>
</div>
```

**File:** `static/css/styles.css`
**Change:** Add to mobile media query:

```css
@media (max-width: 768px) {
  /* ... existing mobile styles ... */

  .mobile-action-bar {
    display: flex !important;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    border-top: 2px solid var(--border-accent);
    padding: var(--spacing-sm);
    gap: var(--spacing-xs);
    z-index: 900;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
  }

  .mobile-action-bar button {
    flex: 1;
    min-height: 48px;
    font-size: 20px;
    padding: var(--spacing-sm);
  }

  /* Hide main controls on mobile (use bottom bar instead) */
  .controls {
    display: none;
  }

  /* Add bottom padding to prevent content hiding under action bar */
  body {
    padding-bottom: 72px;
  }
}

/* Desktop: hide mobile action bar */
@media (min-width: 769px) {
  .mobile-action-bar {
    display: none !important;
  }
}
```

**File:** `static/js/app.js`
**Change:** Add event listeners in `setupEventListeners()`:

```javascript
function setupEventListeners() {
  // ... existing listeners ...

  // Mobile action bar (safe to add even on desktop - elements won't exist)
  document.getElementById('mobile-btn-previous')?.addEventListener('click', previousImage);
  document.getElementById('mobile-btn-next')?.addEventListener('click', nextImage);
  document.getElementById('mobile-btn-reset')?.addEventListener('click', resetPrompts);
  document.getElementById('mobile-btn-save')?.addEventListener('click', saveAnnotation);
  document.getElementById('mobile-btn-menu')?.addEventListener('click', () => {
    categoryModal.show();
  });
}
```

**Impact:** Desktop unaffected (elements hidden by CSS, event listeners use `?.`)
**Testing:**

- Desktop: Verify action bar not visible, no layout shift
- Mobile: Verify action bar visible and functional

### 5.2 Add Haptic Feedback (Mobile)

**File:** `static/js/utils/touch.js`
**Change:** Add function:

```javascript
/**
 * Triggers haptic feedback on supported devices
 */
export function hapticFeedback(style = 'medium') {
  if (!navigator.vibrate) return;

  const patterns = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    error: [20, 100, 20, 100, 20],
  };

  navigator.vibrate(patterns[style] || 20);
}
```

**File:** `static/js/app.js`
**Change:** Add haptic feedback to key interactions:

```javascript
import { hapticFeedback } from './utils/touch.js';

async function saveAnnotation() {
  // ... existing save logic ...

  if (isTouchDevice()) {
    hapticFeedback('success');
  }
}

function handleCategoryClick(categoryId) {
  // ... existing logic ...

  if (isTouchDevice()) {
    hapticFeedback('light');
  }
}

function resetPrompts() {
  // ... existing logic ...

  if (isTouchDevice() && (clickPoints.length > 0 || currentBox)) {
    hapticFeedback('medium');
  }
}
```

**Impact:** Desktop unaffected (navigator.vibrate only exists on mobile)
**Testing:** Mobile devices with vibration support

---

## Testing Strategy

### Desktop Regression Testing (CRITICAL)

**Must pass before any PR:**

1. Visual inspection at common resolutions:
   - 1920x1080 (Full HD)
   - 1440x900 (MacBook)
   - 1366x768 (Laptop)
   - 1024x768 (Minimum desktop)
2. Functional testing:
   - Mouse click/drag for points
   - Box drawing and manipulation
   - Category selection
   - Annotation save/delete
   - Keyboard shortcuts (all still work)
   - Modal interactions
3. Browser testing:
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Edge (latest)

### Mobile Testing

**Devices:**

- iPhone SE (375x667 - smallest modern phone)
- iPhone 12/13/14 (390x844 - standard)
- Android medium (360x740)
- iPad (768x1024 - tablet)

**Scenarios:**

1. Touch navigation (single-finger)
2. Point prompts (tap to add)
3. Box drawing (drag)
4. Long-press for negative points
5. Two-finger pinch zoom (if implemented)
6. Two-finger pan (if implemented)
7. Category selection (tap badges)
8. Annotation selection (tap + hold Shift simulation?)
9. Modal interactions
10. Orientation change (portrait ↔ landscape)

### Automated Testing

**New test files needed:**

1. `tests/utils/device.test.js` - Device detection
2. `tests/utils/touch.test.js` - Touch utilities
3. Update `tests/utils/box.test.js` - Add touch threshold tests
4. Update `tests/utils/annotations.test.js` - Add touch interaction tests

**Existing tests:**

- All 389 existing tests MUST continue to pass
- No changes to existing test expectations (desktop behavior unchanged)

---

## Implementation Order

### Sprint 1: Foundation (1-2 days)

- [ ] Phase 1.1: Viewport meta tag
- [ ] Phase 1.2: Device detection utilities + tests
- [ ] Phase 1.3: CSS variables
- [ ] Phase 2.1: Media queries for layout
- [ ] Phase 2.2: Touch-friendly scrollbars
- [ ] **Checkpoint:** Desktop regression test

### Sprint 2: Touch Events (2-3 days)

- [ ] Phase 3.1: Dynamic CONFIG
- [ ] Phase 3.2: Touch utilities + tests
- [ ] Phase 3.3: Touch event listeners
- [ ] Phase 3.4: Touch event handlers
- [ ] **Checkpoint:** Desktop regression + mobile touch test

### Sprint 3: Enhancements (2-3 days)

- [ ] Phase 4.1: Touch feedback CSS
- [ ] Phase 4.2-4.4: Zoom/pan implementation
- [ ] Phase 5.2: Haptic feedback
- [ ] **Checkpoint:** Full mobile UX test

### Sprint 4: Polish (1-2 days)

- [ ] Phase 5.1: Bottom action bar (optional)
- [ ] Bug fixes from testing
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] **Final checkpoint:** Full regression (desktop + mobile)

---

## Success Criteria

### Desktop (MUST NOT CHANGE)

- ✅ Visual appearance identical at all desktop resolutions
- ✅ All mouse interactions work exactly as before
- ✅ All keyboard shortcuts work
- ✅ Performance unchanged
- ✅ All 389 existing tests pass

### Mobile (NEW FUNCTIONALITY)

- ✅ Layout adapts to screen size (no horizontal scroll)
- ✅ Touch targets ≥44px (Apple guidelines)
- ✅ Single-finger touch works for points/boxes
- ✅ Two-finger pinch/pan works (optional)
- ✅ No browser zoom/scroll interference
- ✅ Readable text without zoom
- ✅ All core features accessible (view, annotate, save)

---

## Rollback Plan

If desktop regression detected:

1. Revert `templates/index.html` (remove viewport tag)
2. Revert `static/css/styles.css` (remove media queries)
3. Revert `static/js/app.js` (remove touch handlers)
4. Keep utility files (no impact if unused)

Each phase is independently revertible.

---

## Documentation Updates

After completion:

- [ ] Update `README.md` - Add "Mobile Support" section
- [ ] Update `AGENTS.md` - Add mobile testing instructions
- [ ] Create `MOBILE_SUPPORT.md` - Document mobile features and limitations
- [ ] Update `TESTING.md` - Add mobile testing procedures

---

## Known Limitations

### Will NOT work well on mobile:

1. **SAM2 model inference** - Too compute-intensive for mobile devices
   - Solution: Backend inference only (already the case)
2. **Precise polygon editing** - Fingers less precise than mouse
   - Solution: Keep interactions simple (add/delete only)
3. **Multi-select with Shift key** - No keyboard on mobile
   - Solution: Add long-press multi-select mode (future)
4. **Keyboard shortcuts** - No physical keyboard
   - Solution: Hide keyboard hints, add touch gestures

### Performance Considerations:

- Large images may cause memory issues on mobile
- Canvas rendering may be slower
- Consider downscaling images for mobile viewport

---

## Notes

- This plan prioritizes **zero desktop impact** over mobile feature completeness
- All changes are additive (no removals or replacements)
- Media queries and feature detection ensure proper isolation
- Touch events complement (not replace) mouse events
- Testing desktop after each phase is MANDATORY
