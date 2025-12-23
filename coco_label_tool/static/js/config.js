export const CONFIG = {
  canvas: {
    pointRadius: 5,
    pointHoverRadius: 8,
    pointHoverGlowRadius: 12,
    deleteButtonSize: 20,
    hoverHitArea: 12,
    lineWidth: 2,
    lineWidthHover: 3,
    minBoxSize: 5,
    dragThreshold: 150,
  },

  colors: {
    positive: "#00ff00",
    negative: "#ff0000",
    hover: "#ffff00",
    segmentation: "rgba(255, 0, 0, 0.2)",
    segmentationBorder: "#ff0000",
    boxBorder: "#00ff00",
    boxBorderHover: "#ffff00",
    deleteButton: "#cc0000",
    deleteButtonHover: "#ff0000",
    white: "#ffffff",
  },

  validation: {
    containmentThreshold: 0.8,
    minPolygonPoints: 3,
  },

  navigation: {
    showWarnings: false, // Show warnings for incomplete/nested issues when navigating
  },

  cache: {
    refreshThreshold: 16,
    margin: 32,
  },

  api: {
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  },

  primaryColors: [
    // Row 1: Primary and secondary colors
    [255, 50, 50], // Bright red
    [50, 150, 255], // Bright blue
    [50, 200, 50], // Bright green
    [255, 150, 50], // Orange
    [150, 50, 255], // Purple
    [255, 200, 50], // Yellow
    [50, 200, 200], // Cyan
    [255, 50, 200], // Magenta

    // Row 2: Darker/richer tones
    [200, 0, 0], // Dark red
    [0, 100, 200], // Dark blue
    [0, 150, 0], // Dark green
    [200, 100, 0], // Dark orange
    [100, 0, 150], // Dark purple
    [180, 150, 0], // Dark yellow/gold
    [0, 150, 150], // Dark cyan/teal
    [180, 0, 150], // Dark magenta

    // Row 3: Pastel/lighter tones
    [255, 150, 150], // Light red/pink
    [150, 200, 255], // Light blue/sky
    [150, 255, 150], // Light green/lime
    [255, 200, 150], // Peach
    [200, 150, 255], // Light purple/lavender
    [255, 255, 150], // Light yellow/cream
    [150, 255, 255], // Light cyan/aqua
    [255, 150, 255], // Light magenta/pink

    // Row 4: Earth tones and unique colors
    [139, 69, 19], // Brown
    [210, 105, 30], // Chocolate
    [184, 134, 11], // Dark goldenrod
    [85, 107, 47], // Olive green
    [47, 79, 79], // Dark slate gray
    [72, 61, 139], // Dark slate blue
    [188, 143, 143], // Rosy brown
    [160, 82, 45], // Sienna

    // Row 5: Neon/vibrant colors
    [255, 0, 127], // Hot pink
    [0, 255, 127], // Spring green
    [127, 0, 255], // Electric purple
    [255, 127, 0], // Bright orange
    [0, 127, 255], // Dodger blue
    [127, 255, 0], // Chartreuse
    [255, 0, 255], // Fuchsia
    [0, 255, 255], // Aqua

    // Row 6: Muted/desaturated colors
    [176, 196, 222], // Light steel blue
    [144, 238, 144], // Light green
    [255, 182, 193], // Light pink
    [221, 160, 221], // Plum
    [240, 230, 140], // Khaki
    [176, 224, 230], // Powder blue
    [255, 160, 122], // Light salmon
    [175, 238, 238], // Pale turquoise

    // Row 7: Additional distinct colors
    [220, 20, 60], // Crimson
    [30, 144, 255], // Royal blue
    [34, 139, 34], // Forest green
    [255, 99, 71], // Tomato
    [138, 43, 226], // Blue violet
    [255, 215, 0], // Gold
    [64, 224, 208], // Turquoise
    [219, 112, 147], // Pale violet red
  ],

  maskCategoryDropdown: {
    minWidth: 120, // Minimum dropdown width in pixels
    fontSize: 11, // Font size in pixels
    padding: "4px 8px", // Padding
    offsetY: -30, // Vertical offset from top point (negative = above)
    overlapOffset: 25, // Horizontal offset for overlapping dropdowns
    overlapThreshold: 30, // Distance threshold to consider overlap (pixels)
  },
};
