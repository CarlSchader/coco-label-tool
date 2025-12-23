/**
 * Gallery view for browsing dataset images.
 *
 * Features:
 * - Grid layout with 64x64 thumbnails
 * - Infinite scroll with prefetching
 * - Filter by annotation status (all/annotated/unannotated)
 * - Sort by various criteria
 * - Click to navigate to editor
 */

import { apiPost } from "./api.js";
import {
  switchToView,
  updateUrlParams,
  ViewType,
} from "./utils/view-manager.js";

// Warning function injected from app.js to avoid circular dependency
let getImageWarningsFunc = null;

/**
 * Set the warning function for gallery items.
 * Called from app.js during initialization.
 * @param {Function} fn - Function that takes imageId and returns warnings
 */
export function setWarningFunction(fn) {
  getImageWarningsFunc = fn;
}

// Annotation type abbreviations for display
export const TYPE_ABBREVIATIONS = {
  object_detection: "ObjDet",
  keypoint: "Keypt",
  panoptic: "Panop",
  captioning: "Cap",
  densepose: "Dense",
};

// Canonical order for displaying annotation types
const TYPE_ORDER = [
  "object_detection",
  "keypoint",
  "panoptic",
  "captioning",
  "densepose",
];

// Constants
const PAGE_SIZE = 20; // Keep small for S3 datasets (each thumbnail requires full image download)
const SCROLL_THRESHOLD = 300; // px from bottom to trigger load

// Module state
let state = {
  currentPage: 0,
  currentFilter: "all",
  currentSort: "index",
  isLoading: false,
  hasMore: true,
  loadedImages: [],
  totalImages: 0,
  totalFiltered: 0,
};

/**
 * Get current gallery state (for testing).
 * @returns {Object} Current state
 */
export function getGalleryState() {
  return { ...state };
}

/**
 * Update gallery state.
 * @param {Object} updates - State updates to merge
 */
export function updateGalleryState(updates) {
  state = { ...state, ...updates };
}

/**
 * Reset gallery state to defaults.
 */
export function resetGalleryState() {
  state = {
    currentPage: 0,
    currentFilter: "all",
    currentSort: "index",
    isLoading: false,
    hasMore: true,
    loadedImages: [],
    totalImages: 0,
    totalFiltered: 0,
  };
}

/**
 * Format annotation counts for display.
 * @param {Object} counts - Annotation counts by type
 * @returns {string} Formatted string like "ObjDet:5 Cap:2"
 */
export function formatAnnotationCounts(counts) {
  const parts = [];

  for (const type of TYPE_ORDER) {
    const count = counts[type];
    if (count && count > 0) {
      const abbrev = TYPE_ABBREVIATIONS[type];
      if (abbrev) {
        parts.push(`${abbrev}:${count}`);
      }
    }
  }

  return parts.join(" ");
}

/**
 * Escape HTML special characters.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format warning text for display in gallery item.
 * @param {Object} warnings - Warning data from getImageWarnings
 * @returns {string} Formatted warning text
 */
export function formatWarningText(warnings) {
  if (!warnings) return "";

  const parts = [];

  if (warnings.incomplete && warnings.incomplete.length > 0) {
    const supercats = warnings.incomplete
      .map((w) => w.supercategory)
      .join(", ");
    parts.push(`Incomplete: ${supercats}`);
  }

  if (warnings.nested && warnings.nested.length > 0) {
    parts.push(`Nested mismatch: ${warnings.nested.length}`);
  }

  return parts.join("; ");
}

/**
 * Create HTML for a single gallery item.
 * @param {Object} imageData - Image data from API
 * @returns {string} HTML string
 */
export function createGalleryItemHtml(imageData) {
  const { id, index, file_name, annotation_counts, total_annotations } =
    imageData;

  const countsStr = formatAnnotationCounts(annotation_counts);
  const isUnannotated = total_annotations === 0;
  const itemClass = isUnannotated ? "gallery-item unannotated" : "gallery-item";
  const escapedFilename = escapeHtml(file_name);

  // Check for validation warnings (if warning function is available)
  const warnings = getImageWarningsFunc ? getImageWarningsFunc(id) : null;
  const warningText = formatWarningText(warnings);
  const warningHtml = warnings
    ? `<div class="gallery-item-warning" title="${escapeHtml(warningText)}">⚠️ ${escapeHtml(warningText)}</div>`
    : "";

  // Note: onload/onerror handlers are attached programmatically in renderGalleryItems
  // because inline handlers don't work when HTML is inserted via innerHTML
  // Note: We don't use loading="lazy" because the image starts with display:none,
  // and lazy loading won't load hidden images, creating a deadlock.
  return `
    <div class="${itemClass}" data-index="${index}" data-image-id="${id}">
      <div class="gallery-thumbnail-container">
        <div class="gallery-thumbnail-spinner"></div>
        <img 
          class="gallery-thumbnail" 
          src="/api/thumbnail/${id}?size=256" 
          alt="${escapedFilename}"
        >
      </div>
      <div class="gallery-item-info">
        <div class="gallery-item-filename" title="${escapedFilename}">${escapedFilename}</div>
        <div class="gallery-item-counts">${countsStr}</div>
        ${warningHtml}
      </div>
    </div>
  `.trim();
}

/**
 * Load a page of gallery data from the API.
 * @param {number} page - Page number (0-indexed)
 * @returns {Promise<Object>} Gallery data response
 */
async function loadGalleryPage(page) {
  const response = await apiPost("/api/gallery-data", {
    page,
    page_size: PAGE_SIZE,
    filter: state.currentFilter,
    sort: state.currentSort,
  });
  return response;
}

/**
 * Render gallery items to the grid.
 * @param {Array} images - Array of image data
 * @param {boolean} append - Whether to append or replace
 */
function renderGalleryItems(images, append = false) {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  if (!append) {
    grid.innerHTML = "";
  }

  const fragment = document.createDocumentFragment();
  for (const imageData of images) {
    const div = document.createElement("div");
    div.innerHTML = createGalleryItemHtml(imageData);
    const item = div.firstElementChild;

    // Add click handler
    item.addEventListener("click", () => {
      handleImageClick(imageData.index);
    });

    // Attach image load/error handlers programmatically
    // (inline handlers don't work when HTML is inserted via innerHTML)
    const img = item.querySelector(".gallery-thumbnail");
    const spinner = item.querySelector(".gallery-thumbnail-spinner");
    if (img && spinner) {
      img.addEventListener("load", () => {
        img.style.display = "block";
        spinner.style.display = "none";
      });
      img.addEventListener("error", () => {
        spinner.textContent = "!";
        spinner.classList.add("error");
      });
    }

    fragment.appendChild(item);
  }
  grid.appendChild(fragment);
}

/**
 * Update gallery stats display.
 */
function updateGalleryStats() {
  const statsEl = document.getElementById("gallery-count");
  if (statsEl) {
    const loaded = state.loadedImages.length;
    const total = state.totalFiltered;
    statsEl.textContent = `Showing ${loaded} of ${total} images`;
  }
}

/**
 * Show/hide loading indicator.
 * @param {boolean} show - Whether to show loading
 */
function setLoading(show) {
  const loadingEl = document.getElementById("gallery-loading");
  if (loadingEl) {
    loadingEl.style.display = show ? "flex" : "none";
  }
  state.isLoading = show;
}

/**
 * Show/hide empty state.
 * @param {boolean} show - Whether to show empty state
 */
function setEmpty(show) {
  const emptyEl = document.getElementById("gallery-empty");
  if (emptyEl) {
    emptyEl.style.display = show ? "block" : "none";
  }
}

/**
 * Handle click on gallery item.
 * @param {number} imageIndex - Index of clicked image
 */
function handleImageClick(imageIndex) {
  switchToView(ViewType.EDITOR, { index: imageIndex });
}

/**
 * Check if we need to load more content to fill the viewport.
 * This handles the case where the initial page doesn't fill the screen.
 */
function checkNeedMoreContent() {
  if (state.isLoading || !state.hasMore) return;

  // If content doesn't fill the viewport, load more
  const contentHeight = document.body.offsetHeight;
  const viewportHeight = window.innerHeight;

  if (contentHeight <= viewportHeight + SCROLL_THRESHOLD) {
    loadNextPage();
  }
}

/**
 * Load next page of images (for infinite scroll).
 */
async function loadNextPage() {
  if (state.isLoading || !state.hasMore) return;

  setLoading(true);

  try {
    const data = await loadGalleryPage(state.currentPage);

    state.loadedImages = [...state.loadedImages, ...data.images];
    state.totalImages = data.total_images;
    state.totalFiltered = data.total_filtered;
    state.hasMore = data.has_more;
    state.currentPage++;

    renderGalleryItems(data.images, true);
    updateGalleryStats();
    setEmpty(state.loadedImages.length === 0);

    // After rendering, check if we need to load more to fill viewport
    // Use setTimeout to allow DOM to update
    setTimeout(checkNeedMoreContent, 100);
  } catch (error) {
    console.error("Error loading gallery page:", error);
  } finally {
    setLoading(false);
  }
}

/**
 * Reset and reload gallery with current filter/sort.
 */
async function reloadGallery() {
  state.currentPage = 0;
  state.loadedImages = [];
  state.hasMore = true;

  const grid = document.getElementById("gallery-grid");
  if (grid) {
    grid.innerHTML = "";
  }

  await loadNextPage();
}

/**
 * Handle filter change.
 * @param {string} filter - New filter value
 */
async function handleFilterChange(filter) {
  state.currentFilter = filter;
  updateUrlParams({ filter, page: 0 });
  await reloadGallery();
}

/**
 * Handle sort change.
 * @param {string} sort - New sort value
 */
async function handleSortChange(sort) {
  state.currentSort = sort;
  updateUrlParams({ sort, page: 0 });
  await reloadGallery();
}

/**
 * Setup infinite scroll listener.
 */
function setupInfiniteScroll() {
  const handleScroll = () => {
    if (state.isLoading || !state.hasMore) return;

    const scrollBottom =
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - SCROLL_THRESHOLD;

    if (scrollBottom) {
      loadNextPage();
    }
  };

  window.addEventListener("scroll", handleScroll);

  // Return cleanup function
  return () => {
    window.removeEventListener("scroll", handleScroll);
  };
}

/**
 * Setup gallery event listeners.
 */
function setupEventListeners() {
  // Filter dropdown
  const filterSelect = document.getElementById("gallery-filter");
  if (filterSelect) {
    filterSelect.addEventListener("change", (e) => {
      handleFilterChange(e.target.value);
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById("gallery-sort");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      handleSortChange(e.target.value);
    });
  }
}

/**
 * Initialize gallery with params from URL.
 * @param {Object} params - URL params (page, filter, sort)
 */
export async function initGallery(params = {}) {
  // Set initial state from params
  state.currentFilter = params.filter || "all";
  state.currentSort = params.sort || "index";
  state.currentPage = parseInt(params.page, 10) || 0;

  // Set dropdown values
  const filterSelect = document.getElementById("gallery-filter");
  if (filterSelect) {
    filterSelect.value = state.currentFilter;
  }

  const sortSelect = document.getElementById("gallery-sort");
  if (sortSelect) {
    sortSelect.value = state.currentSort;
  }

  // Setup listeners
  setupEventListeners();
  setupInfiniteScroll();

  // Load initial page
  await loadNextPage();
}

/**
 * Cleanup gallery (called when switching away).
 */
export function cleanupGallery() {
  resetGalleryState();
}
