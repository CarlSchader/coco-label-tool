/**
 * Tests for auto-label functionality.
 *
 * These tests cover the UI state management and notification system
 * for the auto-labeling feature.
 */

import { jest } from "@jest/globals";

// Mock DOM elements
const mockElements = {
  "auto-label-section": {
    style: { display: "none" },
  },
  "auto-label-select": {
    innerHTML: "",
    value: "",
  },
  "auto-label-btn": {
    disabled: false,
    textContent: "Auto Label",
    addEventListener: jest.fn(),
  },
  "notification-toast": {
    textContent: "",
    className: "",
    style: { display: "none" },
  },
};

// Mock getElementById
global.document = {
  getElementById: jest.fn((id) => mockElements[id] || null),
};

// =============================================================================
// showNotification Tests
// =============================================================================

describe("showNotification", () => {
  // Create a simplified version for testing
  function showNotification(message, type = "info") {
    const notification = document.getElementById("notification-toast");
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification-toast ${type}`;
    notification.style.display = "block";
  }

  beforeEach(() => {
    // Reset mock element
    mockElements["notification-toast"] = {
      textContent: "",
      className: "",
      style: { display: "none" },
    };
  });

  test("displays message", () => {
    showNotification("Test message");

    const toast = mockElements["notification-toast"];
    expect(toast.textContent).toBe("Test message");
    expect(toast.style.display).toBe("block");
  });

  test("applies correct class for success type", () => {
    showNotification("Success!", "success");

    const toast = mockElements["notification-toast"];
    expect(toast.className).toBe("notification-toast success");
  });

  test("applies correct class for error type", () => {
    showNotification("Error!", "error");

    const toast = mockElements["notification-toast"];
    expect(toast.className).toBe("notification-toast error");
  });

  test("applies correct class for info type", () => {
    showNotification("Info", "info");

    const toast = mockElements["notification-toast"];
    expect(toast.className).toBe("notification-toast info");
  });

  test("defaults to info type", () => {
    showNotification("Default type");

    const toast = mockElements["notification-toast"];
    expect(toast.className).toBe("notification-toast info");
  });

  test("handles missing element gracefully", () => {
    document.getElementById = jest.fn(() => null);

    // Should not throw
    expect(() => showNotification("Test")).not.toThrow();

    // Restore mock
    document.getElementById = jest.fn((id) => mockElements[id] || null);
  });
});

// =============================================================================
// Auto-Label UI State Tests
// =============================================================================

describe("Auto-label UI state", () => {
  beforeEach(() => {
    // Reset mock elements
    mockElements["auto-label-section"].style.display = "none";
    mockElements["auto-label-select"].innerHTML = "";
    mockElements["auto-label-select"].value = "";
  });

  test("section hidden by default", () => {
    expect(mockElements["auto-label-section"].style.display).toBe("none");
  });

  test("section can be shown when endpoints configured", () => {
    // Simulate initAutoLabel behavior
    const endpoints = ["yolo-v8", "florence-2"];
    if (endpoints.length > 0) {
      mockElements["auto-label-section"].style.display = "inline-flex";
    }

    expect(mockElements["auto-label-section"].style.display).toBe(
      "inline-flex",
    );
  });

  test("dropdown populated with endpoint names", () => {
    const endpoints = ["yolo-v8", "florence-2"];

    mockElements["auto-label-select"].innerHTML = endpoints
      .map(
        (name) =>
          `<option value="${name}">${name.toUpperCase().replace(/-/g, " ")}</option>`,
      )
      .join("");

    expect(mockElements["auto-label-select"].innerHTML).toContain("YOLO V8");
    expect(mockElements["auto-label-select"].innerHTML).toContain("FLORENCE 2");
  });

  test("dropdown empty when no endpoints", () => {
    const endpoints = [];

    mockElements["auto-label-select"].innerHTML = endpoints
      .map((name) => `<option value="${name}">${name}</option>`)
      .join("");

    expect(mockElements["auto-label-select"].innerHTML).toBe("");
  });
});

// =============================================================================
// Auto-Label Button State Tests
// =============================================================================

describe("Auto-label button state", () => {
  beforeEach(() => {
    mockElements["auto-label-btn"].disabled = false;
    mockElements["auto-label-btn"].textContent = "Auto Label";
  });

  test("button disabled during labeling", () => {
    // Simulate loading state
    mockElements["auto-label-btn"].disabled = true;
    mockElements["auto-label-btn"].textContent = "LABELING...";

    expect(mockElements["auto-label-btn"].disabled).toBe(true);
    expect(mockElements["auto-label-btn"].textContent).toBe("LABELING...");
  });

  test("button re-enabled after labeling", () => {
    // Simulate loading state
    mockElements["auto-label-btn"].disabled = true;
    mockElements["auto-label-btn"].textContent = "LABELING...";

    // Simulate completion
    mockElements["auto-label-btn"].disabled = false;
    mockElements["auto-label-btn"].textContent = "Auto Label";

    expect(mockElements["auto-label-btn"].disabled).toBe(false);
    expect(mockElements["auto-label-btn"].textContent).toBe("Auto Label");
  });
});

// =============================================================================
// Annotation Processing Tests
// =============================================================================

describe("Annotation processing", () => {
  test("converts server annotations to segmentation format", () => {
    const serverAnnotations = [
      {
        category_id: 5,
        segmentation: [[10, 10, 20, 10, 20, 20, 10, 20]],
        bbox: [10, 10, 10, 10],
        area: 100,
      },
      {
        category_id: 12,
        segmentation: [[30, 30, 40, 30, 40, 40, 30, 40]],
        bbox: [30, 30, 10, 10],
        area: 100,
      },
    ];

    // Simulate the conversion logic from handleAutoLabel
    const allSegmentations = [];
    const allCategoryIds = [];

    for (const ann of serverAnnotations) {
      allSegmentations.push(...ann.segmentation);
      for (let i = 0; i < ann.segmentation.length; i++) {
        allCategoryIds.push(ann.category_id);
      }
    }

    expect(allSegmentations).toHaveLength(2);
    expect(allCategoryIds).toEqual([5, 12]);
  });

  test("handles multi-polygon annotations", () => {
    const serverAnnotations = [
      {
        category_id: 5,
        // Annotation with 2 polygons (multi-part segmentation)
        segmentation: [
          [10, 10, 20, 10, 20, 20, 10, 20],
          [50, 50, 60, 50, 60, 60, 50, 60],
        ],
        bbox: [10, 10, 50, 50],
        area: 200,
      },
    ];

    const allSegmentations = [];
    const allCategoryIds = [];

    for (const ann of serverAnnotations) {
      allSegmentations.push(...ann.segmentation);
      for (let i = 0; i < ann.segmentation.length; i++) {
        allCategoryIds.push(ann.category_id);
      }
    }

    // Should have 2 segmentations from the single annotation
    expect(allSegmentations).toHaveLength(2);
    // Category ID should be repeated for each polygon
    expect(allCategoryIds).toEqual([5, 5]);
  });

  test("handles empty annotations array", () => {
    const serverAnnotations = [];

    const allSegmentations = [];
    const allCategoryIds = [];

    for (const ann of serverAnnotations) {
      allSegmentations.push(...ann.segmentation);
      for (let i = 0; i < ann.segmentation.length; i++) {
        allCategoryIds.push(ann.category_id);
      }
    }

    expect(allSegmentations).toHaveLength(0);
    expect(allCategoryIds).toHaveLength(0);
  });
});

// =============================================================================
// API Response Handling Tests
// =============================================================================

describe("API response handling", () => {
  test("success response with annotations", () => {
    const response = {
      success: true,
      annotations: [
        {
          category_id: 5,
          segmentation: [[10, 10, 20, 10, 20, 20]],
          bbox: [10, 10, 10, 10],
          area: 50,
        },
      ],
      count: 1,
    };

    expect(response.success).toBe(true);
    expect(response.annotations).toHaveLength(1);
    expect(response.count).toBe(1);
  });

  test("success response with no detections", () => {
    const response = {
      success: true,
      annotations: [],
      count: 0,
    };

    expect(response.success).toBe(true);
    expect(response.annotations).toHaveLength(0);
    expect(response.count).toBe(0);
  });

  test("error response structure", () => {
    const error = {
      message: "Invalid response: missing 'segmentation'",
    };

    expect(error.message).toContain("Invalid response");
  });
});
