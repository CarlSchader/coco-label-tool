/**
 * Tests for gallery.js - Gallery view functionality
 */

import {
  TYPE_ABBREVIATIONS,
  formatAnnotationCounts,
  createGalleryItemHtml,
  getGalleryState,
  resetGalleryState,
  updateGalleryState,
} from "../coco_label_tool/static/js/gallery.js";

describe("TYPE_ABBREVIATIONS", () => {
  test("has all five annotation types", () => {
    expect(TYPE_ABBREVIATIONS.object_detection).toBe("ObjDet");
    expect(TYPE_ABBREVIATIONS.keypoint).toBe("Keypt");
    expect(TYPE_ABBREVIATIONS.panoptic).toBe("Panop");
    expect(TYPE_ABBREVIATIONS.captioning).toBe("Cap");
    expect(TYPE_ABBREVIATIONS.densepose).toBe("Dense");
  });

  test("has exactly 5 entries", () => {
    expect(Object.keys(TYPE_ABBREVIATIONS).length).toBe(5);
  });
});

describe("formatAnnotationCounts", () => {
  test("returns empty string for empty counts", () => {
    expect(formatAnnotationCounts({})).toBe("");
  });

  test("formats single type", () => {
    const result = formatAnnotationCounts({ object_detection: 5 });
    expect(result).toBe("ObjDet:5");
  });

  test("formats multiple types", () => {
    const result = formatAnnotationCounts({
      object_detection: 5,
      captioning: 2,
    });
    expect(result).toBe("ObjDet:5 Cap:2");
  });

  test("formats all five types", () => {
    const result = formatAnnotationCounts({
      object_detection: 10,
      keypoint: 5,
      panoptic: 3,
      captioning: 7,
      densepose: 2,
    });
    expect(result).toBe("ObjDet:10 Keypt:5 Panop:3 Cap:7 Dense:2");
  });

  test("skips zero counts", () => {
    const result = formatAnnotationCounts({
      object_detection: 5,
      captioning: 0,
      keypoint: 3,
    });
    expect(result).toBe("ObjDet:5 Keypt:3");
  });

  test("handles unknown types gracefully", () => {
    const result = formatAnnotationCounts({
      object_detection: 5,
      unknown_type: 3,
    });
    // Should skip unknown types
    expect(result).toBe("ObjDet:5");
  });

  test("maintains consistent order", () => {
    // Same counts, different input order should give same output
    const result1 = formatAnnotationCounts({
      captioning: 2,
      object_detection: 5,
    });
    const result2 = formatAnnotationCounts({
      object_detection: 5,
      captioning: 2,
    });
    expect(result1).toBe(result2);
  });
});

describe("createGalleryItemHtml", () => {
  const sampleImage = {
    id: 123,
    index: 5,
    file_name: "test_image.jpg",
    width: 1920,
    height: 1080,
    annotation_counts: { object_detection: 5, captioning: 2 },
    total_annotations: 7,
  };

  test("creates valid HTML structure", () => {
    const html = createGalleryItemHtml(sampleImage);
    expect(html).toContain('class="gallery-item"');
    expect(html).toContain('data-index="5"');
    expect(html).toContain('data-image-id="123"');
  });

  test("includes thumbnail image", () => {
    const html = createGalleryItemHtml(sampleImage);
    expect(html).toContain('src="/api/thumbnail/123?size=64"');
    expect(html).toContain('class="gallery-thumbnail"');
  });

  test("includes filename", () => {
    const html = createGalleryItemHtml(sampleImage);
    expect(html).toContain("test_image.jpg");
    expect(html).toContain('class="gallery-item-filename"');
  });

  test("includes annotation counts", () => {
    const html = createGalleryItemHtml(sampleImage);
    expect(html).toContain("ObjDet:5");
    expect(html).toContain("Cap:2");
  });

  test("adds unannotated class when no annotations", () => {
    const unannotatedImage = {
      ...sampleImage,
      annotation_counts: {},
      total_annotations: 0,
    };
    const html = createGalleryItemHtml(unannotatedImage);
    expect(html).toContain('class="gallery-item unannotated"');
  });

  test("does not add unannotated class when has annotations", () => {
    const html = createGalleryItemHtml(sampleImage);
    expect(html).not.toContain("unannotated");
  });

  test("includes loading spinner", () => {
    const html = createGalleryItemHtml(sampleImage);
    expect(html).toContain('class="gallery-thumbnail-spinner"');
  });

  test("escapes filename in title attribute", () => {
    const imageWithQuotes = {
      ...sampleImage,
      file_name: 'image "with" quotes.jpg',
    };
    const html = createGalleryItemHtml(imageWithQuotes);
    expect(html).toContain('title="image &quot;with&quot; quotes.jpg"');
  });

  test("handles long filenames", () => {
    const longFilename = {
      ...sampleImage,
      file_name: "very_long_filename_that_should_be_truncated_in_display.jpg",
    };
    const html = createGalleryItemHtml(longFilename);
    expect(html).toContain(longFilename.file_name);
  });
});

describe("Gallery State Management", () => {
  beforeEach(() => {
    resetGalleryState();
  });

  test("initial state has defaults", () => {
    const state = getGalleryState();
    expect(state.currentPage).toBe(0);
    expect(state.currentFilter).toBe("all");
    expect(state.currentSort).toBe("index");
    expect(state.isLoading).toBe(false);
    expect(state.hasMore).toBe(true);
    expect(state.loadedImages).toEqual([]);
    expect(state.totalImages).toBe(0);
    expect(state.totalFiltered).toBe(0);
  });

  test("updateGalleryState merges state", () => {
    updateGalleryState({ currentPage: 2, isLoading: true });
    const state = getGalleryState();
    expect(state.currentPage).toBe(2);
    expect(state.isLoading).toBe(true);
    expect(state.currentFilter).toBe("all"); // unchanged
  });

  test("resetGalleryState restores defaults", () => {
    updateGalleryState({
      currentPage: 5,
      currentFilter: "annotated",
      loadedImages: [{ id: 1 }],
    });
    resetGalleryState();
    const state = getGalleryState();
    expect(state.currentPage).toBe(0);
    expect(state.currentFilter).toBe("all");
    expect(state.loadedImages).toEqual([]);
  });

  test("updateGalleryState can update loadedImages", () => {
    const images = [{ id: 1 }, { id: 2 }];
    updateGalleryState({ loadedImages: images });
    const state = getGalleryState();
    expect(state.loadedImages).toEqual(images);
  });

  test("updateGalleryState can append to loadedImages", () => {
    updateGalleryState({ loadedImages: [{ id: 1 }] });
    const state = getGalleryState();
    const newImages = [...state.loadedImages, { id: 2 }];
    updateGalleryState({ loadedImages: newImages });
    expect(getGalleryState().loadedImages).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("Gallery State with Filter/Sort", () => {
  beforeEach(() => {
    resetGalleryState();
  });

  test("can update filter", () => {
    updateGalleryState({ currentFilter: "annotated" });
    expect(getGalleryState().currentFilter).toBe("annotated");
  });

  test("can update sort", () => {
    updateGalleryState({ currentSort: "filename" });
    expect(getGalleryState().currentSort).toBe("filename");
  });

  test("can update multiple values at once", () => {
    updateGalleryState({
      currentPage: 3,
      currentFilter: "unannotated",
      currentSort: "annotations_desc",
      hasMore: false,
    });
    const state = getGalleryState();
    expect(state.currentPage).toBe(3);
    expect(state.currentFilter).toBe("unannotated");
    expect(state.currentSort).toBe("annotations_desc");
    expect(state.hasMore).toBe(false);
  });
});

describe("Thumbnail URL generation", () => {
  test("generates correct URL for image", () => {
    const html = createGalleryItemHtml({
      id: 456,
      index: 10,
      file_name: "test.jpg",
      width: 100,
      height: 100,
      annotation_counts: {},
      total_annotations: 0,
    });
    expect(html).toContain('src="/api/thumbnail/456?size=64"');
  });

  test("uses image ID not index in URL", () => {
    const html = createGalleryItemHtml({
      id: 999,
      index: 0,
      file_name: "test.jpg",
      width: 100,
      height: 100,
      annotation_counts: {},
      total_annotations: 0,
    });
    expect(html).toContain("/api/thumbnail/999");
    expect(html).not.toContain("/api/thumbnail/0");
  });
});
