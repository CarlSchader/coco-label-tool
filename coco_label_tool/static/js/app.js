import { CONFIG } from "./config.js";
import {
  ModalManager,
  hideAllModals,
  createWarningListItem,
  createNestedMismatchListItem,
} from "./modals.js";
import { apiGet, apiPost, showApiError } from "./api.js";
import {
  hashString,
  getSupercategoryColor,
  getCategoryColor,
  rgbToHex,
} from "./utils/colors.js";
import { isPolygonInsidePolygon, isPointInPolygon } from "./utils/geometry.js";
import { checkIncompleteSupercategories } from "./validation/incomplete.js";
import { checkNestedMaskSupercategoryMismatch } from "./validation/nested.js";
import {
  detectBoxInteraction,
  calculateBoxResize,
  getCursorForBoxInteraction,
  calculateDragBox,
  clampBoxToCanvas,
} from "./utils/box.js";
import {
  findAnnotationAtPoint,
  findAnnotationsInBox,
  findMostCommonCategoryId,
  getUniqueCategoryIds,
} from "./utils/annotations.js";
import { isPointInBounds, hasBoxCornerInBounds } from "./utils/bounds.js";
import {
  prepareMasksForSaving,
  validateMaskCategoriesForSaving,
} from "./utils/multi-mask-save.js";
import {
  updateBoxInArray,
  findBoxIndexAtPoint,
} from "./utils/box-manipulation.js";
import {
  getSegmentEndpoint,
  getModelInfoEndpoint,
  getSetModelSizeEndpoint,
  formatModelDisplayName,
} from "./utils/model-selection.js";
import { getMaskColor, shouldDrawMultipleMasks } from "./utils/mask-drawing.js";
import {
  findTopPointOfMask,
  initializeMaskCategories,
  validateMaskCategories,
  naturalToScreen,
  offsetOverlappingDropdowns,
} from "./utils/mask-category.js";
import {
  mergeMaskPolygons,
  mergeAnnotationSegmentations,
} from "./utils/mask-merging.js";
import { ImagePreloader } from "./utils/image-preloader.js";
import {
  getCrosshairLines,
  isMouseInCanvas,
  CROSSHAIR_DEFAULTS,
} from "./utils/crosshair.js";
import { ModeRegistry } from "./modes/mode-registry.js";
import { ModeManager } from "./modes/mode-manager.js";
import { SAM2Mode } from "./modes/sam2-mode.js";
import { SAM3PVSImageMode } from "./modes/sam3-pvs-image-mode.js";
import { SAM3PCSImageMode } from "./modes/sam3-pcs-image-mode.js";
import { ManualMode } from "./modes/manual-mode.js";
import { createManualSegmentationResult } from "./utils/manual-mask.js";
import {
  simplifyPath,
  isPathClosed,
  closePath,
  screenToNaturalPolygon,
  naturalToScreenPolygon,
  flattenPolygon,
  unflattenPolygon,
  isPointInPolygon as isPointInPolygonObjects,
  calculatePolygonCentroid,
  createMaskSegmentationResult,
} from "./utils/mask-prompt.js";
import {
  initViewManager,
  ViewType,
  updateUrlParams,
} from "./utils/view-manager.js";
import {
  initGallery,
  cleanupGallery,
  resetGalleryState,
  setWarningFunction,
} from "./gallery.js";

let images = [];
let currentModelType = "sam2";
let currentIndex = 0;

let totalImages = 0;
let cachedIndices = [];
let imageMap = {};
let lastCacheRefreshIndex = 0;

// Image preloader for async caching of nearby images
const imagePreloader = new ImagePreloader({ preloadRadius: 4 });

let pointModeEnabled = true;
let boxModeEnabled = true;
let clickPoints = [];
let clickLabels = [];
let canvas, ctx;
let crosshairCanvas, crosshairCtx;
let boxStart = null;
let boxStartButton = 0; // Track which mouse button started the box drag (0=left, 2=right)
let currentBox = null; // Legacy: kept for backward compatibility
let currentBoxes = []; // New: array of boxes
let currentBoxLabels = []; // Labels for each box (1=positive, 0=negative)
let currentTextPrompt = ""; // Text prompt for SAM3 PCS mode
let dragBox = null;
let currentSegmentation = null;
let categories = [];
let annotationsByImage = {};
let supercategoryColors = {};
let categoryColors = {};
let selectedAnnotationIds = new Set();
let selectedCategoryId = null;
let annotationsVisible = true;
let pendingNavigationIndex = null;
let hoveredPromptIndex = null;
let hoveredPromptType = null;
let boxInteractionMode = null;
let boxInteractionData = null;
let editingBoxIndex = -1; // Track which box in currentBoxes is being edited
let selectionMode = false;
let selectionBoxStart = null;
let selectionBoxDrag = null;
let hoveredAnnotationId = null;
let mouseDownTime = null;
let potentialBoxInteraction = null;

// Mask drawing state (CMD/CTRL + drag to draw freehand masks)
let maskDrawing = false; // True while CMD/CTRL + drag in progress
let maskDrawingPoints = []; // Screen coordinates of current drawing [{x, y}, ...]
let currentMaskPrompts = []; // Array of completed mask polygons in natural coords (COCO flat format)

// Crosshair guide position (null when mouse is outside canvas)
let crosshairPosition = null;

// Per-mask category selection
let maskCategoryIds = []; // Array of category IDs, one per mask
let focusedMaskIndex = null; // Index of mask with focused dropdown (for highlighting)

// S3 Support state
let isS3Dataset = false;
let s3SourceUri = "";
let s3IsDirty = false; // Track unsaved changes
let s3UploadInProgress = false; // Prevent race conditions

// View management state
let currentView = ViewType.EDITOR;
let galleryInitialized = false;

// S3 Support functions
function updateS3UI() {
  const banner = document.getElementById("s3-banner");
  const saveBtn = document.getElementById("save-to-s3-btn");
  const sourceUriSpan = document.getElementById("s3-source-uri");
  const dirtyIndicator = document.getElementById("s3-dirty-indicator");

  if (isS3Dataset) {
    // Show S3 UI elements
    if (banner) banner.style.display = "block";
    if (saveBtn) saveBtn.style.display = "inline-block";
    if (sourceUriSpan) sourceUriSpan.textContent = s3SourceUri;
    if (dirtyIndicator)
      dirtyIndicator.style.display = s3IsDirty ? "inline" : "none";

    // Update save button state
    if (saveBtn) {
      saveBtn.disabled = s3UploadInProgress || !s3IsDirty;
      if (s3UploadInProgress) {
        saveBtn.textContent = "Uploading...";
      } else if (s3IsDirty) {
        saveBtn.textContent = "Save to S3";
      } else {
        saveBtn.textContent = "Saved";
      }
    }
  } else {
    // Hide S3 UI elements for local datasets
    if (banner) banner.style.display = "none";
    if (saveBtn) saveBtn.style.display = "none";
  }
}

function markS3Dirty() {
  if (isS3Dataset && !s3IsDirty) {
    s3IsDirty = true;
    updateS3UI();
    console.log("S3 dataset marked as dirty (unsaved changes)");
  }
}

async function saveToS3() {
  if (!isS3Dataset) {
    console.warn("saveToS3 called but not an S3 dataset");
    return;
  }

  if (s3UploadInProgress) {
    console.warn("S3 upload already in progress");
    return;
  }

  if (!s3IsDirty) {
    console.log("No unsaved changes to upload");
    return;
  }

  s3UploadInProgress = true;
  updateS3UI();

  const progressContainer = document.getElementById("s3-progress-container");
  const progressFill = document.getElementById("s3-progress-fill");
  const progressText = document.getElementById("s3-progress-text");
  const saveStatus = document.getElementById("s3-save-status");

  // Show progress UI
  if (saveStatus) saveStatus.style.display = "inline-block";
  if (progressContainer) progressContainer.style.display = "block";
  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = "Preparing upload...";

  try {
    // Simulate progress (actual upload is single request)
    if (progressFill) progressFill.style.width = "30%";
    if (progressText) progressText.textContent = "Uploading to S3...";

    const response = await fetch("/api/save-to-s3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (progressFill) progressFill.style.width = "90%";

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Upload failed: ${response.statusText}`,
      );
    }

    const result = await response.json();

    // Success
    if (progressFill) progressFill.style.width = "100%";
    if (progressText) progressText.textContent = "Upload complete!";

    s3IsDirty = false;
    console.log("S3 upload successful:", result);

    // Hide progress after a delay
    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = "none";
      if (saveStatus) saveStatus.style.display = "none";
      updateS3UI();
    }, 2000);
  } catch (error) {
    console.error("S3 upload failed:", error);
    if (progressText) {
      progressText.textContent = `Upload failed: ${error.message}`;
      progressText.style.color = "#ff5555";
    }

    // Reset progress text color after delay
    setTimeout(() => {
      if (progressText) progressText.style.color = "";
      if (progressContainer) progressContainer.style.display = "none";
      if (saveStatus) saveStatus.style.display = "none";
    }, 5000);
  } finally {
    s3UploadInProgress = false;
    updateS3UI();
  }
}

let incompleteModal,
  nestedMismatchModal,
  combinedWarningModal,
  deleteModal,
  categoryModal,
  mergeCategoryModal;

// Mode system
const modeRegistry = new ModeRegistry();
let modeManager = null;
let currentModeId = null;

// Register available modes
modeRegistry.register("sam2", SAM2Mode, {
  displayName: "SAM2",
  description: "Original SAM2 with single box and point prompts",
  modelType: "sam2",
});

modeRegistry.register("sam3-pvs-image", SAM3PVSImageMode, {
  displayName: "SAM3 PVS Image",
  description: "SAM3 Tracker with multiple boxes for multi-object segmentation",
  modelType: "sam3",
});

modeRegistry.register("sam3-pcs-image", SAM3PCSImageMode, {
  displayName: "SAM3 PCS Image",
  description: "SAM3 Concept Search with text prompts to find ALL instances",
  modelType: "sam3-pcs",
});

modeRegistry.register("manual", ManualMode, {
  displayName: "Manual",
  description: "Draw rectangular masks directly without ML model",
  modelType: "manual",
});

// View Management Functions

/**
 * Handle view changes (called when navigating between editor and gallery)
 * @param {string} view - ViewType.EDITOR or ViewType.GALLERY
 * @param {Object} params - View-specific parameters
 */
async function handleViewChange(view, params = {}) {
  console.log(`Switching to view: ${view}`, params);

  const editorView = document.getElementById("editor-view");
  const galleryView = document.getElementById("gallery-view");
  const navEditor = document.getElementById("nav-editor");
  const navGallery = document.getElementById("nav-gallery");

  currentView = view;

  if (view === ViewType.GALLERY) {
    // Switch to Gallery View
    if (editorView) editorView.style.display = "none";
    if (galleryView) galleryView.style.display = "block";

    // Show "Back to Editor" button, hide "Browse Gallery" button
    if (navEditor) navEditor.style.display = "inline-block";
    if (navGallery) navGallery.style.display = "none";

    // Initialize gallery
    resetGalleryState();
    await initGallery(params);
    galleryInitialized = true;
  } else {
    // Switch to Editor View
    if (galleryView) galleryView.style.display = "none";
    if (editorView) editorView.style.display = "block";

    // Show "Browse Gallery" button, hide "Back to Editor" button
    if (navGallery) navGallery.style.display = "inline-block";
    if (navEditor) navEditor.style.display = "none";

    // Cleanup gallery if it was initialized
    if (galleryInitialized) {
      cleanupGallery();
      galleryInitialized = false;
    }

    // Navigate to specific image if index provided
    if (params.index !== undefined) {
      const index = parseInt(params.index, 10);
      if (!isNaN(index) && index >= 0) {
        // Wait for dataset to be loaded before navigating
        if (images.length > 0) {
          navigateToImage(index);
        } else {
          // Store for later when dataset loads
          pendingNavigationIndex = index;
        }
      }
    }
  }
}

function getSupercategoryColorLocal(supercategory) {
  return getSupercategoryColor(supercategory, categories, supercategoryColors);
}

function getCategoryColorLocal(category) {
  return getCategoryColor(
    category,
    categories,
    supercategoryColors,
    categoryColors,
  );
}

function checkIncompleteSupercategoriesLocal() {
  const imgData = imageMap[currentIndex];
  try {
    const result = checkIncompleteSupercategories(
      imgData,
      annotationsByImage,
      categories,
    );
    console.log("Incomplete check result:", result);
    return result;
  } catch (error) {
    console.error("Error in checkIncompleteSupercategories:", error);
    return null;
  }
}

function checkNestedMaskSupercategoryMismatchLocal() {
  const imgData = imageMap[currentIndex];
  try {
    const result = checkNestedMaskSupercategoryMismatch(
      imgData,
      annotationsByImage,
      categories,
    );
    console.log("Nested mismatch check result:", result);
    return result;
  } catch (error) {
    console.error("Error in checkNestedMaskSupercategoryMismatch:", error);
    return null;
  }
}

/**
 * Get original image dimensions from COCO JSON metadata.
 * These are the dimensions annotations are stored in, which may differ
 * from naturalWidth/naturalHeight if the image was resized for display.
 * @returns {{width: number, height: number}} Original image dimensions
 */
function getOriginalImageDimensions() {
  const imgData = imageMap[currentIndex];
  if (imgData && imgData.width && imgData.height) {
    return { width: imgData.width, height: imgData.height };
  }
  // Fallback to naturalWidth/naturalHeight if COCO data not available
  const img = document.getElementById("image");
  return { width: img.naturalWidth, height: img.naturalHeight };
}

function populateCategoryBadges() {
  const container = document.getElementById("category-badges");
  container.innerHTML = "";

  const sortedCategories = [...categories].sort((a, b) => {
    const superA = a.supercategory || "none";
    const superB = b.supercategory || "none";
    if (superA !== superB) {
      return superA.localeCompare(superB);
    }
    return a.name.localeCompare(b.name);
  });

  sortedCategories.forEach((cat) => {
    const badge = document.createElement("div");
    badge.className = "badge";

    const supercatDisplay =
      cat.supercategory && cat.supercategory !== "none"
        ? cat.supercategory
        : "none";
    badge.textContent = `${supercatDisplay}:${cat.name}`;

    const rgb = getCategoryColorLocal(cat);
    const hexColor = rgbToHex(rgb);
    badge.style.backgroundColor = hexColor;
    badge.style.borderColor = hexColor;
    badge.style.color = "#fff";

    if (cat.id === selectedCategoryId) {
      badge.classList.add("selected");
    }

    badge.onclick = () => handleCategoryClick(cat.id);
    container.appendChild(badge);
  });
}

function handleCategoryClick(catId) {
  console.log("Category clicked:", catId, typeof catId);
  selectedCategoryId = catId;

  // If there are unsaved masks, set all their categories to the clicked category
  if (currentSegmentation && currentSegmentation.segmentation.length > 0) {
    const numMasks = currentSegmentation.segmentation.length;
    maskCategoryIds = Array(numMasks).fill(catId);
    console.log(`✅ Set all ${numMasks} mask categories to category ${catId}`);

    // Re-render dropdowns to show updated selection
    renderMaskCategoryDropdowns();
  }

  populateCategoryBadges();
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const saveBtn = document.getElementById("save-btn");
  const hasSegmentation = currentSegmentation !== null;

  // Check if all masks have categories selected
  const numMasks = currentSegmentation?.segmentation?.length || 0;
  const allCategoriesValid = validateMaskCategories(maskCategoryIds, numMasks);

  console.log("Save button state:", {
    hasSegmentation,
    allCategoriesValid,
    maskCategoryIds,
    numMasks,
    currentSegmentation,
  });

  const canSave = hasSegmentation && allCategoriesValid;
  saveBtn.disabled = !canSave;

  if (!canSave) {
    saveBtn.style.opacity = "0.5";
    saveBtn.style.cursor = "not-allowed";
  } else {
    saveBtn.style.opacity = "1";
    saveBtn.style.cursor = "pointer";
  }
}

function updateCacheInfo() {
  if (cachedIndices.length === 0) {
    document.getElementById("cache-info").textContent = "Cache: empty";
    return;
  }

  const ranges = [];
  let start = cachedIndices[0];
  let end = cachedIndices[0];

  // Add preloader stats
  const preloaderStats = imagePreloader.getStats();
  const preloadInfo = ` | Preloaded: ${preloaderStats.cachedImages} images`;

  for (let i = 1; i < cachedIndices.length; i++) {
    if (cachedIndices[i] === end + 1) {
      end = cachedIndices[i];
    } else {
      ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
      start = cachedIndices[i];
      end = cachedIndices[i];
    }
  }
  ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);

  document.getElementById("cache-info").textContent =
    `Cache: ${ranges.join(", ")}${preloadInfo}`;
}

async function loadDataset(preserveIndex = false) {
  // Fetch dataset info first to check if S3
  try {
    const infoResponse = await fetch("/api/dataset-info");
    if (infoResponse.ok) {
      const info = await infoResponse.json();
      isS3Dataset = info.is_s3;
      s3SourceUri = info.source_uri || "";
      s3IsDirty = info.is_dirty || false;
      updateS3UI();
    }
  } catch (error) {
    console.warn("Failed to fetch dataset info:", error);
  }

  const response = await fetch("/api/dataset");
  const data = await response.json();
  images = data.images;
  imageMap = data.image_map;
  totalImages = data.total_images;
  cachedIndices = data.cached_indices || [];
  annotationsByImage = data.annotations_by_image || {};
  updateCacheInfo();

  const categoriesResponse = await fetch("/api/categories");
  const categoriesData = await categoriesResponse.json();
  categories = categoriesData.categories;

  populateCategoryBadges();

  if (images.length > 0) {
    if (preserveIndex) {
      showImage(currentIndex % totalImages);
    } else if (pendingNavigationIndex !== null) {
      // Navigation index was set from URL params before dataset loaded
      const targetIndex = Math.min(pendingNavigationIndex, totalImages - 1);
      pendingNavigationIndex = null;
      showImage(targetIndex);
    } else if (currentView === ViewType.EDITOR) {
      // Default to first image in editor view
      showImage(0);
    }
  }
}

async function ensureImageLoaded(index) {
  const needsRefresh = Math.abs(index - lastCacheRefreshIndex) >= 16;

  if (needsRefresh || !imageMap[index]) {
    const margin = 32;
    const start = Math.max(0, index - margin);
    const end = Math.min(totalImages, index + margin);

    await fetch("/api/load-range", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ start, end }),
    });

    const response = await fetch("/api/dataset");
    const data = await response.json();
    images = data.images;
    imageMap = data.image_map;
    cachedIndices = data.cached_indices || [];
    annotationsByImage = data.annotations_by_image || {};
    updateCacheInfo();
    lastCacheRefreshIndex = index;
  }
}

async function showImage(index) {
  if (totalImages === 0) return;

  currentIndex = ((index % totalImages) + totalImages) % totalImages;

  // Update URL params (only in editor view)
  if (currentView === ViewType.EDITOR) {
    updateUrlParams({ index: currentIndex });
  }

  document.getElementById("spinner").classList.add("show");
  document.getElementById("empty-image-message").classList.remove("show");

  await ensureImageLoaded(currentIndex);

  const img = imageMap[currentIndex];

  if (!img) {
    console.error(`Image at index ${currentIndex} not found in cache`);
    document.getElementById("spinner").classList.remove("show");
    return;
  }

  // Trigger async preloading of nearby images (don't wait)
  imagePreloader.updateState(currentIndex, totalImages, imageMap);

  // Periodically prune cache to prevent unbounded memory growth
  if (currentIndex % 20 === 0) {
    imagePreloader.pruneCache();
  }

  document.getElementById("image").src = "/api/image/" + img.id;
  document.getElementById("image-id").textContent = img.id;
  document.getElementById("file-name").textContent = img.file_name;
  document.getElementById("dimensions").textContent =
    img.width + " x " + img.height;
  document.getElementById("counter").textContent =
    `Image ${currentIndex + 1} of ${totalImages}`;

  const indexInput = document.getElementById("index-input");
  if (indexInput) {
    indexInput.max = totalImages;
    indexInput.value = "";
    indexInput.placeholder = `Go to (1-${totalImages})`;
  }

  clickPoints = [];
  clickLabels = [];
  boxStart = null;
  currentBox = null;
  dragBox = null;
  currentSegmentation = null;
  hoveredPromptIndex = null;
  hoveredPromptType = null;
  selectionBoxStart = null;
  selectionBoxDrag = null;
  hoveredAnnotationId = null;
  selectedAnnotationIds.clear();
  updateAnnotationEditor();
  if (canvas) {
    canvas.style.cursor = "crosshair";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  updateSaveButtonState();
  updateMergeButtonState();

  const imgElement = document.getElementById("image");
  imgElement.onload = () => {
    document.getElementById("spinner").classList.remove("show");
    // Check for empty image (0x0 dimensions)
    if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
      document.getElementById("empty-image-message").classList.add("show");
      return;
    }
    setupCanvas();
    drawExistingAnnotations();
  };
  imgElement.onerror = () => {
    document.getElementById("spinner").classList.remove("show");
    document.getElementById("empty-image-message").classList.add("show");
  };
}

function drawExistingAnnotations() {
  const imgData = imageMap[currentIndex];
  if (!imgData) return;

  const annotations = annotationsByImage[imgData.id] || [];

  const annotationListDiv = document.getElementById("annotation-list");
  const annotationItemsDiv = document.getElementById("annotation-items");

  if (annotations.length === 0) {
    annotationListDiv.style.display = "none";
    return;
  }

  annotationListDiv.style.display = "block";
  annotationItemsDiv.innerHTML = "";

  annotations.forEach((ann) => {
    const category = categories.find((c) => c.id === ann.category_id);
    const itemDiv = document.createElement("div");
    itemDiv.className = "annotation-item";
    if (selectedAnnotationIds.has(ann.id)) {
      itemDiv.classList.add("selected");
    }
    itemDiv.onclick = (e) => selectAnnotation(ann.id, e.ctrlKey || e.metaKey);
    const categoryLabel = category
      ? category.supercategory && category.supercategory !== "none"
        ? `${category.supercategory} > ${category.name}`
        : category.name
      : "Unknown";

    let colorIndicator = "";
    if (category) {
      const rgb = getCategoryColorLocal(category);
      const hexColor = rgbToHex(rgb);
      colorIndicator = `<span style="display: inline-block; width: 12px; height: 12px; background-color: ${hexColor}; border: 1px solid #fff; border-radius: 2px; margin-right: 8px; vertical-align: middle;"></span>`;
    }

    itemDiv.innerHTML = `
                        <span>${colorIndicator}${categoryLabel} (ID: ${ann.id})</span>
                    `;
    annotationItemsDiv.appendChild(itemDiv);
  });

  if (!canvas) {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    const img = document.getElementById("image");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = img.width + "px";
    canvas.style.height = img.height + "px";
  }

  const img = document.getElementById("image");
  // Scale from original image dimensions (COCO JSON) to display dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = img.width / originalDims.width;
  const scaleY = img.height / originalDims.height;

  // Filter annotations based on visibility and selection
  const visibleAnnotations = annotationsVisible
    ? annotations
    : annotations.filter((ann) => selectedAnnotationIds.has(ann.id));

  for (const annotation of visibleAnnotations) {
    const category = categories.find((c) => c.id === annotation.category_id);
    const rgb = getCategoryColorLocal(category);
    const fillColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)`;
    ctx.fillStyle = fillColor;

    for (const polygon of annotation.segmentation) {
      ctx.beginPath();
      for (let i = 0; i < polygon.length; i += 2) {
        const x = polygon[i] * scaleX;
        const y = polygon[i + 1] * scaleY;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const annotation of visibleAnnotations) {
    const category = categories.find((c) => c.id === annotation.category_id);

    const rgb = getCategoryColorLocal(category);
    const color = rgbToHex(rgb);

    const isSelected = selectedAnnotationIds.has(annotation.id);
    const isHovered = hoveredAnnotationId === annotation.id;

    if (isHovered && !isSelected) {
      ctx.strokeStyle = CONFIG.colors.hover || "#ffff00";
      ctx.lineWidth = 3;
    } else if (isSelected) {
      ctx.strokeStyle = CONFIG.colors.positive;
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
    }

    let minX = Infinity,
      minY = Infinity;

    for (const polygon of annotation.segmentation) {
      ctx.beginPath();
      for (let i = 0; i < polygon.length; i += 2) {
        const x = polygon[i] * scaleX;
        const y = polygon[i + 1] * scaleY;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    if (category) {
      const categoryLabel =
        category.supercategory && category.supercategory !== "none"
          ? `${category.supercategory} > ${category.name}`
          : category.name;

      const rgb = getCategoryColorLocal(category);
      const isSelected = selectedAnnotationIds.has(annotation.id);
      const labelColor = isSelected ? CONFIG.colors.positive : rgbToHex(rgb);

      ctx.font = "10px Arial";
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      const textWidth = ctx.measureText(categoryLabel).width;
      ctx.fillRect(minX - 2, minY - 14, textWidth + 4, 12);

      ctx.fillStyle = labelColor;
      ctx.fillText(categoryLabel, minX, minY - 5);
    }
  }
}

function handleAnnotationClick(x, y, multiSelect = false) {
  const imgData = imageMap[currentIndex];
  if (!imgData) return;

  const annotations = annotationsByImage[imgData.id] || [];
  if (annotations.length === 0) return;

  const img = document.getElementById("image");
  // Scale from display to original image dimensions (where annotations are stored)
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const annotationId = findAnnotationAtPoint(x, y, annotations, scaleX, scaleY);

  if (annotationId) {
    selectAnnotation(annotationId, multiSelect);
  } else if (!multiSelect) {
    selectedAnnotationIds.clear();
    updateAnnotationEditor();
    redrawCanvas();
  }
}

function handleAnnotationBoxSelect(box, multiSelect = false) {
  if (!box) return;

  const imgData = imageMap[currentIndex];
  if (!imgData) return;

  const annotations = annotationsByImage[imgData.id] || [];
  if (annotations.length === 0) return;

  // Use original image dimensions for annotation bounds
  const originalDims = getOriginalImageDimensions();

  const clampedBox = clampBoxToCanvas(
    box,
    originalDims.width,
    originalDims.height,
  );
  const selectedIds = findAnnotationsInBox(clampedBox, annotations, 1, 1);

  if (!multiSelect) {
    selectedAnnotationIds.clear();
  }

  selectedIds.forEach((id) => {
    selectedAnnotationIds.add(id);
  });

  updateAnnotationEditor();
  redrawCanvas();
}

function checkAnnotationHover(e) {
  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions (where annotations are stored)
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const x = mouseX * scaleX;
  const y = mouseY * scaleY;

  const imgData = imageMap[currentIndex];
  if (!imgData) return;

  const annotations = annotationsByImage[imgData.id] || [];
  if (annotations.length === 0) return;

  const annotationId = findAnnotationAtPoint(x, y, annotations, scaleX, scaleY);

  if (annotationId !== hoveredAnnotationId) {
    hoveredAnnotationId = annotationId;
    canvas.style.cursor = annotationId ? "pointer" : "default";
    redrawCanvas();
  }
}

function selectAnnotation(annotationId, multiSelect = false) {
  if (multiSelect) {
    if (selectedAnnotationIds.has(annotationId)) {
      selectedAnnotationIds.delete(annotationId);
    } else {
      selectedAnnotationIds.add(annotationId);
    }
  } else {
    if (
      selectedAnnotationIds.has(annotationId) &&
      selectedAnnotationIds.size === 1
    ) {
      selectedAnnotationIds.clear();
    } else {
      selectedAnnotationIds.clear();
      selectedAnnotationIds.add(annotationId);
    }
  }

  updateAnnotationEditor();

  if (canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawExistingAnnotations();
}

function updateAnnotationEditor() {
  const editor = document.getElementById("annotation-editor");
  const countSpan = document.getElementById("selected-count");
  const categorySelect = document.getElementById("edit-category-select");

  if (selectedAnnotationIds.size === 0) {
    editor.style.display = "none";
  } else {
    editor.style.display = "block";
    countSpan.textContent = selectedAnnotationIds.size;

    categorySelect.innerHTML =
      '<option value="">-- Select Category --</option>';
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.id;
      const label =
        cat.supercategory && cat.supercategory !== "none"
          ? `${cat.supercategory} > ${cat.name}`
          : cat.name;
      option.textContent = label;
      categorySelect.appendChild(option);
    });
  }

  // Update merge button state
  updateMergeAnnotationsButtonState();
}

async function changeSelectedAnnotationsCategory() {
  const categorySelect = document.getElementById("edit-category-select");
  const newCategoryId = parseInt(categorySelect.value);

  if (!newCategoryId) {
    alert("Please select a category");
    return;
  }

  if (selectedAnnotationIds.size === 0) {
    alert("Please select at least one annotation");
    return;
  }

  try {
    const updatePromises = Array.from(selectedAnnotationIds).map(
      (annotationId) =>
        fetch("/api/update-annotation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            annotation_id: annotationId,
            category_id: newCategoryId,
          }),
        }),
    );

    const responses = await Promise.all(updatePromises);
    const allSuccessful = responses.every((r) => r.ok);

    if (allSuccessful) {
      await loadDataset(true);
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawExistingAnnotations();
      }
    } else {
      alert("Error updating some annotations");
    }
  } catch (error) {
    console.error("Update annotations error:", error);
    alert("Error updating annotations");
  }
}

async function deleteSelectedAnnotations() {
  if (selectedAnnotationIds.size === 0) {
    alert("Please select at least one annotation to delete");
    return;
  }

  const count = selectedAnnotationIds.size;
  const message =
    count === 1
      ? "Are you sure you want to delete this annotation?"
      : `Are you sure you want to delete ${count} annotations?`;

  if (!confirm(message)) {
    return;
  }

  try {
    const deletePromises = Array.from(selectedAnnotationIds).map(
      (annotationId) =>
        fetch("/api/delete-annotation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotation_id: annotationId,
            confirmed: true,
          }),
        }),
    );

    const responses = await Promise.all(deletePromises);
    const allSuccessful = responses.every((r) => r.ok);

    if (allSuccessful) {
      selectedAnnotationIds.clear();
      markS3Dirty(); // Mark S3 dataset as having unsaved changes
      await loadDataset(true);
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawExistingAnnotations();
      }
    } else {
      alert("Error deleting some annotations");
    }
  } catch (error) {
    console.error("Delete annotation error:", error);
    alert("Error deleting annotations");
  }
}

// Store pending merge data when showing category selection modal
let pendingMergeData = null;

function updateMergeAnnotationsButtonState() {
  const mergeBtn = document.getElementById("btn-merge-annotations");
  if (!mergeBtn) return;

  const canMerge = selectedAnnotationIds.size >= 2;
  mergeBtn.disabled = !canMerge;

  if (!canMerge) {
    mergeBtn.style.opacity = "0.5";
    mergeBtn.style.cursor = "not-allowed";
  } else {
    mergeBtn.style.opacity = "1";
    mergeBtn.style.cursor = "pointer";
  }
}

async function mergeSelectedAnnotations() {
  if (selectedAnnotationIds.size < 2) {
    alert("Please select at least 2 annotations to merge");
    return;
  }

  const currentImage = imageMap[currentIndex];
  if (!currentImage) return;

  const annotations = annotationsByImage[currentImage.id] || [];
  const selectedAnnotations = annotations.filter((ann) =>
    selectedAnnotationIds.has(ann.id),
  );

  if (selectedAnnotations.length < 2) {
    alert("Could not find selected annotations");
    return;
  }

  // Check if all annotations have the same category
  const uniqueCategoryIds = getUniqueCategoryIds(selectedAnnotations);

  if (uniqueCategoryIds.length === 1) {
    // All same category - merge directly
    await performMerge(uniqueCategoryIds[0], selectedAnnotations);
  } else {
    // Different categories - show modal for category selection
    const mostCommonCategoryId = findMostCommonCategoryId(selectedAnnotations);
    showMergeCategoryModal(
      uniqueCategoryIds,
      mostCommonCategoryId,
      selectedAnnotations,
    );
  }
}

function showMergeCategoryModal(
  uniqueCategoryIds,
  defaultCategoryId,
  selectedAnnotations,
) {
  const optionsContainer = document.getElementById("merge-category-options");
  if (!optionsContainer) return;

  // Store pending merge data
  pendingMergeData = {
    selectedAnnotations,
    defaultCategoryId,
  };

  // Build category options with radio buttons
  optionsContainer.innerHTML = "";

  uniqueCategoryIds.forEach((categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    const isDefault = categoryId === defaultCategoryId;
    const rgb = getCategoryColorLocal(category);
    const hexColor = rgbToHex(rgb);

    // Count how many selected annotations have this category
    const count = selectedAnnotations.filter(
      (ann) => ann.category_id === categoryId,
    ).length;

    const optionDiv = document.createElement("div");
    optionDiv.style.cssText =
      "display: flex; align-items: center; padding: 10px; margin-bottom: 8px; " +
      "background: #0d1117; border: 1px solid #30363d; border-radius: 4px; cursor: pointer;";

    if (isDefault) {
      optionDiv.style.borderColor = "#48d1cc";
    }

    const categoryLabel =
      category.supercategory && category.supercategory !== "none"
        ? `${category.supercategory} > ${category.name}`
        : category.name;

    optionDiv.innerHTML = `
      <input type="radio" name="merge-category" value="${categoryId}" 
             ${isDefault ? "checked" : ""} 
             style="margin-right: 12px; accent-color: #48d1cc;">
      <span style="display: inline-block; width: 16px; height: 16px; 
                   background-color: ${hexColor}; border: 1px solid #fff; 
                   border-radius: 2px; margin-right: 10px;"></span>
      <span style="flex: 1;">${categoryLabel}</span>
      <span style="color: #8a9199; font-size: 12px;">(${count} selected)</span>
    `;

    // Click anywhere on the option to select the radio
    optionDiv.addEventListener("click", () => {
      const radio = optionDiv.querySelector('input[type="radio"]');
      radio.checked = true;
    });

    optionsContainer.appendChild(optionDiv);
  });

  mergeCategoryModal.show();
}

async function confirmMerge() {
  if (!pendingMergeData) {
    mergeCategoryModal.hide();
    return;
  }

  const selectedRadio = document.querySelector(
    'input[name="merge-category"]:checked',
  );
  if (!selectedRadio) {
    alert("Please select a category");
    return;
  }

  const categoryId = parseInt(selectedRadio.value);
  await performMerge(categoryId, pendingMergeData.selectedAnnotations);

  pendingMergeData = null;
  mergeCategoryModal.hide();
}

function cancelMerge() {
  pendingMergeData = null;
  mergeCategoryModal.hide();
}

async function performMerge(categoryId, selectedAnnotations) {
  const currentImage = imageMap[currentIndex];
  if (!currentImage) return;

  // Merge all segmentations
  const mergedResult = mergeAnnotationSegmentations(selectedAnnotations);
  if (!mergedResult) {
    alert("Failed to merge annotations - no valid polygons found");
    return;
  }

  try {
    // 1. Save the new merged annotation
    const saveResponse = await fetch("/api/save-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_id: currentImage.id,
        category_id: categoryId,
        segmentation: mergedResult.mergedPolygons,
      }),
    });

    if (!saveResponse.ok) {
      throw new Error("Failed to save merged annotation");
    }

    const saveData = await saveResponse.json();
    const newAnnotationId = saveData.annotation?.id;

    // 2. Delete the original annotations
    const deletePromises = selectedAnnotations.map((ann) =>
      fetch("/api/delete-annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation_id: ann.id,
          confirmed: true,
        }),
      }),
    );

    const deleteResponses = await Promise.all(deletePromises);
    const allDeleted = deleteResponses.every((r) => r.ok);

    if (!allDeleted) {
      console.warn("Some original annotations could not be deleted");
    }

    // 3. Clear selection and select the new merged annotation
    selectedAnnotationIds.clear();
    if (newAnnotationId) {
      selectedAnnotationIds.add(newAnnotationId);
    }

    // 4. Mark S3 as dirty and refresh
    markS3Dirty();
    await loadDataset(true);

    if (canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawExistingAnnotations();
    }

    // Update UI
    updateAnnotationEditor();
    updateMergeAnnotationsButtonState();

    console.log(
      `Merged ${selectedAnnotations.length} annotations into annotation #${newAnnotationId}`,
    );
  } catch (error) {
    console.error("Merge annotations error:", error);
    alert("Error merging annotations: " + error.message);
  }
}

function previousImage() {
  console.log("Previous button clicked, current index:", currentIndex);
  navigateToImage(currentIndex - 1);
}

function nextImage() {
  console.log("Next button clicked, current index:", currentIndex);
  navigateToImage(currentIndex + 1);
}

function navigateToImage(targetIndex) {
  console.log("Navigate to image:", targetIndex, "from:", currentIndex);

  // Skip validation warnings if disabled in config
  if (!CONFIG.navigation.showWarnings) {
    console.log("Navigation warnings disabled, navigating directly");
    showImage(targetIndex);
    return;
  }

  const incomplete = checkIncompleteSupercategoriesLocal();
  const nestedMismatches = checkNestedMaskSupercategoryMismatchLocal();

  console.log(
    "Validation checks - incomplete:",
    incomplete,
    "nestedMismatches:",
    nestedMismatches,
  );

  if (incomplete && nestedMismatches) {
    console.log("Showing combined warning");
    pendingNavigationIndex = targetIndex;
    showCombinedWarning(incomplete, nestedMismatches);
  } else if (incomplete) {
    console.log("Showing incomplete warning");
    pendingNavigationIndex = targetIndex;
    showIncompleteSupercategoryWarning(incomplete);
  } else if (nestedMismatches) {
    console.log("Showing nested mismatch warning");
    pendingNavigationIndex = targetIndex;
    showNestedMaskMismatchWarning(nestedMismatches);
  } else {
    console.log("Navigating directly to image:", targetIndex);
    showImage(targetIndex);
  }
}

function showIncompleteSupercategoryWarning(incompleteData) {
  const listDiv = incompleteModal.getContentElement(
    "incomplete-supercategory-list",
  );
  listDiv.innerHTML = "";

  incompleteData.forEach((item) => {
    const itemDiv = createWarningListItem(
      item.supercategory,
      item.annotated,
      item.missing,
    );
    listDiv.appendChild(itemDiv);
  });

  incompleteModal.show();
}

function showNestedMaskMismatchWarning(mismatches) {
  const listDiv = nestedMismatchModal.getContentElement(
    "nested-mask-mismatch-list",
  );
  listDiv.innerHTML = "";

  mismatches.forEach((mismatch) => {
    const itemDiv = createNestedMismatchListItem(mismatch);
    listDiv.appendChild(itemDiv);
  });

  nestedMismatchModal.show();
}

function showCombinedWarning(incompleteData, nestedMismatches) {
  const contentDiv = document.getElementById("combined-warning-content");
  contentDiv.innerHTML = "";

  const incompleteSection = document.createElement("div");
  incompleteSection.style.cssText = "margin-bottom: 20px;";
  incompleteSection.innerHTML =
    '<h3 style="color: #d29922; font-size: 16px; margin-bottom: 10px;">Incomplete Supercategories</h3>';

  const incompleteList = document.createElement("div");
  incompleteList.style.cssText =
    "background: #1a1f2e; padding: 15px; border-radius: 4px;";

  incompleteData.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.style.cssText = "margin-bottom: 10px; font-size: 12px;";
    itemDiv.innerHTML = `
                        <div style="font-weight: bold; color: #48d1cc;">${item.supercategory}</div>
                        <div style="color: #f85149;">Missing: ${item.missing.join(", ")}</div>
                    `;
    incompleteList.appendChild(itemDiv);
  });

  incompleteSection.appendChild(incompleteList);
  contentDiv.appendChild(incompleteSection);

  const nestedSection = document.createElement("div");
  nestedSection.innerHTML =
    '<h3 style="color: #f85149; font-size: 16px; margin-bottom: 10px;">Nested Mask Mismatches</h3>';

  const nestedList = document.createElement("div");
  nestedList.style.cssText =
    "background: #1a1f2e; padding: 15px; border-radius: 4px;";

  nestedMismatches.forEach((mismatch) => {
    const itemDiv = document.createElement("div");
    itemDiv.style.cssText = "margin-bottom: 10px; font-size: 12px;";
    itemDiv.innerHTML = `
                        <div><strong>${mismatch.inner.category}</strong> (${mismatch.inner.supercategory}) inside <strong>${mismatch.outer.category}</strong> (${mismatch.outer.supercategory})</div>
                    `;
    nestedList.appendChild(itemDiv);
  });

  nestedSection.appendChild(nestedList);
  contentDiv.appendChild(nestedSection);

  document.getElementById("combinedWarningModal").classList.add("show");
}

function cancelNavigation() {
  pendingNavigationIndex = null;
  hideAllModals(incompleteModal, nestedMismatchModal, combinedWarningModal);
}

function confirmNavigation() {
  hideAllModals(incompleteModal, nestedMismatchModal, combinedWarningModal);
  if (pendingNavigationIndex !== null) {
    showImage(pendingNavigationIndex);
    pendingNavigationIndex = null;
  }
}

function toggleAnnotationsVisibility() {
  annotationsVisible = !annotationsVisible;
  updateToggleButton();
  updateAnnotationVisibilityUrl();

  if (canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawExistingAnnotations();
  }
}

function updateToggleButton() {
  const btn = document.getElementById("toggle-annotations-btn");
  const text = document.getElementById("toggle-annotations-text");
  if (annotationsVisible) {
    text.textContent = "Hide Annotations";
    btn.style.backgroundColor = "";
  } else {
    text.textContent = "Show Annotations";
    btn.style.backgroundColor = "rgba(72, 209, 204, 0.15)";
  }
}

function updateAnnotationVisibilityUrl() {
  const url = new URL(window.location);
  if (!annotationsVisible) {
    url.searchParams.set("hideAnnotations", "true");
  } else {
    url.searchParams.delete("hideAnnotations");
  }
  window.history.replaceState({}, "", url);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Shift" && !selectionMode && !boxStart && !selectionBoxStart) {
    selectionMode = true;
    if (canvas) {
      canvas.style.cursor = "default";
    }
  }

  if (deleteModal.isVisible()) {
    handleModalKeydown(e);
  } else if (
    incompleteModal.isVisible() ||
    nestedMismatchModal.isVisible() ||
    combinedWarningModal.isVisible()
  ) {
    if (e.key === "Escape") {
      cancelNavigation();
    } else if (e.key === "Enter") {
      confirmNavigation();
    }
  } else if (categoryModal.isVisible()) {
    return;
  } else {
    if (e.key === "ArrowLeft") previousImage();
    if (e.key === "ArrowRight") nextImage();
    if (e.key === "Escape") {
      resetPrompts();
      selectedAnnotationIds.clear();
      updateAnnotationEditor();
    }
    if (e.key === "h" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleAnnotationsVisibility();
    }
    if (e.key === "Enter") {
      // Check if focus is on an input/textarea that should handle Enter normally
      const activeEl = document.activeElement;
      const isTextInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (!isTextInputFocused) {
        // Blur any focused select element (dropdown) so it doesn't capture Enter
        if (activeEl && activeEl.tagName === "SELECT") {
          activeEl.blur();
        }

        const saveBtn = document.getElementById("save-btn");
        if (!saveBtn.disabled && currentSegmentation) {
          e.preventDefault();
          saveAnnotation();
        }
      }
    }
    if (e.key === "m" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const mergeBtn = document.getElementById("btn-merge-masks");
      if (mergeBtn && !mergeBtn.disabled) {
        mergeMasks();
      }
    }
    if (e.key === "t" || e.key === "T") {
      // Note: Box label toggling disabled - SAM3 Tracker doesn't support box labels
      if (currentBoxes.length > 0) {
        console.warn("⚠️  Box label toggling not supported in SAM3 Tracker");
        console.warn("ℹ️  All boxes are treated as positive prompts");
      }
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Shift" && selectionMode) {
    selectionMode = false;
    hoveredAnnotationId = null;
    if (canvas) {
      canvas.style.cursor = "crosshair";
      redrawCanvas();
    }
  }
});

function showDeleteConfirmation() {
  const img = imageMap[currentIndex];
  document.getElementById("delete-image-id").textContent = img.id;
  document.getElementById("delete-file-name").textContent = img.file_name;
  document.getElementById("deleteModal").classList.add("show");
}

function hideDeleteConfirmation() {
  document.getElementById("deleteModal").classList.remove("show");
}

function handleModalKeydown(e) {
  if (
    e.key === "Enter" &&
    document.getElementById("deleteModal").classList.contains("show")
  ) {
    confirmDelete();
  } else if (e.key === "Escape") {
    hideDeleteConfirmation();
  }
}

async function confirmDelete() {
  const img = imageMap[currentIndex];
  const deletingLastImage = currentIndex === totalImages - 1;

  try {
    const response = await fetch("/api/delete-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: img.id,
        confirmed: true,
      }),
    });

    if (response.ok) {
      hideDeleteConfirmation();
      markS3Dirty(); // Mark S3 dataset as having unsaved changes

      const response = await fetch("/api/dataset");
      const data = await response.json();
      images = data.images;
      imageMap = data.image_map;
      totalImages = data.total_images;
      cachedIndices = data.cached_indices || [];
      annotationsByImage = data.annotations_by_image || {};
      updateCacheInfo();

      if (totalImages === 0) {
        document.getElementById("image").src = "";
        document.getElementById("counter").textContent = "No images";
      } else {
        if (deletingLastImage) {
          currentIndex = Math.max(0, totalImages - 1);
        } else {
          currentIndex = Math.min(currentIndex, totalImages - 1);
        }
        lastCacheRefreshIndex = -999;
        await showImage(currentIndex);
      }
    } else {
      const error = await response.json();
      alert("Error deleting image: " + error.detail);
    }
  } catch (error) {
    alert("Error deleting image: " + error.message);
  }
}

function isClickOnExcludedElement(e) {
  const target = e.target;

  const excludedSelectors = [
    ".controls",
    ".annotation-list",
    ".annotation-editor",
    ".category-badges",
    ".modal",
    ".keyboard-hints",
    "button",
    "input",
    "select",
    "textarea",
  ];

  for (const selector of excludedSelectors) {
    if (target.closest(selector)) {
      return true;
    }
  }

  return false;
}

function isPointInFrame(x, y) {
  const img = document.getElementById("image");
  if (!img) return false;
  // Use original image dimensions for bounds checking
  const originalDims = getOriginalImageDimensions();
  return isPointInBounds(x, y, originalDims.width, originalDims.height);
}

function isBoxIntersectingFrame(box) {
  const img = document.getElementById("image");
  if (!img || !box) return false;
  // Use original image dimensions for bounds checking
  const originalDims = getOriginalImageDimensions();
  return hasBoxCornerInBounds(box, originalDims.width, originalDims.height);
}

function setupCanvas() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  const img = document.getElementById("image");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.style.width = img.width + "px";
  canvas.style.height = img.height + "px";

  // Setup crosshair canvas (separate layer with mix-blend-mode: difference)
  crosshairCanvas = document.getElementById("crosshair-canvas");
  crosshairCtx = crosshairCanvas.getContext("2d");
  crosshairCanvas.width = img.width;
  crosshairCanvas.height = img.height;
  crosshairCanvas.style.width = img.width + "px";
  crosshairCanvas.style.height = img.height + "px";

  const wrapper = document.getElementById("image-wrapper");
  wrapper.style.cursor = "crosshair";
  wrapper.oncontextmenu = (e) => {
    e.preventDefault();
    return false;
  };
  wrapper.onmousedown = handleBoxStart;
  wrapper.onmousemove = handleMouseMove;
  wrapper.onmouseup = handleBoxEnd;
  wrapper.onmouseleave = handleMouseLeave;

  document.addEventListener("mousedown", handleDocumentMouseDown);
  document.addEventListener("mousemove", handleDocumentMouseMove);
  document.addEventListener("mouseup", handleDocumentMouseUp);
}

function handleImageClick(e) {
  e.preventDefault();

  const canvas = document.getElementById("canvas");
  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions for SAM coordinates
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if (!isPointInFrame(x, y)) {
    return;
  }

  // Check if multiple boxes exist
  if (currentBoxes.length > 1) {
    console.warn("⚠️  Cannot add points when multiple boxes exist");
    console.warn(
      "ℹ️  Points + multiple boxes requires specifying which box each point applies to",
    );
    console.warn(
      "💡 Delete boxes until only 1 remains, or use boxes only (no points)",
    );
    return;
  }

  const label = e.button === 2 ? 0 : 1;

  clickPoints.push([x, y]);
  clickLabels.push(label);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawExistingAnnotations();
  drawAllPrompts();

  runSegmentation();
}

function drawPoint(x, y, label = 1, isHovered = false) {
  const radius = isHovered ? 8 : 5;
  ctx.fillStyle = label === 1 ? CONFIG.colors.positive : CONFIG.colors.negative;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = isHovered ? CONFIG.colors.hover : "#ffffff";
  ctx.lineWidth = isHovered ? 2 : 1;
  ctx.stroke();

  if (isHovered) {
    ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function detectBoxInteractionLocal(mouseX, mouseY, box = null) {
  // Use provided box or fallback to currentBox for backward compatibility
  const boxToCheck = box || currentBox;
  if (!boxToCheck) return null;

  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  return detectBoxInteraction(mouseX, mouseY, boxToCheck, scaleX, scaleY);
}

function checkPromptHover(e) {
  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  let foundHover = false;

  for (let i = 0; i < clickPoints.length; i++) {
    const [x, y] = clickPoints[i];
    const screenX = x / scaleX;
    const screenY = y / scaleY;
    const distance = Math.sqrt(
      Math.pow(mouseX - screenX, 2) + Math.pow(mouseY - screenY, 2),
    );

    if (distance <= CONFIG.canvas.hoverHitArea) {
      if (hoveredPromptIndex !== i || hoveredPromptType !== "point") {
        hoveredPromptIndex = i;
        hoveredPromptType = "point";
        canvas.style.cursor = "pointer";
        redrawCanvas();
      }
      foundHover = true;
      break;
    }
  }

  // Check all boxes for hover (new multi-box support)
  if (!foundHover && currentBoxes.length > 0) {
    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;

    // Check each box in reverse order (top to bottom in visual stacking)
    for (let i = currentBoxes.length - 1; i >= 0; i--) {
      const box = currentBoxes[i];
      const y1 = box.y1 / scaleY;
      const x2 = box.x2 / scaleX;
      const deleteX = x2 - 5;
      const deleteY = y1 - deleteButtonSize + 5;

      // Check if hovering over delete button
      if (
        mouseX >= deleteX &&
        mouseX <= deleteX + deleteButtonSize &&
        mouseY >= deleteY &&
        mouseY <= deleteY + deleteButtonSize
      ) {
        if (hoveredPromptType !== "box-delete" || hoveredPromptIndex !== i) {
          hoveredPromptType = "box-delete";
          hoveredPromptIndex = i;
          canvas.style.cursor = "pointer";
          redrawCanvas();
        }
        foundHover = true;
        break;
      }
    }

    // If not hovering delete button, check for box interaction (resize/move)
    if (!foundHover) {
      for (let i = currentBoxes.length - 1; i >= 0; i--) {
        const box = currentBoxes[i];
        const boxInteraction = detectBoxInteractionLocal(mouseX, mouseY, box);
        if (boxInteraction) {
          const cursor = getCursorForBoxInteraction(boxInteraction);
          if (
            canvas.style.cursor !== cursor ||
            hoveredPromptType !== "box-interaction" ||
            hoveredPromptIndex !== i
          ) {
            hoveredPromptType = "box-interaction";
            hoveredPromptIndex = i;
            canvas.style.cursor = cursor;
          }
          foundHover = true;
          break;
        }
      }
    }
  } else if (!foundHover && currentBox) {
    // Fallback: single box support for backward compatibility
    const y1 = currentBox.y1 / scaleY;
    const x2 = currentBox.x2 / scaleX;

    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;
    const deleteX = x2 - 5;
    const deleteY = y1 - deleteButtonSize + 5;

    if (
      mouseX >= deleteX &&
      mouseX <= deleteX + deleteButtonSize &&
      mouseY >= deleteY &&
      mouseY <= deleteY + deleteButtonSize
    ) {
      if (hoveredPromptType !== "box-delete") {
        hoveredPromptType = "box-delete";
        hoveredPromptIndex = null;
        canvas.style.cursor = "pointer";
        redrawCanvas();
      }
      foundHover = true;
    } else {
      const boxInteraction = detectBoxInteractionLocal(mouseX, mouseY);
      if (boxInteraction) {
        const cursor = getCursorForBoxInteraction(boxInteraction);
        if (
          canvas.style.cursor !== cursor ||
          hoveredPromptType !== "box-interaction"
        ) {
          hoveredPromptType = "box-interaction";
          hoveredPromptIndex = null;
          canvas.style.cursor = cursor;
        }
        foundHover = true;
      }
    }
  }

  // Check mask prompts for hover
  if (!foundHover && currentMaskPrompts.length > 0) {
    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;

    for (let i = currentMaskPrompts.length - 1; i >= 0; i--) {
      const flatPolygon = currentMaskPrompts[i];
      const polygon = unflattenPolygon(flatPolygon);
      const screenPolygon = naturalToScreenPolygon(polygon, scaleX, scaleY);

      // Check delete button at centroid
      const centroid = calculatePolygonCentroid(screenPolygon);
      if (centroid) {
        const deleteX = centroid.x - deleteButtonSize / 2;
        const deleteY = centroid.y - deleteButtonSize / 2;

        if (
          mouseX >= deleteX &&
          mouseX <= deleteX + deleteButtonSize &&
          mouseY >= deleteY &&
          mouseY <= deleteY + deleteButtonSize
        ) {
          if (hoveredPromptType !== "mask-prompt" || hoveredPromptIndex !== i) {
            hoveredPromptType = "mask-prompt";
            hoveredPromptIndex = i;
            canvas.style.cursor = "pointer";
            redrawCanvas();
          }
          foundHover = true;
          break;
        }
      }

      // Check if hovering inside the mask polygon
      if (isPointInPolygonObjects(mouseX, mouseY, screenPolygon)) {
        if (hoveredPromptType !== "mask-prompt" || hoveredPromptIndex !== i) {
          hoveredPromptType = "mask-prompt";
          hoveredPromptIndex = i;
          canvas.style.cursor = "pointer";
          redrawCanvas();
        }
        foundHover = true;
        break;
      }
    }
  }

  if (
    !foundHover &&
    (hoveredPromptIndex !== null || hoveredPromptType !== null)
  ) {
    hoveredPromptIndex = null;
    hoveredPromptType = null;
    canvas.style.cursor = "crosshair";
    redrawCanvas();
  }
}

function checkPromptClick(mouseX, mouseY) {
  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  for (let i = 0; i < clickPoints.length; i++) {
    const [x, y] = clickPoints[i];
    const screenX = x / scaleX;
    const screenY = y / scaleY;
    const distance = Math.sqrt(
      Math.pow(mouseX - screenX, 2) + Math.pow(mouseY - screenY, 2),
    );

    if (distance <= CONFIG.canvas.hoverHitArea) {
      removePoint(i);
      return true;
    }
  }

  // Check all boxes for delete button click (new multi-box support)
  if (currentBoxes.length > 0) {
    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;

    for (let i = currentBoxes.length - 1; i >= 0; i--) {
      const box = currentBoxes[i];
      const y1 = box.y1 / scaleY;
      const x2 = box.x2 / scaleX;
      const deleteX = x2 - 5;
      const deleteY = y1 - deleteButtonSize + 5;

      if (
        mouseX >= deleteX &&
        mouseX <= deleteX + deleteButtonSize &&
        mouseY >= deleteY &&
        mouseY <= deleteY + deleteButtonSize
      ) {
        removeBoxByIndex(i);
        // Re-run segmentation with remaining boxes
        if (currentBoxes.length === 0 && clickPoints.length === 0) {
          currentSegmentation = null;
          redrawCanvas();
          updateSaveButtonState();
        } else {
          runSegmentation();
        }
        return true;
      }
    }
  } else if (currentBox) {
    // Fallback: single box support for backward compatibility
    const y1 = currentBox.y1 / scaleY;
    const x2 = currentBox.x2 / scaleX;

    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;
    const deleteX = x2 - 5;
    const deleteY = y1 - deleteButtonSize + 5;

    if (
      mouseX >= deleteX &&
      mouseX <= deleteX + deleteButtonSize &&
      mouseY >= deleteY &&
      mouseY <= deleteY + deleteButtonSize
    ) {
      removeBox();
      return true;
    }
  }

  // Check mask prompts for delete button click or click inside mask
  if (currentMaskPrompts.length > 0) {
    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;

    for (let i = currentMaskPrompts.length - 1; i >= 0; i--) {
      const flatPolygon = currentMaskPrompts[i];
      const polygon = unflattenPolygon(flatPolygon);
      const screenPolygon = naturalToScreenPolygon(polygon, scaleX, scaleY);

      // Check delete button at centroid
      const centroid = calculatePolygonCentroid(screenPolygon);
      if (centroid) {
        const deleteX = centroid.x - deleteButtonSize / 2;
        const deleteY = centroid.y - deleteButtonSize / 2;

        if (
          mouseX >= deleteX &&
          mouseX <= deleteX + deleteButtonSize &&
          mouseY >= deleteY &&
          mouseY <= deleteY + deleteButtonSize
        ) {
          removeMaskPrompt(i);
          return true;
        }
      }

      // Also check if clicking inside the mask polygon
      if (isPointInPolygonObjects(mouseX, mouseY, screenPolygon)) {
        removeMaskPrompt(i);
        return true;
      }
    }
  }

  return false;
}

function removePoint(index) {
  clickPoints.splice(index, 1);
  clickLabels.splice(index, 1);
  hoveredPromptIndex = null;
  hoveredPromptType = null;
  canvas.style.cursor = "crosshair";

  if (clickPoints.length === 0 && !currentBox) {
    currentSegmentation = null;
    redrawCanvas();
    updateSaveButtonState();
  } else {
    runSegmentation();
  }
}

function removeBox() {
  currentBox = null;
  hoveredPromptType = null;
  canvas.style.cursor = "crosshair";

  if (clickPoints.length === 0) {
    currentSegmentation = null;
    redrawCanvas();
    updateSaveButtonState();
  } else {
    runSegmentation();
  }
}

function removeMaskPrompt(index) {
  if (index >= 0 && index < currentMaskPrompts.length) {
    currentMaskPrompts.splice(index, 1);
    console.log(`Removed mask prompt ${index + 1}`);
    hoveredPromptIndex = null;
    hoveredPromptType = null;
    canvas.style.cursor = "crosshair";

    // Check if we have any prompts left
    const hasPrompts =
      clickPoints.length > 0 ||
      currentBoxes.length > 0 ||
      currentBox ||
      currentMaskPrompts.length > 0;

    if (!hasPrompts) {
      currentSegmentation = null;
      redrawCanvas();
      updateSaveButtonState();
    } else if (currentModelType === "manual") {
      // Re-run segmentation for manual mode
      runSegmentationWithMasks();
    } else {
      redrawCanvas();
    }
  }
}

function redrawCanvas() {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawExistingAnnotations();
  if (currentSegmentation) {
    drawSegmentationMasks(currentSegmentation.segmentation);
  }
  drawAllPrompts();
  drawCrosshairs();
}

function drawCrosshairs() {
  if (!crosshairCanvas || !crosshairCtx) return;

  // Clear the crosshair canvas
  crosshairCtx.clearRect(0, 0, crosshairCanvas.width, crosshairCanvas.height);

  if (!crosshairPosition) return;

  const lines = getCrosshairLines(
    crosshairPosition.x,
    crosshairPosition.y,
    crosshairCanvas.width,
    crosshairCanvas.height,
  );

  crosshairCtx.strokeStyle = CROSSHAIR_DEFAULTS.strokeStyle;
  crosshairCtx.lineWidth = CROSSHAIR_DEFAULTS.lineWidth;
  crosshairCtx.setLineDash(CROSSHAIR_DEFAULTS.dashPattern);

  // Draw horizontal line
  crosshairCtx.beginPath();
  crosshairCtx.moveTo(lines.horizontal.x1, lines.horizontal.y1);
  crosshairCtx.lineTo(lines.horizontal.x2, lines.horizontal.y2);
  crosshairCtx.stroke();

  // Draw vertical line
  crosshairCtx.beginPath();
  crosshairCtx.moveTo(lines.vertical.x1, lines.vertical.y1);
  crosshairCtx.lineTo(lines.vertical.x2, lines.vertical.y2);
  crosshairCtx.stroke();
}

function handleBoxStart(e) {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const x = mouseX * scaleX;
  const y = mouseY * scaleY;

  mouseDownTime = Date.now();

  if (selectionMode) {
    selectionBoxStart = { x, y, screenX: mouseX, screenY: mouseY };
    return;
  }

  if (checkPromptClick(mouseX, mouseY)) {
    return;
  }

  // Check for Alt/Option + drag for freehand mask drawing
  if (e.altKey && modeManager) {
    const mode = modeManager.getCurrentMode();
    if (mode && mode.supportsMaskDrawing()) {
      maskDrawing = true;
      maskDrawingPoints = [{ x: mouseX, y: mouseY }];
      console.log("🎨 Starting freehand mask drawing (Alt+drag)");
      return;
    }
  }

  // Check if clicking on an existing box in currentBoxes (SAM3 multi-box support)
  if (currentBoxes.length > 0) {
    const boxIndex = findBoxIndexAtPoint(
      currentBoxes,
      mouseX,
      mouseY,
      scaleX,
      scaleY,
    );
    if (boxIndex !== -1) {
      // Clicked on an existing box - prepare to edit it
      const clickedBox = currentBoxes[boxIndex];
      const boxInteraction = detectBoxInteraction(
        mouseX,
        mouseY,
        clickedBox,
        scaleX,
        scaleY,
      );

      if (boxInteraction) {
        editingBoxIndex = boxIndex; // Track which box we're editing
        potentialBoxInteraction = {
          type: boxInteraction.type,
          data: {
            startX: x,
            startY: y,
            originalBox: { ...clickedBox },
            corner: boxInteraction.corner,
            edge: boxInteraction.edge,
          },
        };
      }
    }
  }

  boxStart = { x, y, screenX: mouseX, screenY: mouseY };
  boxStartButton = e.button; // Track which button started the drag (0=left, 2=right)
}

function handleMouseMove(e) {
  // Update crosshair position (only if canvas is initialized)
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isMouseInCanvas(mouseX, mouseY, canvas.width, canvas.height)) {
      const needsRedraw =
        !crosshairPosition ||
        crosshairPosition.x !== mouseX ||
        crosshairPosition.y !== mouseY;
      crosshairPosition = { x: mouseX, y: mouseY };
      if (needsRedraw && !selectionBoxStart && !boxStart && !maskDrawing) {
        redrawCanvas();
      }
    } else if (crosshairPosition) {
      crosshairPosition = null;
      redrawCanvas();
    }
  }

  // Handle freehand mask drawing
  if (maskDrawing) {
    handleMaskDrawingDrag(e);
    return;
  }

  if (selectionBoxStart) {
    handleSelectionDrag(e);
  } else if (boxStart) {
    handleBoxDrag(e);
  } else if (selectionMode) {
    checkAnnotationHover(e);
  } else {
    checkPromptHover(e);
  }
}

function handleMouseLeave() {
  if (crosshairPosition) {
    crosshairPosition = null;
    redrawCanvas();
  }
}

function handleDocumentMouseDown(e) {
  if (isClickOnExcludedElement(e)) {
    return;
  }

  const imageWrapper = document.getElementById("image-wrapper");
  if (imageWrapper && !imageWrapper.contains(e.target)) {
    handleBoxStart(e);
  }
}

function handleDocumentMouseMove(e) {
  if (maskDrawing) {
    handleMaskDrawingDrag(e);
  } else if (selectionBoxStart || boxStart) {
    if (selectionBoxStart) {
      handleSelectionDrag(e);
    } else {
      handleBoxDrag(e);
    }
  }
}

function handleDocumentMouseUp(e) {
  if (maskDrawing) {
    handleMaskDrawingEnd(e);
  } else if (selectionBoxStart || boxStart) {
    handleBoxEnd(e);
  }
}

function handleSelectionDrag(e) {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  crosshairPosition = { x: mouseX, y: mouseY };

  const x = mouseX * scaleX;
  const y = mouseY * scaleY;

  selectionBoxDrag = calculateDragBox(
    selectionBoxStart.x,
    selectionBoxStart.y,
    x,
    y,
  );

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawExistingAnnotations();
  drawAllPrompts();
  drawSelectionBox();
  drawCrosshairs();
}

function handleBoxDrag(e) {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  crosshairPosition = { x: mouseX, y: mouseY };

  const x = mouseX * scaleX;
  const y = mouseY * scaleY;

  if (potentialBoxInteraction && !boxInteractionMode && mouseDownTime) {
    const elapsed = Date.now() - mouseDownTime;
    if (elapsed >= CONFIG.canvas.dragThreshold) {
      boxInteractionMode = potentialBoxInteraction.type;
      boxInteractionData = potentialBoxInteraction.data;
      potentialBoxInteraction = null;
    }
  }

  if (boxInteractionMode) {
    dragBox = calculateBoxResize(boxInteractionMode, boxInteractionData, x, y);
  } else {
    dragBox = calculateDragBox(boxStart.x, boxStart.y, x, y);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawExistingAnnotations();
  drawAllPrompts();

  if (currentSegmentation) {
    drawSegmentationMasks(currentSegmentation.segmentation);
  }

  if (dragBox) {
    // Use the same scale factors already calculated above
    // Use red for right-click (negative), green for left-click (positive)
    ctx.strokeStyle =
      boxStartButton === 2 ? CONFIG.colors.negative : CONFIG.colors.positive;
    ctx.lineWidth = 2;
    const x1 = dragBox.x1 / scaleX;
    const y1 = dragBox.y1 / scaleY;
    const x2 = dragBox.x2 / scaleX;
    const y2 = dragBox.y2 / scaleY;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  drawCrosshairs();
}

function handleMaskDrawingDrag(e) {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Update crosshair position
  crosshairPosition = { x: mouseX, y: mouseY };

  // Add point to drawing path
  maskDrawingPoints.push({ x: mouseX, y: mouseY });

  // Redraw canvas with current mask drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawExistingAnnotations();
  drawAllPrompts();

  if (currentSegmentation) {
    drawSegmentationMasks(currentSegmentation.segmentation);
  }

  // Draw the current freehand drawing path
  drawMaskDrawingPath();
  drawCrosshairs();
}

function drawMaskDrawingPath() {
  if (maskDrawingPoints.length < 2) return;

  ctx.strokeStyle = CONFIG.colors.maskPrompt || "#ff00ff"; // Magenta for mask drawing
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(maskDrawingPoints[0].x, maskDrawingPoints[0].y);

  for (let i = 1; i < maskDrawingPoints.length; i++) {
    ctx.lineTo(maskDrawingPoints[i].x, maskDrawingPoints[i].y);
  }

  ctx.stroke();

  // Draw points at start and current position
  ctx.fillStyle = CONFIG.colors.maskPrompt || "#ff00ff";
  ctx.beginPath();
  ctx.arc(maskDrawingPoints[0].x, maskDrawingPoints[0].y, 4, 0, Math.PI * 2);
  ctx.fill();

  const lastPoint = maskDrawingPoints[maskDrawingPoints.length - 1];
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function handleMaskDrawingEnd() {
  if (!maskDrawing || maskDrawingPoints.length < 3) {
    // Not enough points for a valid polygon
    console.log("⚠️  Not enough points for mask (need at least 3)");
    maskDrawing = false;
    maskDrawingPoints = [];
    redrawCanvas();
    return;
  }

  const img = document.getElementById("image");
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  // Simplify the path to reduce noise
  const simplifiedPath = simplifyPath(
    maskDrawingPoints,
    CONFIG.maskDrawing?.simplifyTolerance || 2.0,
  );

  if (simplifiedPath.length < 3) {
    console.log("⚠️  Simplified path has less than 3 points");
    maskDrawing = false;
    maskDrawingPoints = [];
    redrawCanvas();
    return;
  }

  // Auto-close the path if not already closed
  const closedPath = isPathClosed(
    simplifiedPath,
    CONFIG.maskDrawing?.closeThreshold || 20,
  )
    ? simplifiedPath
    : closePath(simplifiedPath);

  // Convert from screen coordinates to natural (image) coordinates
  const naturalPolygon = screenToNaturalPolygon(closedPath, scaleX, scaleY);

  // Flatten to COCO format [x1, y1, x2, y2, ...]
  const flatPolygon = flattenPolygon(naturalPolygon);

  // Add to current mask prompts
  currentMaskPrompts.push(flatPolygon);

  console.log(
    `✅ Added mask prompt ${currentMaskPrompts.length}: ${naturalPolygon.length} points`,
  );

  // Reset drawing state
  maskDrawing = false;
  maskDrawingPoints = [];

  // Redraw canvas with new mask prompt
  redrawCanvas();

  // For Manual mode, directly create the segmentation result
  if (currentModelType === "manual") {
    runSegmentationWithMasks();
  } else {
    // For SAM modes, trigger segmentation with mask prompts (future: Phase 2/3)
    // For now, just redraw to show the mask prompt
    console.log(
      "ℹ️  Mask prompts for SAM2/SAM3 will be sent in Phase 2/3 implementation",
    );
  }
}

function handleBoxEnd(e) {
  e.preventDefault();

  // Handle freehand mask drawing end
  if (maskDrawing) {
    handleMaskDrawingEnd(e);
    return;
  }

  if (selectionBoxStart) {
    const rect = canvas.getBoundingClientRect();
    const img = document.getElementById("image");
    // Scale from display to original image dimensions
    const originalDims = getOriginalImageDimensions();
    const scaleX = originalDims.width / img.width;
    const scaleY = originalDims.height / img.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const width = Math.abs(x - selectionBoxStart.x);
    const height = Math.abs(y - selectionBoxStart.y);

    if (width < 5 && height < 5) {
      handleAnnotationClick(x, y, true);
    } else {
      const box = calculateDragBox(
        selectionBoxStart.x,
        selectionBoxStart.y,
        x,
        y,
      );
      handleAnnotationBoxSelect(box, true);
    }

    selectionBoxStart = null;
    selectionBoxDrag = null;
    return;
  }

  if (!boxStart) return;

  const rect = canvas.getBoundingClientRect();
  const img = document.getElementById("image");
  // Scale from display to original image dimensions
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const clickDuration = mouseDownTime ? Date.now() - mouseDownTime : 0;
  const width = Math.abs(x - boxStart.x);
  const height = Math.abs(y - boxStart.y);

  if (
    potentialBoxInteraction &&
    clickDuration < CONFIG.canvas.dragThreshold &&
    width < 5 &&
    height < 5
  ) {
    potentialBoxInteraction = null;
    mouseDownTime = null;
    boxStart = null;
    dragBox = null;
    handleImageClick(e);
    return;
  }

  if (boxInteractionMode) {
    if (dragBox) {
      if (editingBoxIndex !== -1) {
        // Replace the box being edited (don't add duplicate)
        currentBoxes = updateBoxInArray(currentBoxes, editingBoxIndex, dragBox);
        editingBoxIndex = -1;
      } else {
        // New box (shouldn't happen in interaction mode, but handle it)
        addBox(dragBox, 1);
      }
    }
    boxInteractionMode = null;
    boxInteractionData = null;
    potentialBoxInteraction = null;
    mouseDownTime = null;
    boxStart = null;
    dragBox = null;
    runSegmentation();
    return;
  }

  if (width < 5 && height < 5) {
    potentialBoxInteraction = null;
    mouseDownTime = null;
    boxStart = null;
    dragBox = null;
    handleImageClick(e);
    return;
  }

  if (width >= 5 || height >= 5) {
    const box = {
      x1: Math.min(boxStart.x, x),
      y1: Math.min(boxStart.y, y),
      x2: Math.max(boxStart.x, x),
      y2: Math.max(boxStart.y, y),
    };

    if (isBoxIntersectingFrame(box)) {
      // Determine label based on mouse button: right-click = negative (0), left-click = positive (1)
      const label = boxStartButton === 2 ? 0 : 1;
      console.log(
        `🖱️  Box drawn with button ${boxStartButton} → label ${label} (${label === 1 ? "positive" : "negative"})`,
      );

      // SAM3 PCS supports negative boxes, but SAM3 Tracker and SAM2 don't
      if (label === 0 && currentModelType !== "sam3-pcs") {
        console.warn("⚠️  Negative boxes only supported in SAM3 PCS mode");
        console.warn("ℹ️  Switch to SAM3 PCS Image mode to use negative boxes");
        // Add as positive box for non-PCS modes
        addBox(box, 1);
      } else {
        addBox(box, label);
      }
    }
  }

  potentialBoxInteraction = null;
  mouseDownTime = null;
  boxStart = null;
  boxStartButton = 0; // Reset button state
  dragBox = null;

  if (currentBoxes.length > 0 || clickPoints.length > 0) {
    console.log(
      `🎯 Triggering segmentation with ${currentBoxes.length} boxes and ${clickPoints.length} points`,
    );
    runSegmentation();
  } else {
    console.log("⚠️  No boxes or points to segment");
  }
}

function runSegmentationWithMasks() {
  // Handle manual mode with both boxes and freehand mask prompts
  const hasBoxes = currentBoxes.length > 0 || currentBox;
  const hasMasks = currentMaskPrompts.length > 0;

  if (!hasBoxes && !hasMasks) {
    console.log("⚠️  Manual mode requires at least one box or mask");
    return;
  }

  const allSegmentations = [];

  // Add rectangular masks from boxes
  if (hasBoxes) {
    const boxesToUse = currentBoxes.length > 0 ? currentBoxes : [currentBox];
    const boxResult = createManualSegmentationResult(boxesToUse);
    if (boxResult && boxResult.segmentation) {
      allSegmentations.push(...boxResult.segmentation);
    }
  }

  // Add freehand mask polygons
  if (hasMasks) {
    for (const flatPolygon of currentMaskPrompts) {
      // Each mask prompt is already in COCO format [x1, y1, x2, y2, ...]
      // Wrap in array since createMaskSegmentationResult expects array of polygons
      const maskResult = createMaskSegmentationResult([flatPolygon]);
      if (maskResult && maskResult.segmentation) {
        allSegmentations.push(...maskResult.segmentation);
      }
    }
  }

  if (allSegmentations.length === 0) {
    console.log("⚠️  No valid segmentations created");
    return;
  }

  const result = {
    segmentation: allSegmentations,
    scores: allSegmentations.map(() => 1.0), // Manual masks have perfect score
  };

  currentSegmentation = result;
  drawSegmentation(result.segmentation);
  console.log(
    `📐 Manual segmentation: ${result.segmentation.length} mask(s) (${currentBoxes.length || (currentBox ? 1 : 0)} boxes, ${currentMaskPrompts.length} freehand)`,
  );

  // Initialize mask category IDs and render dropdowns
  maskCategoryIds = initializeMaskCategories(
    result.segmentation.length,
    selectedCategoryId,
  );
  renderMaskCategoryDropdowns();
  updateMergeButtonState();
}

async function runSegmentation() {
  const imgData = imageMap[currentIndex];
  if (!imgData) return;

  // Handle manual mode - generate masks locally without API call
  if (currentModelType === "manual") {
    runSegmentationWithMasks();
    return;
  }

  const requestBody = {
    image_id: imgData.id,
  };

  if (clickPoints.length > 0) {
    requestBody.points = clickPoints;
    requestBody.labels = clickLabels;
  }

  // Send text prompt for SAM3 PCS
  if (currentModelType === "sam3-pcs" && currentTextPrompt) {
    requestBody.text = currentTextPrompt;
    console.log(`💬 Sending text prompt to SAM3 PCS: "${currentTextPrompt}"`);
  }

  // Send boxes based on model type
  if (currentBoxes.length > 0) {
    if (currentModelType === "sam3" || currentModelType === "sam3-pcs") {
      // SAM3 and SAM3 PCS support multiple boxes
      requestBody.boxes = currentBoxes.map((box) => [
        box.x1,
        box.y1,
        box.x2,
        box.y2,
      ]);

      // Include box labels for SAM3 PCS (supports negative boxes)
      if (currentModelType === "sam3-pcs") {
        // Ensure labels array matches boxes array length
        if (currentBoxLabels.length !== currentBoxes.length) {
          console.warn(
            `⚠️  Box labels array length (${currentBoxLabels.length}) doesn't match boxes array length (${currentBoxes.length}). Resetting labels to all positive.`,
          );
          currentBoxLabels = currentBoxes.map(() => 1);
        }
        requestBody.box_labels = currentBoxLabels;
        const positiveCount = currentBoxLabels.filter((l) => l === 1).length;
        const negativeCount = currentBoxLabels.filter((l) => l === 0).length;
        console.log(
          `📤 Sending ${currentBoxes.length} boxes to SAM3 PCS: ${positiveCount} positive, ${negativeCount} negative`,
        );
      } else {
        console.log(
          `📤 Sending ${currentBoxes.length} boxes to SAM3:`,
          requestBody.boxes,
        );
        console.log(
          `ℹ️  All boxes treated as positive (SAM3 Tracker limitation)`,
        );
      }
    } else {
      // SAM2 only supports single box - use the first/last box
      const boxToUse = currentBoxes[currentBoxes.length - 1]; // Use most recent box
      requestBody.box = [boxToUse.x1, boxToUse.y1, boxToUse.x2, boxToUse.y2];
      console.log(`📤 Sending single box to SAM2:`, requestBody.box);
      if (currentBoxes.length > 1) {
        console.warn(
          `⚠️  SAM2 only supports single box, using most recent (box ${currentBoxes.length})`,
        );
      }
    }
  } else if (currentBox) {
    // Fallback: legacy single box
    requestBody.box = [
      currentBox.x1,
      currentBox.y1,
      currentBox.x2,
      currentBox.y2,
    ];
    console.log(
      `📤 Sending single box to ${currentModelType.toUpperCase()}:`,
      requestBody.box,
    );
  }

  // Validate SAM3 PCS has either text or boxes
  if (currentModelType === "sam3-pcs") {
    if (!currentTextPrompt && currentBoxes.length === 0 && !currentBox) {
      alert(
        "SAM3 PCS requires either a text prompt or box prompts. Please provide at least one.",
      );
      return;
    }
  }

  try {
    const endpoint = getSegmentEndpoint(currentModelType);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const result = await response.json();
      currentSegmentation = result;
      drawSegmentation(result.segmentation);
      console.log("Segmentation:", result);

      // Initialize mask category IDs and render dropdowns
      maskCategoryIds = initializeMaskCategories(
        result.segmentation.length,
        selectedCategoryId,
      );
      renderMaskCategoryDropdowns();
      updateMergeButtonState();
    }
  } catch (error) {
    console.error("Segmentation error:", error);
  }
}

async function saveAnnotation() {
  if (!currentSegmentation) {
    alert("Please create a segmentation first");
    return;
  }

  const imgData = imageMap[currentIndex];
  if (!imgData) return;

  // Check if this is a merged mask (single category for multiple polygons)
  const isMergedMask =
    maskCategoryIds.length === 1 && currentSegmentation.segmentation.length > 1;

  if (isMergedMask) {
    // Validate single category is selected
    if (!maskCategoryIds[0]) {
      alert("Please select a category for the merged mask");
      return;
    }

    // Save as single annotation with all polygons
    console.log(
      `💾 Saving merged mask (${currentSegmentation.segmentation.length} polygons) as 1 annotation`,
    );

    try {
      const response = await fetch("/api/save-annotation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_id: imgData.id,
          category_id: maskCategoryIds[0],
          segmentation: currentSegmentation.segmentation, // All polygons
          bbox: currentSegmentation.bbox,
          area: currentSegmentation.area,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Merged mask saved:", result);
        markS3Dirty(); // Mark S3 dataset as having unsaved changes

        // Clear current segmentation and prompts
        resetPrompts();
        currentSegmentation = null;
        maskCategoryIds = [];

        // Reload annotations for this image
        const annotsData = await apiGet(`/api/annotations/${imgData.id}`);
        annotationsByImage[imgData.id] = annotsData.annotations;

        // Redraw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawExistingAnnotations();
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save annotation");
    }
  } else {
    // Multi-mask save using BATCH endpoint
    // First validate categories
    const validationError = validateMaskCategoriesForSaving(
      currentSegmentation.segmentation,
      maskCategoryIds,
    );
    if (validationError) {
      alert(validationError.message);
      return;
    }

    const masksToSave = prepareMasksForSaving(
      currentSegmentation.segmentation,
      maskCategoryIds,
    );

    console.log(
      `💾 Saving ${masksToSave.length} annotations using batch endpoint`,
    );

    try {
      // Use batch endpoint for multiple masks (much faster!)
      const annotations = masksToSave.map((maskData) => ({
        image_id: imgData.id,
        category_id: maskData.categoryId,
        segmentation: maskData.segmentation,
        bbox: maskData.bbox,
        area: maskData.area,
      }));

      const response = await fetch("/api/save-annotations-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          annotations: annotations,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save annotations: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Batch saved ${result.count} annotations successfully`);
      markS3Dirty(); // Mark S3 dataset as having unsaved changes

      // Clear current segmentation and prompts
      resetPrompts();
      currentSegmentation = null;
      maskCategoryIds = [];

      // Reload annotations for this image
      const annotsData = await apiGet(`/api/annotations/${imgData.id}`);
      annotationsByImage[imgData.id] = annotsData.annotations;

      // Redraw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawExistingAnnotations();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save annotations");
    }
  }
}

/**
 * Draw segmentation masks only (helper for incremental redraws)
 * @param {Array} segmentation - Array of polygon contours
 */
function drawSegmentationMasks(segmentation) {
  if (!segmentation || segmentation.length === 0) return;

  const img = document.getElementById("image");
  // Scale from original image dimensions (where segmentation coords are) to display
  const originalDims = getOriginalImageDimensions();
  const scaleX = img.width / originalDims.width;
  const scaleY = img.height / originalDims.height;

  // Check if this is a merged mask (multiple polygons but single category)
  const isMergedMask = maskCategoryIds.length === 1 && segmentation.length > 1;

  // Check if we have multiple separate masks to draw with different colors
  const multiMask = shouldDrawMultipleMasks(segmentation) && !isMergedMask;

  // Draw each contour with appropriate color
  segmentation.forEach((polygon, index) => {
    const isFocused = focusedMaskIndex === index;

    // Determine color based on mask type
    if (isMergedMask) {
      // Merged mask - all polygons use the same color (first mask color)
      const fillColor = getMaskColor(0);
      const strokeColor = fillColor.replace(/[\d.]+\)$/, "0.8)"); // More opaque stroke
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isFocused ? 4 : 2; // Thicker line when focused
    } else if (multiMask) {
      // Multiple separate masks - each gets different color
      const fillColor = getMaskColor(index);
      const strokeColor = fillColor.replace(/[\d.]+\)$/, "0.8)"); // More opaque stroke
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isFocused ? 4 : 2; // Thicker line when focused
    } else {
      // Single mask - use default red
      ctx.strokeStyle = CONFIG.colors.negative;
      ctx.lineWidth = isFocused ? 4 : 2; // Thicker line when focused
      ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
    }

    ctx.beginPath();
    for (let i = 0; i < polygon.length; i += 2) {
      const x = polygon[i] * scaleX;
      const y = polygon[i + 1] * scaleY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw extra highlight glow for focused mask
    if (isFocused) {
      ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; // Yellow glow
      ctx.lineWidth = 8;
      ctx.stroke();
    }
  });
}

function drawSegmentation(segmentation) {
  console.log(
    `🎨 Drawing segmentation with ${segmentation?.length || 0} contours`,
  );
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawExistingAnnotations();
  drawPrompts();

  const isMergedMask = maskCategoryIds.length === 1 && segmentation.length > 1;
  const multiMask = shouldDrawMultipleMasks(segmentation) && !isMergedMask;

  if (isMergedMask) {
    console.log(
      `🎨 Drawing merged mask: ${segmentation.length} polygons with single color`,
    );
  } else if (multiMask) {
    console.log(
      `🎨 Drawing ${segmentation.length} separate masks with different colors`,
    );
  }

  drawSegmentationMasks(segmentation);
  updateSaveButtonState();
}

function drawSelectionBox() {
  if (!selectionBoxDrag) return;

  const img = document.getElementById("image");
  // Scale from original image dimensions to display
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  const x1 = selectionBoxDrag.x1 / scaleX;
  const y1 = selectionBoxDrag.y1 / scaleY;
  const x2 = selectionBoxDrag.x2 / scaleX;
  const y2 = selectionBoxDrag.y2 / scaleY;

  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = CONFIG.colors.accent || "#48d1cc";
  ctx.lineWidth = 2;
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

  ctx.fillStyle = "rgba(72, 209, 204, 0.1)";
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

  ctx.setLineDash([]);
}

function drawAllPrompts() {
  const img = document.getElementById("image");
  // Scale from original image dimensions to display
  const originalDims = getOriginalImageDimensions();
  const scaleX = originalDims.width / img.width;
  const scaleY = originalDims.height / img.height;

  if (clickPoints.length > 0) {
    for (let i = 0; i < clickPoints.length; i++) {
      const [x, y] = clickPoints[i];
      const screenX = x / scaleX;
      const screenY = y / scaleY;
      const isHovered =
        hoveredPromptType === "point" && hoveredPromptIndex === i;
      drawPoint(screenX, screenY, clickLabels[i], isHovered);
    }
  }

  // Draw all boxes (new multi-box support)
  if (currentBoxes.length > 0) {
    currentBoxes.forEach((box, index) => {
      const isHovered =
        hoveredPromptType === "box-delete" && hoveredPromptIndex === index;
      const isPositive = currentBoxLabels[index] === 1;

      // Different colors for positive/negative boxes
      ctx.strokeStyle = isHovered
        ? CONFIG.colors.hover
        : isPositive
          ? CONFIG.colors.positive
          : CONFIG.colors.negative;
      ctx.lineWidth = isHovered ? 3 : 2;

      const x1 = box.x1 / scaleX;
      const y1 = box.y1 / scaleY;
      const x2 = box.x2 / scaleX;
      const y2 = box.y2 / scaleY;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Draw delete button - positioned outside the box at top-right corner
      const deleteButtonSize = CONFIG.canvas.deleteButtonSize;
      const deleteX = x2 - 5;
      const deleteY = y1 - deleteButtonSize + 5;

      // Draw button background
      ctx.fillStyle = isHovered ? CONFIG.colors.negative : "#cc0000";
      ctx.fillRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw white border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw X
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(deleteX + 5, deleteY + 5);
      ctx.lineTo(
        deleteX + deleteButtonSize - 5,
        deleteY + deleteButtonSize - 5,
      );
      ctx.moveTo(deleteX + deleteButtonSize - 5, deleteY + 5);
      ctx.lineTo(deleteX + 5, deleteY + deleteButtonSize - 5);
      ctx.stroke();
    });
  } else if (currentBox) {
    // Fallback: draw single box for backward compatibility
    const isHovered = hoveredPromptType === "box-delete";
    ctx.strokeStyle = isHovered ? CONFIG.colors.hover : CONFIG.colors.positive;
    ctx.lineWidth = isHovered ? 3 : 2;
    const x1 = currentBox.x1 / scaleX;
    const y1 = currentBox.y1 / scaleY;
    const x2 = currentBox.x2 / scaleX;
    const y2 = currentBox.y2 / scaleY;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Draw delete button
    const deleteButtonSize = CONFIG.canvas.deleteButtonSize;
    const deleteX = x2 - 5;
    const deleteY = y1 - deleteButtonSize + 5;

    ctx.fillStyle = isHovered ? CONFIG.colors.negative : "#cc0000";
    ctx.fillRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(deleteX + 5, deleteY + 5);
    ctx.lineTo(deleteX + deleteButtonSize - 5, deleteY + deleteButtonSize - 5);
    ctx.moveTo(deleteX + deleteButtonSize - 5, deleteY + 5);
    ctx.lineTo(deleteX + 5, deleteY + deleteButtonSize - 5);
    ctx.stroke();
  }

  // Draw mask prompts (freehand drawn masks)
  if (currentMaskPrompts.length > 0) {
    drawMaskPrompts(scaleX, scaleY);
  }
}

function drawMaskPrompts(scaleX, scaleY) {
  const maskColor = CONFIG.colors.maskPrompt || "#ff00ff"; // Magenta

  for (let i = 0; i < currentMaskPrompts.length; i++) {
    const flatPolygon = currentMaskPrompts[i];
    const polygon = unflattenPolygon(flatPolygon);
    const isHovered =
      hoveredPromptType === "mask-prompt" && hoveredPromptIndex === i;

    // Convert from natural to screen coordinates
    const screenPolygon = naturalToScreenPolygon(polygon, scaleX, scaleY);

    if (screenPolygon.length < 3) continue;

    // Draw filled polygon with transparency
    ctx.fillStyle = isHovered
      ? "rgba(255, 0, 255, 0.4)"
      : "rgba(255, 0, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(screenPolygon[0].x, screenPolygon[0].y);
    for (let j = 1; j < screenPolygon.length; j++) {
      ctx.lineTo(screenPolygon[j].x, screenPolygon[j].y);
    }
    ctx.closePath();
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = isHovered ? CONFIG.colors.hover : maskColor;
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.stroke();

    // Draw delete button at centroid
    const centroid = calculatePolygonCentroid(screenPolygon);
    if (centroid) {
      const deleteButtonSize = CONFIG.canvas.deleteButtonSize;
      const deleteX = centroid.x - deleteButtonSize / 2;
      const deleteY = centroid.y - deleteButtonSize / 2;

      // Draw button background
      ctx.fillStyle = isHovered ? CONFIG.colors.negative : "#cc0000";
      ctx.fillRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw white border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(deleteX, deleteY, deleteButtonSize, deleteButtonSize);

      // Draw X
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(deleteX + 5, deleteY + 5);
      ctx.lineTo(
        deleteX + deleteButtonSize - 5,
        deleteY + deleteButtonSize - 5,
      );
      ctx.moveTo(deleteX + deleteButtonSize - 5, deleteY + 5);
      ctx.lineTo(deleteX + 5, deleteY + deleteButtonSize - 5);
      ctx.stroke();
    }
  }
}

function drawPrompts() {
  drawAllPrompts();
}

/**
 * Add a box to the list of boxes
 * @param {Object} box - Box object {x1, y1, x2, y2}
 * @param {number} label - Box label (1=positive, 0=negative)
 */
function addBox(box, label = 1) {
  currentBoxes.push({ ...box });
  currentBoxLabels.push(label);
  // Also update currentBox for backward compatibility
  currentBox = { ...box };
  console.log(`✅ Added box ${currentBoxes.length}: label=${label}`, box);
  console.log(
    `📦 Total boxes: ${currentBoxes.length}, labels: ${currentBoxLabels.length}`,
  );

  // Validate arrays are in sync
  if (currentBoxes.length !== currentBoxLabels.length) {
    console.error(
      `❌ ARRAY MISMATCH: ${currentBoxes.length} boxes but ${currentBoxLabels.length} labels!`,
    );
  }

  // Warning: SAM3 Tracker doesn't support box labels
  if (currentModelType === "sam3") {
    console.warn(
      "⚠️  SAM3 Tracker (PVS) does not support box labels - all boxes treated as POSITIVE",
    );
    console.warn(
      "⚠️  For negative boxes, use SAM3 Concept Search (PCS) - coming soon!",
    );
  }
}

/**
 * Remove a box by index from the boxes array
 */
function removeBoxByIndex(index) {
  if (index >= 0 && index < currentBoxes.length) {
    currentBoxes.splice(index, 1);
    currentBoxLabels.splice(index, 1);
    console.log(`Removed box ${index + 1}`);
    console.log(
      `📦 Remaining boxes: ${currentBoxes.length}, labels: ${currentBoxLabels.length}`,
    );

    // Validate arrays are in sync
    if (currentBoxes.length !== currentBoxLabels.length) {
      console.error(
        `❌ ARRAY MISMATCH after removal: ${currentBoxes.length} boxes but ${currentBoxLabels.length} labels!`,
      );
    }

    // Update currentBox for backward compatibility
    currentBox =
      currentBoxes.length > 0 ? currentBoxes[currentBoxes.length - 1] : null;
  }
}

/**
 * Toggle a box between positive and negative
 * Note: Currently unused - SAM3 Tracker doesn't support box labels
 * Kept for future SAM3 Model (Concept Search) implementation
 */
// eslint-disable-next-line no-unused-vars
function toggleBoxLabel(index) {
  if (index >= 0 && index < currentBoxLabels.length) {
    currentBoxLabels[index] = currentBoxLabels[index] === 1 ? 0 : 1;
    console.log(
      `Toggled box ${index + 1} to ${currentBoxLabels[index] === 1 ? "positive" : "negative"}`,
    );
  }
}

function resetPrompts() {
  clickPoints = [];
  clickLabels = [];
  boxStart = null;
  currentBox = null;
  currentBoxes = [];
  currentBoxLabels = [];
  currentTextPrompt = "";
  dragBox = null;
  currentSegmentation = null;
  clearMaskCategoryDropdowns();
  hoveredPromptIndex = null;
  hoveredPromptType = null;
  boxInteractionMode = null;
  boxInteractionData = null;
  selectionBoxStart = null;
  selectionBoxDrag = null;
  hoveredAnnotationId = null;

  // Clear mask drawing state
  maskDrawing = false;
  maskDrawingPoints = [];
  currentMaskPrompts = [];

  // Clear text prompt input field
  const textPromptInput = document.getElementById("text-prompt");
  if (textPromptInput) {
    textPromptInput.value = "";
  }

  if (canvas) {
    canvas.style.cursor = selectionMode ? "default" : "crosshair";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawExistingAnnotations();
  }

  updateSaveButtonState();
  updateMergeButtonState();
}

function mergeMasks() {
  if (!currentSegmentation || !currentSegmentation.segmentation) {
    alert("No segmentation to merge");
    return;
  }

  const maskCount = currentSegmentation.segmentation.length;

  if (maskCount <= 1) {
    alert("Only one mask exists - nothing to merge");
    return;
  }

  console.log(`🔀 Merging ${maskCount} masks into 1 mask...`);

  // Merge all polygons
  const merged = mergeMaskPolygons(currentSegmentation.segmentation);

  if (!merged) {
    alert("Failed to merge masks - no valid polygons found");
    return;
  }

  // Update currentSegmentation
  currentSegmentation = {
    segmentation: merged.mergedPolygons,
    bbox: merged.bbox,
    area: merged.area,
  };

  // Update mask category IDs - use first non-null category or null
  const firstCategory =
    maskCategoryIds.find((id) => id !== null && id !== undefined) || null;
  maskCategoryIds = [firstCategory];

  // Redraw and update UI
  drawSegmentation(currentSegmentation.segmentation);
  renderMaskCategoryDropdowns();
  updateSaveButtonState();
  updateMergeButtonState();

  console.log(`✅ Merged ${maskCount} masks into 1 mask`);
  console.log(`   Category: ${firstCategory || "none"}`);
  console.log(`   Polygons: ${merged.mergedPolygons.length}`);
  console.log(`   Total area: ${merged.area.toFixed(2)}`);
}

function updateMergeButtonState() {
  const mergeBtn = document.getElementById("btn-merge-masks");
  if (!mergeBtn) return;

  const hasMasks = currentSegmentation && currentSegmentation.segmentation;
  const maskCount = hasMasks ? currentSegmentation.segmentation.length : 0;
  const canMerge = maskCount > 1;

  mergeBtn.disabled = !canMerge;

  if (!canMerge) {
    mergeBtn.style.opacity = "0.5";
    mergeBtn.style.cursor = "not-allowed";
  } else {
    mergeBtn.style.opacity = "1";
    mergeBtn.style.cursor = "pointer";
  }
}

function showCategoryManager() {
  renderCategoryList();
  document.getElementById("categoryModal").classList.add("show");
}

function hideCategoryManager() {
  document.getElementById("categoryModal").classList.remove("show");
}

function renderCategoryList() {
  const listDiv = document.getElementById("category-list");
  listDiv.innerHTML = "";

  const sortedCategories = [...categories].sort((a, b) => {
    const superA = a.supercategory || "none";
    const superB = b.supercategory || "none";
    if (superA !== superB) {
      return superA.localeCompare(superB);
    }
    return a.name.localeCompare(b.name);
  });

  sortedCategories.forEach((cat) => {
    const rgb = getCategoryColorLocal(cat);
    const hexColor = rgbToHex(rgb);

    const catDiv = document.createElement("div");
    catDiv.style.cssText = `background: #333; padding: 10px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${hexColor};`;

    const infoDiv = document.createElement("div");
    infoDiv.innerHTML = `
                        <div><span style="display: inline-block; width: 12px; height: 12px; background-color: ${hexColor}; border: 1px solid #fff; border-radius: 2px; margin-right: 8px; vertical-align: middle;"></span><strong>${cat.name}</strong></div>
                        <div style="font-size: 12px; color: #aaa; margin-left: 20px;">Supercategory: ${cat.supercategory}</div>
                    `;

    const actionsDiv = document.createElement("div");
    actionsDiv.style.cssText = "display: flex; gap: 5px;";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editCategory(cat);
    editBtn.style.padding = "5px 10px";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete";
    deleteBtn.onclick = () => deleteCategory(cat.id);
    deleteBtn.style.padding = "5px 10px";

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    catDiv.appendChild(infoDiv);
    catDiv.appendChild(actionsDiv);
    listDiv.appendChild(catDiv);
  });
}

function renderMaskCategoryDropdowns() {
  const overlay = document.getElementById("mask-category-overlay");
  if (!overlay) {
    console.warn("Mask category overlay not found");
    return;
  }

  // Clear existing dropdowns
  overlay.innerHTML = "";

  // No segmentation = no dropdowns
  if (
    !currentSegmentation ||
    !currentSegmentation.segmentation ||
    currentSegmentation.segmentation.length === 0
  ) {
    console.log("No segmentation to render dropdowns for");
    return;
  }

  const img = document.getElementById("image");
  if (!img) {
    console.warn("Image element not found");
    return;
  }

  // Scale from original image dimensions to display
  const originalDims = getOriginalImageDimensions();
  const scaleX = img.width / originalDims.width;
  const scaleY = img.height / originalDims.height;

  // Check if this is a merged mask (multiple polygons but single category)
  const isMergedMask =
    maskCategoryIds.length === 1 && currentSegmentation.segmentation.length > 1;
  const numDropdowns = isMergedMask
    ? 1
    : currentSegmentation.segmentation.length;

  console.log(`📍 Rendering ${numDropdowns} mask category dropdown(s)`);
  console.log("Categories available:", categories.length);
  console.log("maskCategoryIds:", maskCategoryIds);
  console.log("isMergedMask:", isMergedMask);

  // Find top points for each mask (or just first polygon if merged)
  const polygonsToProcess = isMergedMask
    ? [currentSegmentation.segmentation[0]]
    : currentSegmentation.segmentation;

  const positions = polygonsToProcess.map((polygon) => {
    const topPoint = findTopPointOfMask(
      polygon,
      originalDims.width,
      originalDims.height,
    );
    if (!topPoint) {
      console.warn("Mask has no points within frame bounds, skipping dropdown");
      return null;
    }
    const screenPos = naturalToScreen(topPoint.x, topPoint.y, scaleX, scaleY);
    console.log(
      `Mask top point: natural=(${topPoint.x}, ${topPoint.y}), screen=(${screenPos.x}, ${screenPos.y})`,
    );
    return screenPos;
  });

  // Detect and offset overlapping dropdowns
  const offsetPositions = offsetOverlappingDropdowns(
    positions,
    CONFIG.maskCategoryDropdown.overlapThreshold,
    CONFIG.maskCategoryDropdown.overlapOffset,
  );

  // Create dropdown(s)
  polygonsToProcess.forEach((polygon, index) => {
    // Skip masks with no valid position (completely outside frame)
    if (!offsetPositions[index]) {
      console.warn(`Skipping dropdown for mask ${index} - no valid position`);
      return;
    }

    const dropdown = document.createElement("select");
    dropdown.className = "mask-category-dropdown";
    dropdown.dataset.maskIndex = index;

    // Style the dropdown
    dropdown.style.position = "absolute";
    dropdown.style.left = `${offsetPositions[index].x}px`;
    dropdown.style.top = `${offsetPositions[index].y + CONFIG.maskCategoryDropdown.offsetY}px`;
    dropdown.style.minWidth = `${CONFIG.maskCategoryDropdown.minWidth}px`;
    dropdown.style.fontSize = `${CONFIG.maskCategoryDropdown.fontSize}px`;
    dropdown.style.padding = CONFIG.maskCategoryDropdown.padding;
    dropdown.style.zIndex = "1000";
    dropdown.style.pointerEvents = "auto"; // Allow clicks on dropdown

    // Add placeholder option
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = "Select category...";
    dropdown.appendChild(placeholderOption);

    // Group categories by supercategory
    const grouped = {};
    categories.forEach((cat) => {
      const superKey = cat.supercategory || "none";
      if (!grouped[superKey]) grouped[superKey] = [];
      grouped[superKey].push(cat);
    });

    // Add optgroups
    Object.keys(grouped)
      .sort()
      .forEach((superKey) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = superKey;

        grouped[superKey]
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((cat) => {
            const option = document.createElement("option");
            option.value = cat.id;
            // Show "Supercategory - Category" format
            const displayName = cat.supercategory
              ? `${cat.supercategory} - ${cat.name}`
              : cat.name;
            option.textContent = displayName;
            optgroup.appendChild(option);
          });

        dropdown.appendChild(optgroup);
      });

    // Set selected value (always use index 0 for merged masks)
    const categoryIndex = isMergedMask ? 0 : index;
    if (maskCategoryIds[categoryIndex]) {
      dropdown.value = maskCategoryIds[categoryIndex];
    }

    // Add event listeners (always update index 0 for merged masks)
    dropdown.addEventListener("change", (e) =>
      handleMaskCategoryChange(categoryIndex, e.target.value),
    );
    dropdown.addEventListener("focus", () => {
      focusedMaskIndex = index;
      drawSegmentation(currentSegmentation.segmentation);
    });
    dropdown.addEventListener("blur", () => {
      focusedMaskIndex = null;
      drawSegmentation(currentSegmentation.segmentation);
    });

    // Prevent clicks on dropdown from reaching canvas (creating points)
    dropdown.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      // Don't preventDefault - let the dropdown open naturally
    });
    dropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    console.log(
      `Created dropdown ${index} at position (${offsetPositions[index].x}, ${offsetPositions[index].y})`,
    );
    overlay.appendChild(dropdown);
  });

  console.log(
    `✅ Rendered ${currentSegmentation.segmentation.length} dropdowns`,
  );
  console.log("Overlay children count:", overlay.children.length);
}

function handleMaskCategoryChange(maskIndex, categoryId) {
  maskCategoryIds[maskIndex] = categoryId;
  updateSaveButtonState();
}

function clearMaskCategoryDropdowns() {
  const overlay = document.getElementById("mask-category-overlay");
  if (overlay) {
    overlay.innerHTML = "";
  }
  maskCategoryIds = [];
  focusedMaskIndex = null;
}

async function addCategory() {
  const name = document.getElementById("new-category-name").value.trim();
  const supercategory = document
    .getElementById("new-category-super")
    .value.trim();

  if (!name) {
    alert("Please enter a category name");
    return;
  }

  try {
    const response = await fetch("/api/add-category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        supercategory: supercategory || "none",
      }),
    });

    if (response.ok) {
      document.getElementById("new-category-name").value = "";
      document.getElementById("new-category-super").value = "";
      categoryColors = {};
      markS3Dirty(); // Mark S3 dataset as having unsaved changes
      await loadDataset(true);
      renderCategoryList();
      populateCategoryBadges();
    } else {
      alert("Error adding category");
    }
  } catch (error) {
    console.error("Add category error:", error);
    alert("Error adding category");
  }
}

function editCategory(cat) {
  const newName = prompt("Edit category name:", cat.name);
  if (newName === null) return;

  const newSuper = prompt("Edit supercategory:", cat.supercategory);
  if (newSuper === null) return;

  updateCategory(cat.id, newName.trim(), newSuper.trim());
}

async function updateCategory(id, name, supercategory) {
  if (!name) {
    alert("Category name cannot be empty");
    return;
  }

  try {
    const response = await fetch("/api/update-category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: id,
        name: name,
        supercategory: supercategory || "none",
      }),
    });

    if (response.ok) {
      categoryColors = {};
      markS3Dirty(); // Mark S3 dataset as having unsaved changes
      await loadDataset(true);
      renderCategoryList();
      populateCategoryBadges();
    } else {
      alert("Error updating category");
    }
  } catch (error) {
    console.error("Update category error:", error);
    alert("Error updating category");
  }
}

async function deleteCategory(id) {
  if (
    !confirm(
      "Are you sure you want to delete this category? This will fail if annotations exist.",
    )
  ) {
    return;
  }

  try {
    const response = await fetch("/api/delete-category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: id }),
    });

    if (response.ok) {
      categoryColors = {};
      markS3Dirty(); // Mark S3 dataset as having unsaved changes
      await loadDataset(true);
      renderCategoryList();
      populateCategoryBadges();
    } else {
      const error = await response.json();
      alert("Error: " + error.detail);
    }
  } catch (error) {
    console.error("Delete category error:", error);
    alert("Error deleting category");
  }
}

function showModelLoading(modelSize) {
  const overlay = document.getElementById("model-loading-overlay");
  const bar = document.getElementById("model-loading-bar");
  const text = document.getElementById("model-loading-text");

  overlay.style.display = "flex";
  text.textContent = `Loading ${modelSize.toUpperCase()} model...`;

  bar.style.width = "0%";
  let progress = 0;
  const interval = setInterval(() => {
    progress += 2;
    if (progress >= 90) {
      clearInterval(interval);
      bar.style.width = "90%";
    } else {
      bar.style.width = progress + "%";
    }
  }, 100);

  return interval;
}

function hideModelLoading(interval) {
  const overlay = document.getElementById("model-loading-overlay");
  const bar = document.getElementById("model-loading-bar");

  if (interval) clearInterval(interval);
  bar.style.width = "100%";

  setTimeout(() => {
    overlay.style.display = "none";
    bar.style.width = "0%";
  }, 300);
}

async function handleModelSizeChange(e) {
  const newSize = e.target.value;
  if (!newSize) return;

  const loadingText = formatModelDisplayName(currentModelType, newSize);
  const interval = showModelLoading(loadingText);

  try {
    const endpoint = getSetModelSizeEndpoint(currentModelType);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_size: newSize }),
    });

    if (response.ok) {
      console.log(`Model changed to ${newSize}`);
    } else {
      alert("Error changing model size");
    }
  } catch (error) {
    console.error("Model change error:", error);
    alert("Error changing model size");
  } finally {
    hideModelLoading(interval);
  }
}

async function loadModelInfo() {
  const select = document.getElementById("model-size-select");

  // Handle manual mode - no ML model, hide model size selector
  if (currentModelType === "manual") {
    if (select) {
      select.style.display = "none";
    }
    console.log("Manual mode - no ML model to load");
    return;
  }

  // Show model size selector for ML modes
  if (select) {
    select.style.display = "";
  }

  const loadingText = `${currentModelType.toUpperCase()}`;
  const loadingInterval = showModelLoading(loadingText);

  try {
    const endpoint = getModelInfoEndpoint(currentModelType);
    console.log(`Loading model info from: ${endpoint}`);

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Model info data:", data);

    const select = document.getElementById("model-size-select");
    if (!select) {
      console.error("model-size-select element not found!");
      return;
    }

    select.innerHTML = "";

    // Remove any existing event listener
    select.removeEventListener("change", handleModelSizeChange);

    for (const size of data.available_sizes) {
      const option = document.createElement("option");
      option.value = size;
      option.textContent = formatModelDisplayName(currentModelType, size);

      if (data.current_model.includes(size)) {
        option.selected = true;
      }

      select.appendChild(option);
    }

    console.log(
      `Model size select updated with ${data.available_sizes.length} options for ${currentModelType}`,
    );

    // Add event listener for model size changes
    select.addEventListener("change", handleModelSizeChange);
  } catch (error) {
    console.error("Model info error:", error);
    alert(`Failed to load model info: ${error.message}`);
  } finally {
    hideModelLoading(loadingInterval);
  }
}

async function initializeModeSystem() {
  // Create mode manager
  modeManager = new ModeManager(modeRegistry);

  // Determine initial mode based on currentModelType
  const initialModeId = currentModelType === "sam3" ? "sam3-pvs-image" : "sam2";

  // Update mode selector to reflect initial mode
  const modeSelect = document.getElementById("mode-select");
  if (modeSelect) {
    modeSelect.value = initialModeId;
  }

  // Switch to initial mode (with isInitialLoad=true to force loadModelInfo)
  await switchToMode(initialModeId, true);

  console.log(`Mode system initialized with mode: ${initialModeId}`);
}

async function switchToMode(modeId, isInitialLoad = false) {
  if (!modeManager) {
    console.warn("Mode manager not initialized yet");
    return;
  }

  try {
    console.log(`Switching to mode: ${modeId}`);

    // Get mode metadata to determine model type
    const modeInfo = modeRegistry.getModeInfo(modeId);
    if (!modeInfo) {
      console.error(`Mode "${modeId}" not found`);
      return;
    }

    // Update currentModelType based on mode
    const newModelType = modeInfo.modelType || "sam2";
    if (currentModelType !== newModelType || isInitialLoad) {
      currentModelType = newModelType;
      await loadModelInfo();
    }

    // Switch mode
    await modeManager.switchMode(modeId);
    currentModeId = modeId;

    // Update UI based on mode capabilities
    updateUIForCurrentMode();

    // Clear prompts when switching modes (but not on initial load)
    if (!isInitialLoad) {
      resetPrompts();
    }

    console.log(`✅ Switched to mode: ${modeId} (${modeInfo.displayName})`);
  } catch (error) {
    console.error("Error switching mode:", error);
    alert(`Failed to switch mode: ${error.message}`);
  }
}

function updateUIForCurrentMode() {
  if (!modeManager || !modeManager.hasActiveMode()) {
    return;
  }

  const capabilities = modeManager.getCapabilities();
  console.log(`Mode "${currentModeId}" capabilities:`, capabilities);

  // Update UI hint text based on mode
  const mode = modeManager.getCurrentMode();
  const helpText = mode.getHelpText();

  // Find the hint span and update it
  const hintElement = document.querySelector(
    '.controls span[style*="color: #aaa"]',
  );
  if (hintElement) {
    hintElement.textContent = helpText;
  }

  // Show/hide text prompt container based on mode capabilities
  const textPromptContainer = document.getElementById("text-prompt-container");
  if (textPromptContainer) {
    if (capabilities.supportsTextPrompts) {
      textPromptContainer.style.display = "inline-flex";
      console.log("✅ Text prompt field shown");
    } else {
      textPromptContainer.style.display = "none";
      console.log("❌ Text prompt field hidden");
    }
  }
}

const indexInput = document.getElementById("index-input");
if (indexInput) {
  indexInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const value = parseInt(indexInput.value);
      if (!isNaN(value) && value >= 1 && value <= totalImages) {
        navigateToImage(value - 1);
      } else {
        alert(`Please enter a number between 1 and ${totalImages}`);
      }
    }
  });
}

function setupEventListeners() {
  // Navigation buttons - use view manager for client-side navigation
  document.getElementById("nav-editor")?.addEventListener("click", () => {
    handleViewChange(ViewType.EDITOR, { index: currentIndex });
    window.history.pushState(
      { view: ViewType.EDITOR, params: { index: currentIndex } },
      "",
      `/?view=editor&index=${currentIndex}`,
    );
  });

  document.getElementById("nav-gallery")?.addEventListener("click", () => {
    handleViewChange(ViewType.GALLERY, {});
    window.history.pushState(
      { view: ViewType.GALLERY, params: {} },
      "",
      "/?view=gallery",
    );
  });

  document
    .getElementById("btn-previous")
    ?.addEventListener("click", previousImage);
  document.getElementById("btn-next")?.addEventListener("click", nextImage);
  document.getElementById("btn-gallery")?.addEventListener("click", () => {
    handleViewChange(ViewType.GALLERY, {});
    window.history.pushState(
      { view: ViewType.GALLERY, params: {} },
      "",
      "/?view=gallery",
    );
  });

  document
    .getElementById("btn-reset-prompts")
    ?.addEventListener("click", resetPrompts);
  document
    .getElementById("btn-merge-masks")
    ?.addEventListener("click", mergeMasks);
  document
    .getElementById("toggle-annotations-btn")
    ?.addEventListener("click", toggleAnnotationsVisibility);

  document
    .getElementById("btn-manage-categories")
    ?.addEventListener("click", showCategoryManager);
  document
    .getElementById("save-btn")
    ?.addEventListener("click", saveAnnotation);
  document
    .getElementById("btn-delete-image")
    ?.addEventListener("click", showDeleteConfirmation);

  document
    .getElementById("btn-delete-cancel")
    ?.addEventListener("click", hideDeleteConfirmation);
  document
    .getElementById("btn-delete-confirm")
    ?.addEventListener("click", confirmDelete);

  document
    .getElementById("btn-incomplete-cancel")
    ?.addEventListener("click", cancelNavigation);
  document
    .getElementById("btn-incomplete-continue")
    ?.addEventListener("click", confirmNavigation);
  document
    .getElementById("btn-nested-cancel")
    ?.addEventListener("click", cancelNavigation);
  document
    .getElementById("btn-nested-continue")
    ?.addEventListener("click", confirmNavigation);
  document
    .getElementById("btn-combined-cancel")
    ?.addEventListener("click", cancelNavigation);
  document
    .getElementById("btn-combined-continue")
    ?.addEventListener("click", confirmNavigation);

  document
    .getElementById("btn-add-category")
    ?.addEventListener("click", addCategory);
  document
    .getElementById("btn-close-categories")
    ?.addEventListener("click", hideCategoryManager);

  document
    .getElementById("btn-apply-category")
    ?.addEventListener("click", changeSelectedAnnotationsCategory);
  document
    .getElementById("btn-delete-annotations")
    ?.addEventListener("click", deleteSelectedAnnotations);

  // Merge selected annotations
  document
    .getElementById("btn-merge-annotations")
    ?.addEventListener("click", mergeSelectedAnnotations);
  document
    .getElementById("btn-merge-cancel")
    ?.addEventListener("click", cancelMerge);
  document
    .getElementById("btn-merge-confirm")
    ?.addEventListener("click", confirmMerge);

  // S3 Save button
  document
    .getElementById("save-to-s3-btn")
    ?.addEventListener("click", saveToS3);

  const keyboardHintsToggle = document.getElementById("keyboard-hints-toggle");
  const keyboardHintsContent = document.getElementById(
    "keyboard-hints-content",
  );
  keyboardHintsToggle?.addEventListener("click", () => {
    keyboardHintsContent?.classList.toggle("visible");
  });

  document.addEventListener("click", (e) => {
    const hints = document.getElementById("keyboard-hints");
    if (hints && !hints.contains(e.target)) {
      keyboardHintsContent?.classList.remove("visible");
    }
  });

  // Legacy model-type-select support (deprecated)
  const modelTypeSelect = document.getElementById("model-type-select");
  if (modelTypeSelect) {
    modelTypeSelect.addEventListener("change", async (e) => {
      currentModelType = e.target.value;
      console.log(`Model type changed to ${currentModelType}`);
      await loadModelInfo();
      resetPrompts();
    });
  }

  // New mode-select support
  const modeSelect = document.getElementById("mode-select");
  if (modeSelect) {
    modeSelect.addEventListener("change", async (e) => {
      const newModeId = e.target.value;
      await switchToMode(newModeId);
    });
  }

  // Text prompt input handler
  const textPromptInput = document.getElementById("text-prompt");
  if (textPromptInput) {
    textPromptInput.addEventListener("input", (e) => {
      currentTextPrompt = e.target.value.trim();
      console.log(`Text prompt updated: "${currentTextPrompt}"`);
    });

    // Clear prompt on Enter key
    textPromptInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (currentTextPrompt) {
          runSegmentation();
        }
      }
    });
  }

  // Window resize handler - reposition mask category dropdowns
  window.addEventListener("resize", () => {
    if (currentSegmentation && currentSegmentation.segmentation.length > 0) {
      renderMaskCategoryDropdowns();
    }
  });
}

incompleteModal = new ModalManager("incompleteSupercategoryModal");
nestedMismatchModal = new ModalManager("nestedMaskMismatchModal");
combinedWarningModal = new ModalManager("combinedWarningModal");
deleteModal = new ModalManager("deleteModal");
categoryModal = new ModalManager("categoryModal");
mergeCategoryModal = new ModalManager("mergeCategoryModal");

function setupMobileDebugConsole() {
  const debugConsole = document.getElementById("mobile-debug-console");
  const toggleBtn = document.getElementById("toggle-debug-console");

  if (!debugConsole || !toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    if (debugConsole.style.display === "none") {
      debugConsole.style.display = "block";
      toggleBtn.textContent = "Hide";
    } else {
      debugConsole.style.display = "none";
      toggleBtn.textContent = "Debug";
    }
  });

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = function (...args) {
    originalConsoleLog.apply(console, args);
    const msg = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg),
      )
      .join(" ");
    const entry = document.createElement("div");
    entry.textContent = new Date().toLocaleTimeString() + ": " + msg;
    entry.style.color = "#48d1cc";
    debugConsole.insertBefore(entry, debugConsole.firstChild);
    if (debugConsole.children.length > 50) {
      debugConsole.removeChild(debugConsole.lastChild);
    }
  };

  console.error = function (...args) {
    originalConsoleError.apply(console, args);
    const msg = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg),
      )
      .join(" ");
    const entry = document.createElement("div");
    entry.textContent = new Date().toLocaleTimeString() + ": ERROR: " + msg;
    entry.style.color = "#ff5555";
    debugConsole.insertBefore(entry, debugConsole.firstChild);
    if (debugConsole.children.length > 50) {
      debugConsole.removeChild(debugConsole.lastChild);
    }
  };

  console.log("Mobile debug console initialized");
}

setupMobileDebugConsole();
setupEventListeners();

/**
 * Get validation warnings for a specific image.
 * Used by gallery view to display warning indicators.
 * @param {number} imageId - The image ID to check
 * @returns {Object|null} Warning data or null if no warnings
 */
function getImageWarnings(imageId) {
  const imageData = Object.values(imageMap).find((img) => img.id === imageId);
  if (!imageData) return null;

  const incomplete = checkIncompleteSupercategories(
    imageData,
    annotationsByImage,
    categories,
  );

  const nested = checkNestedMaskSupercategoryMismatch(
    imageData,
    annotationsByImage,
    categories,
  );

  if (!incomplete && !nested) return null;

  return {
    incomplete: incomplete || [],
    nested: nested || [],
  };
}

// Inject warning function into gallery module
setWarningFunction(getImageWarnings);

// Initialize view manager to handle URL-based view switching
const initialViewState = initViewManager(handleViewChange);

// Initialize mode system, then load model info and dataset
initializeModeSystem().then(async () => {
  await loadDataset();

  // After dataset loads, switch to the correct view based on URL
  handleViewChange(initialViewState.view, initialViewState.params);
});
