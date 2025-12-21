/**
 * Image preloader - caches images asynchronously around the current index
 * to improve navigation performance.
 */

export class ImagePreloader {
  constructor(config = {}) {
    this.preloadRadius = config.preloadRadius || 4; // Preload 4 images in each direction (8 total)
    this.cache = new Map(); // URL -> Image object
    this.loadingUrls = new Set(); // Track in-progress loads
    this.currentIndex = 0;
    this.totalImages = 0;
    this.imageMap = {};
  }

  /**
   * Update the current state and trigger preloading.
   * @param {number} index - Current image index
   * @param {number} totalImages - Total number of images
   * @param {Object} imageMap - Map of index -> image data
   */
  updateState(index, totalImages, imageMap) {
    this.currentIndex = index;
    this.totalImages = totalImages;
    this.imageMap = imageMap;

    // Trigger preloading asynchronously (don't wait)
    this.preloadAroundIndex(index);
  }

  /**
   * Preload images around the given index.
   * @param {number} centerIndex - Index to preload around
   */
  async preloadAroundIndex(centerIndex) {
    const indicesToPreload = [];

    // Calculate range to preload
    for (let i = 1; i <= this.preloadRadius; i++) {
      // Forward
      const forwardIndex = (centerIndex + i) % this.totalImages;
      indicesToPreload.push(forwardIndex);

      // Backward
      const backwardIndex =
        (((centerIndex - i) % this.totalImages) + this.totalImages) %
        this.totalImages;
      indicesToPreload.push(backwardIndex);
    }

    // Preload in parallel (fire and forget)
    const preloadPromises = indicesToPreload.map((idx) =>
      this.preloadImage(idx),
    );

    // Don't await - let them load in background
    Promise.allSettled(preloadPromises).then((results) => {
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      console.log(
        `[ImagePreloader] Preloaded ${successful}/${indicesToPreload.length} images (${failed} failed)`,
      );
    });
  }

  /**
   * Preload a single image by index.
   * @param {number} index - Image index to preload
   * @returns {Promise<Image>}
   */
  async preloadImage(index) {
    const imgData = this.imageMap[index];
    if (!imgData) {
      return null;
    }

    const url = `/api/image/${imgData.id}`;

    // Already cached
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // Already loading
    if (this.loadingUrls.has(url)) {
      return null;
    }

    // Start loading
    this.loadingUrls.add(url);

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.cache.set(url, img);
        this.loadingUrls.delete(url);
        resolve(img);
      };

      img.onerror = (err) => {
        this.loadingUrls.delete(url);
        console.warn(`[ImagePreloader] Failed to preload ${url}:`, err);
        reject(err);
      };

      img.src = url;
    });
  }

  /**
   * Check if an image is cached.
   * @param {number} imageId - Image ID
   * @returns {boolean}
   */
  isCached(imageId) {
    const url = `/api/image/${imageId}`;
    return this.cache.has(url);
  }

  /**
   * Get cache statistics.
   * @returns {Object}
   */
  getStats() {
    return {
      cachedImages: this.cache.size,
      loadingImages: this.loadingUrls.size,
      preloadRadius: this.preloadRadius,
    };
  }

  /**
   * Clear the cache (useful for memory management).
   */
  clearCache() {
    this.cache.clear();
    this.loadingUrls.clear();
    console.log("[ImagePreloader] Cache cleared");
  }

  /**
   * Prune cache to keep only images near current index.
   * This prevents unbounded memory growth during long sessions.
   */
  pruneCache() {
    const keepRadius = this.preloadRadius * 2; // Keep a bit more than we preload
    const indicesToKeep = new Set();

    // Calculate indices to keep
    for (let i = -keepRadius; i <= keepRadius; i++) {
      const idx =
        (((this.currentIndex + i) % this.totalImages) + this.totalImages) %
        this.totalImages;
      const imgData = this.imageMap[idx];
      if (imgData) {
        indicesToKeep.add(`/api/image/${imgData.id}`);
      }
    }

    // Remove cached images outside the keep range
    const urlsToDelete = [];
    for (const url of this.cache.keys()) {
      if (!indicesToKeep.has(url)) {
        urlsToDelete.push(url);
      }
    }

    urlsToDelete.forEach((url) => this.cache.delete(url));

    if (urlsToDelete.length > 0) {
      console.log(
        `[ImagePreloader] Pruned ${urlsToDelete.length} images from cache`,
      );
    }
  }
}
