/**
 * View manager for URL-based view switching.
 *
 * Manages navigation between editor and gallery views using URL query parameters.
 *
 * URL format:
 * - /?view=editor&index=5 → Editor view at image 5
 * - /?view=gallery&page=2&filter=unannotated&sort=filename → Gallery view
 */

export const ViewType = {
  EDITOR: "editor",
  GALLERY: "gallery",
};

// Store the view change callback globally so switchToView can use it
let viewChangeCallback = null;

/**
 * Parse URL search string into params object.
 * @param {string} search - URL search string (e.g., "?view=gallery&page=2")
 * @returns {Object} Params object
 */
export function parseUrlParams(search) {
  const params = {};
  const searchStr = search.startsWith("?") ? search.slice(1) : search;

  if (!searchStr) {
    return params;
  }

  for (const pair of searchStr.split("&")) {
    const [key, value] = pair.split("=");
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    }
  }

  return params;
}

/**
 * Get current view type from params.
 * @param {Object} params - URL params object
 * @returns {string} ViewType.EDITOR or ViewType.GALLERY
 */
export function getCurrentView(params) {
  const view = params.view;
  if (view === ViewType.EDITOR) {
    return ViewType.EDITOR;
  }
  // Default to gallery view when no view param is set
  return ViewType.GALLERY;
}

/**
 * Get view-specific params (excluding the view param itself).
 * @param {Object} params - URL params object
 * @returns {Object} View-specific params
 */
export function getViewParams(params) {
  const view = getCurrentView(params);
  const result = {};

  if (view === ViewType.EDITOR) {
    // Editor params: index
    if (params.index !== undefined) {
      result.index = params.index;
    }
  } else if (view === ViewType.GALLERY) {
    // Gallery params: page, filter, sort
    if (params.page !== undefined) {
      result.page = params.page;
    }
    if (params.filter !== undefined) {
      result.filter = params.filter;
    }
    if (params.sort !== undefined) {
      result.sort = params.sort;
    }
  }

  return result;
}

/**
 * Build URL string from view type and params.
 * @param {string} view - ViewType.EDITOR or ViewType.GALLERY
 * @param {Object} params - View-specific params
 * @returns {string} URL string
 */
export function buildUrl(view, params) {
  const parts = [`view=${encodeURIComponent(view)}`];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  return "/?" + parts.join("&");
}

/**
 * Switch to a new view and update URL.
 * @param {string} view - ViewType.EDITOR or ViewType.GALLERY
 * @param {Object} params - View-specific params
 * @param {Function} onViewChange - Optional callback when view changes (falls back to stored callback)
 */
export function switchToView(view, params = {}, onViewChange = null) {
  const url = buildUrl(view, params);
  window.history.pushState({ view, params }, "", url);

  // Use provided callback or stored global callback
  const callback = onViewChange || viewChangeCallback;
  if (callback) {
    callback(view, params);
  }
}

/**
 * Update URL params without triggering view change.
 * @param {Object} newParams - Params to update
 */
export function updateUrlParams(newParams) {
  const currentParams = parseUrlParams(window.location.search);
  const view = getCurrentView(currentParams);

  // Merge new params with existing view-specific params
  const viewParams = getViewParams(currentParams);
  const mergedParams = { ...viewParams, ...newParams };

  const url = buildUrl(view, mergedParams);
  window.history.replaceState({ view, params: mergedParams }, "", url);
}

/**
 * Initialize view manager and set up popstate listener.
 * @param {Function} onViewChange - Callback when view changes (view, params)
 * @returns {Object} Current view state { view, params }
 */
export function initViewManager(onViewChange) {
  // Store callback globally so switchToView can use it
  viewChangeCallback = onViewChange;

  // Handle browser back/forward
  window.addEventListener("popstate", (event) => {
    if (event.state) {
      onViewChange(event.state.view, event.state.params);
    } else {
      // No state, parse from URL
      const params = parseUrlParams(window.location.search);
      const view = getCurrentView(params);
      const viewParams = getViewParams(params);
      onViewChange(view, viewParams);
    }
  });

  // Get initial state
  const params = parseUrlParams(window.location.search);
  const view = getCurrentView(params);
  const viewParams = getViewParams(params);

  return { view, params: viewParams };
}
