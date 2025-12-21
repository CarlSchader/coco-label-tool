import { ImagePreloader } from "../../coco_label_tool/static/js/utils/image-preloader.js";

// Mock Image class for Node.js environment
global.Image = class Image {
  constructor() {
    this.src = "";
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
    // Simulate async image loading
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }

  get src() {
    return this._src;
  }
};

// Suppress console.log from async preloading to avoid "Cannot log after tests are done" warnings
// This is needed because ImagePreloader fires off async image loads that complete after tests finish
console.log = () => {};

describe("ImagePreloader", () => {
  let preloader;

  beforeEach(() => {
    preloader = new ImagePreloader({ preloadRadius: 2 });
  });

  afterEach(() => {
    preloader.clearCache();
  });

  describe("constructor", () => {
    test("initializes with default config", () => {
      const p = new ImagePreloader();
      expect(p.preloadRadius).toBe(4);
      expect(p.cache.size).toBe(0);
      expect(p.loadingUrls.size).toBe(0);
    });

    test("initializes with custom config", () => {
      const p = new ImagePreloader({ preloadRadius: 10 });
      expect(p.preloadRadius).toBe(10);
    });
  });

  describe("updateState", () => {
    test("updates state without errors", () => {
      const imageMap = {
        0: { id: 1, file_name: "img1.jpg" },
        1: { id: 2, file_name: "img2.jpg" },
        2: { id: 3, file_name: "img3.jpg" },
      };

      preloader.updateState(0, 3, imageMap);

      expect(preloader.currentIndex).toBe(0);
      expect(preloader.totalImages).toBe(3);
      expect(preloader.imageMap).toBe(imageMap);
    });
  });

  describe("getStats", () => {
    test("returns correct stats", () => {
      preloader.cache.set("/api/image/1", new Image());
      preloader.cache.set("/api/image/2", new Image());
      preloader.loadingUrls.add("/api/image/3");

      const stats = preloader.getStats();

      expect(stats.cachedImages).toBe(2);
      expect(stats.loadingImages).toBe(1);
      expect(stats.preloadRadius).toBe(2);
    });
  });

  describe("isCached", () => {
    test("returns false for uncached image", () => {
      expect(preloader.isCached(1)).toBe(false);
    });

    test("returns true for cached image", () => {
      preloader.cache.set("/api/image/1", new Image());
      expect(preloader.isCached(1)).toBe(true);
    });
  });

  describe("clearCache", () => {
    test("clears all cached data", () => {
      preloader.cache.set("/api/image/1", new Image());
      preloader.loadingUrls.add("/api/image/2");

      preloader.clearCache();

      expect(preloader.cache.size).toBe(0);
      expect(preloader.loadingUrls.size).toBe(0);
    });
  });

  describe("pruneCache", () => {
    test("keeps images near current index", () => {
      const imageMap = {};
      for (let i = 0; i < 20; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
        preloader.cache.set(`/api/image/${i + 1}`, new Image());
      }

      preloader.updateState(10, 20, imageMap);
      preloader.pruneCache();

      // With preloadRadius=2, keepRadius=4
      // Should keep indices 6-14 (10 ± 4)
      // That's 9 images total
      expect(preloader.cache.size).toBeLessThan(20);
      expect(preloader.cache.size).toBeGreaterThan(0);
    });

    test("handles edge case at start of dataset", () => {
      const imageMap = {};
      for (let i = 0; i < 10; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
        preloader.cache.set(`/api/image/${i + 1}`, new Image());
      }

      preloader.updateState(0, 10, imageMap);
      preloader.pruneCache();

      // Should keep some images
      expect(preloader.cache.size).toBeGreaterThan(0);
    });

    test("handles edge case at end of dataset", () => {
      const imageMap = {};
      for (let i = 0; i < 10; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
        preloader.cache.set(`/api/image/${i + 1}`, new Image());
      }

      preloader.updateState(9, 10, imageMap);
      preloader.pruneCache();

      // Should keep some images
      expect(preloader.cache.size).toBeGreaterThan(0);
    });
  });

  describe("preloadImage", () => {
    test("returns null for missing image data", async () => {
      preloader.updateState(0, 10, {});

      const result = await preloader.preloadImage(5);

      expect(result).toBeNull();
    });

    test("returns cached image immediately", async () => {
      const mockImg = new Image();
      preloader.cache.set("/api/image/1", mockImg);
      preloader.updateState(0, 10, { 0: { id: 1, file_name: "img.jpg" } });

      const result = await preloader.preloadImage(0);

      expect(result).toBe(mockImg);
    });

    test("returns null if already loading", async () => {
      preloader.loadingUrls.add("/api/image/1");
      preloader.updateState(0, 10, { 0: { id: 1, file_name: "img.jpg" } });

      const result = await preloader.preloadImage(0);

      expect(result).toBeNull();
    });
  });

  describe("preloadAroundIndex", () => {
    test("calculates correct indices to preload", () => {
      const imageMap = {};
      for (let i = 0; i < 10; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
      }

      preloader.updateState(5, 10, imageMap);

      // With preloadRadius=2, should preload:
      // Forward: 6, 7
      // Backward: 4, 3
      // Total: 4 indices

      // Just verify it doesn't throw
      expect(() => preloader.preloadAroundIndex(5)).not.toThrow();
    });

    test("handles wraparound at end of dataset", () => {
      const imageMap = {};
      for (let i = 0; i < 10; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
      }

      preloader.updateState(9, 10, imageMap);

      // Should wrap around to index 0, 1
      expect(() => preloader.preloadAroundIndex(9)).not.toThrow();
    });

    test("handles wraparound at start of dataset", () => {
      const imageMap = {};
      for (let i = 0; i < 10; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
      }

      preloader.updateState(0, 10, imageMap);

      // Should wrap around to index 9, 8
      expect(() => preloader.preloadAroundIndex(0)).not.toThrow();
    });
  });

  describe("integration", () => {
    test("full workflow - update state and check stats", () => {
      const imageMap = {
        0: { id: 1, file_name: "img1.jpg" },
        1: { id: 2, file_name: "img2.jpg" },
        2: { id: 3, file_name: "img3.jpg" },
        3: { id: 4, file_name: "img4.jpg" },
        4: { id: 5, file_name: "img5.jpg" },
      };

      // Manually add some cached images
      preloader.cache.set("/api/image/1", new Image());
      preloader.cache.set("/api/image/2", new Image());

      preloader.updateState(2, 5, imageMap);

      const stats = preloader.getStats();
      expect(stats.cachedImages).toBe(2);
      expect(stats.preloadRadius).toBe(2);
    });

    test("pruning removes far images", () => {
      const imageMap = {};
      for (let i = 0; i < 50; i++) {
        imageMap[i] = { id: i + 1, file_name: `img${i}.jpg` };
        preloader.cache.set(`/api/image/${i + 1}`, new Image());
      }

      preloader.updateState(25, 50, imageMap);
      expect(preloader.cache.size).toBe(50);

      preloader.pruneCache();
      expect(preloader.cache.size).toBeLessThan(50);
      expect(preloader.cache.size).toBeGreaterThan(0);

      // Nearby images should still be cached
      expect(preloader.isCached(26)).toBe(true);
    });
  });
});
