/**
 * Unit tests for model selection utilities
 */

import {
  getSegmentEndpoint,
  getModelInfoEndpoint,
  getSetModelSizeEndpoint,
  formatModelDisplayName,
} from "../coco_label_tool/static/js/utils/model-selection.js";

describe("Model Selection Utilities", () => {
  describe("getSegmentEndpoint", () => {
    test("returns SAM2 endpoint for sam2 model type", () => {
      expect(getSegmentEndpoint("sam2")).toBe("/api/segment");
    });

    test("returns SAM3 endpoint for sam3 model type", () => {
      expect(getSegmentEndpoint("sam3")).toBe("/api/segment-sam3");
    });

    test("returns SAM3 PCS endpoint for sam3-pcs model type", () => {
      expect(getSegmentEndpoint("sam3-pcs")).toBe("/api/segment-sam3-pcs");
    });

    test("defaults to SAM2 endpoint for null model type", () => {
      expect(getSegmentEndpoint(null)).toBe("/api/segment");
    });

    test("defaults to SAM2 endpoint for undefined model type", () => {
      expect(getSegmentEndpoint(undefined)).toBe("/api/segment");
    });

    test("defaults to SAM2 endpoint for empty string", () => {
      expect(getSegmentEndpoint("")).toBe("/api/segment");
    });

    test("defaults to SAM2 endpoint for unknown model type", () => {
      expect(getSegmentEndpoint("unknown")).toBe("/api/segment");
    });

    test("returns null for manual model type (frontend-only)", () => {
      expect(getSegmentEndpoint("manual")).toBeNull();
    });

    test("returns null for manual model type case-insensitive", () => {
      expect(getSegmentEndpoint("MANUAL")).toBeNull();
      expect(getSegmentEndpoint("Manual")).toBeNull();
    });
  });

  describe("getModelInfoEndpoint", () => {
    test("returns SAM2 model info endpoint for sam2", () => {
      expect(getModelInfoEndpoint("sam2")).toBe("/api/model-info");
    });

    test("returns SAM3 model info endpoint for sam3", () => {
      expect(getModelInfoEndpoint("sam3")).toBe("/api/model-info-sam3");
    });

    test("returns SAM3 PCS model info endpoint for sam3-pcs", () => {
      expect(getModelInfoEndpoint("sam3-pcs")).toBe("/api/model-info-sam3-pcs");
    });

    test("defaults to SAM2 for null", () => {
      expect(getModelInfoEndpoint(null)).toBe("/api/model-info");
    });

    test("defaults to SAM2 for undefined", () => {
      expect(getModelInfoEndpoint(undefined)).toBe("/api/model-info");
    });

    test("defaults to SAM2 for empty string", () => {
      expect(getModelInfoEndpoint("")).toBe("/api/model-info");
    });

    test("defaults to SAM2 for unknown type", () => {
      expect(getModelInfoEndpoint("unknown")).toBe("/api/model-info");
    });

    test("returns null for manual model type (no ML model)", () => {
      expect(getModelInfoEndpoint("manual")).toBeNull();
    });

    test("returns null for manual model type case-insensitive", () => {
      expect(getModelInfoEndpoint("MANUAL")).toBeNull();
      expect(getModelInfoEndpoint("Manual")).toBeNull();
    });
  });

  describe("getSetModelSizeEndpoint", () => {
    test("returns SAM2 set size endpoint for sam2", () => {
      expect(getSetModelSizeEndpoint("sam2")).toBe("/api/set-model-size");
    });

    test("returns SAM3 set size endpoint for sam3", () => {
      expect(getSetModelSizeEndpoint("sam3")).toBe("/api/set-model-size-sam3");
    });

    test("returns SAM3 PCS set size endpoint for sam3-pcs", () => {
      expect(getSetModelSizeEndpoint("sam3-pcs")).toBe(
        "/api/set-model-size-sam3-pcs",
      );
    });

    test("defaults to SAM2 for null", () => {
      expect(getSetModelSizeEndpoint(null)).toBe("/api/set-model-size");
    });

    test("defaults to SAM2 for undefined", () => {
      expect(getSetModelSizeEndpoint(undefined)).toBe("/api/set-model-size");
    });

    test("defaults to SAM2 for empty string", () => {
      expect(getSetModelSizeEndpoint("")).toBe("/api/set-model-size");
    });

    test("defaults to SAM2 for unknown type", () => {
      expect(getSetModelSizeEndpoint("unknown")).toBe("/api/set-model-size");
    });

    test("returns null for manual model type (no model sizes)", () => {
      expect(getSetModelSizeEndpoint("manual")).toBeNull();
    });

    test("returns null for manual model type case-insensitive", () => {
      expect(getSetModelSizeEndpoint("MANUAL")).toBeNull();
      expect(getSetModelSizeEndpoint("Manual")).toBeNull();
    });
  });

  describe("formatModelDisplayName", () => {
    test("formats SAM2 tiny model", () => {
      expect(formatModelDisplayName("sam2", "tiny")).toBe("SAM2 TINY");
    });

    test("formats SAM2 small model", () => {
      expect(formatModelDisplayName("sam2", "small")).toBe("SAM2 SMALL");
    });

    test("formats SAM2 base model", () => {
      expect(formatModelDisplayName("sam2", "base")).toBe("SAM2 BASE");
    });

    test("formats SAM2 large model", () => {
      expect(formatModelDisplayName("sam2", "large")).toBe("SAM2 LARGE");
    });

    test("formats SAM3 base model", () => {
      expect(formatModelDisplayName("sam3", "base")).toBe("SAM3 BASE");
    });

    test("formats SAM3 tiny model", () => {
      expect(formatModelDisplayName("sam3", "tiny")).toBe("SAM3 TINY");
    });

    test("formats SAM3 PCS base model", () => {
      expect(formatModelDisplayName("sam3-pcs", "base")).toBe("SAM3 PCS BASE");
    });

    test("handles null model type - defaults to SAM2", () => {
      expect(formatModelDisplayName(null, "tiny")).toBe("SAM2 TINY");
    });

    test("handles undefined model type - defaults to SAM2", () => {
      expect(formatModelDisplayName(undefined, "base")).toBe("SAM2 BASE");
    });

    test("handles empty model type - defaults to SAM2", () => {
      expect(formatModelDisplayName("", "large")).toBe("SAM2 LARGE");
    });

    test("handles unknown model type - defaults to SAM2", () => {
      expect(formatModelDisplayName("sam4", "tiny")).toBe("SAM2 TINY");
    });

    test("handles null size", () => {
      expect(formatModelDisplayName("sam2", null)).toBe("SAM2 ");
    });

    test("handles undefined size", () => {
      expect(formatModelDisplayName("sam2", undefined)).toBe("SAM2 ");
    });

    test("handles empty size", () => {
      expect(formatModelDisplayName("sam2", "")).toBe("SAM2 ");
    });

    test("preserves size case and converts to uppercase", () => {
      expect(formatModelDisplayName("sam2", "TiNy")).toBe("SAM2 TINY");
    });

    test("handles special characters in size", () => {
      expect(formatModelDisplayName("sam2", "base-plus")).toBe(
        "SAM2 BASE-PLUS",
      );
    });

    test("formats manual model type", () => {
      expect(formatModelDisplayName("manual", null)).toBe("MANUAL");
      expect(formatModelDisplayName("manual", "")).toBe("MANUAL");
    });

    test("formats manual model type case-insensitive", () => {
      expect(formatModelDisplayName("MANUAL", null)).toBe("MANUAL");
      expect(formatModelDisplayName("Manual", null)).toBe("MANUAL");
    });
  });

  describe("Edge cases", () => {
    test("all functions handle case insensitivity for model type", () => {
      expect(getSegmentEndpoint("SAM2")).toBe("/api/segment");
      expect(getSegmentEndpoint("Sam2")).toBe("/api/segment");
      expect(getSegmentEndpoint("SAM3")).toBe("/api/segment-sam3");
      expect(getSegmentEndpoint("Sam3")).toBe("/api/segment-sam3");
      expect(getSegmentEndpoint("SAM3-PCS")).toBe("/api/segment-sam3-pcs");
      expect(getSegmentEndpoint("sam3-PCS")).toBe("/api/segment-sam3-pcs");
      expect(getSegmentEndpoint("MANUAL")).toBeNull();
      expect(getSegmentEndpoint("Manual")).toBeNull();
    });

    test("formatModelDisplayName preserves original case in output", () => {
      expect(formatModelDisplayName("SAM2", "tiny")).toBe("SAM2 TINY");
      expect(formatModelDisplayName("sam3", "BASE")).toBe("SAM3 BASE");
    });
  });
});
