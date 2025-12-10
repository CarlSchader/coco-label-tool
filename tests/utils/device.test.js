import {
  isTouchDevice,
  isSmallScreen,
  isMobileDevice,
  getTouchConfig,
} from "../../static/js/utils/device.js";

describe("isTouchDevice", () => {
  let originalWindow;
  let originalNavigator;

  beforeEach(() => {
    originalWindow = global.window;
    originalNavigator = global.navigator;

    global.window = {
      matchMedia: () => ({ matches: false }),
    };
    global.navigator = {
      maxTouchPoints: 0,
    };
  });

  afterEach(() => {
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  test("returns true when ontouchstart exists", () => {
    global.window.ontouchstart = null;
    expect(isTouchDevice()).toBe(true);
  });

  test("returns true when maxTouchPoints > 0", () => {
    global.navigator.maxTouchPoints = 1;
    expect(isTouchDevice()).toBe(true);
  });

  test("returns false when neither condition is met", () => {
    expect(isTouchDevice()).toBe(false);
  });

  test("returns true when both conditions are met", () => {
    global.window.ontouchstart = null;
    global.navigator.maxTouchPoints = 5;
    expect(isTouchDevice()).toBe(true);
  });
});

describe("isSmallScreen", () => {
  let originalWindow;

  beforeEach(() => {
    originalWindow = global.window;
    global.window = {};
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  test("returns true when width <= 768px", () => {
    global.window.matchMedia = (query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    expect(isSmallScreen()).toBe(true);
  });

  test("returns false when width > 768px", () => {
    global.window.matchMedia = () => ({
      matches: false,
      media: "",
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    expect(isSmallScreen()).toBe(false);
  });
});

describe("isMobileDevice", () => {
  let originalWindow;
  let originalNavigator;

  beforeEach(() => {
    originalWindow = global.window;
    originalNavigator = global.navigator;

    global.window = {
      matchMedia: () => ({ matches: false }),
    };
    global.navigator = {
      maxTouchPoints: 0,
    };
  });

  afterEach(() => {
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  test("returns true when touch device AND small screen", () => {
    global.window.ontouchstart = null;
    global.window.matchMedia = (query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
    });

    expect(isMobileDevice()).toBe(true);
  });

  test("returns false when touch device but NOT small screen", () => {
    global.window.ontouchstart = null;
    global.window.matchMedia = () => ({
      matches: false,
      media: "",
    });

    expect(isMobileDevice()).toBe(false);
  });

  test("returns false when small screen but NOT touch device", () => {
    global.window.matchMedia = (query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
    });

    expect(isMobileDevice()).toBe(false);
  });

  test("returns false when neither touch device nor small screen", () => {
    expect(isMobileDevice()).toBe(false);
  });
});

describe("getTouchConfig", () => {
  let originalWindow;
  let originalNavigator;

  beforeEach(() => {
    originalWindow = global.window;
    originalNavigator = global.navigator;

    global.window = {
      matchMedia: () => ({ matches: false }),
    };
    global.navigator = {
      maxTouchPoints: 0,
    };
  });

  afterEach(() => {
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  test("returns touch-friendly values on touch device", () => {
    global.window.ontouchstart = null;
    const config = getTouchConfig();

    expect(config.pointRadius).toBe(12);
    expect(config.pointHoverRadius).toBe(16);
    expect(config.hoverHitArea).toBe(24);
    expect(config.edgeThreshold).toBe(20);
    expect(config.cornerThreshold).toBe(28);
    expect(config.deleteButtonSize).toBe(32);
  });

  test("returns desktop values on non-touch device", () => {
    const config = getTouchConfig();

    expect(config.pointRadius).toBe(5);
    expect(config.pointHoverRadius).toBe(8);
    expect(config.hoverHitArea).toBe(12);
    expect(config.edgeThreshold).toBe(8);
    expect(config.cornerThreshold).toBe(12);
    expect(config.deleteButtonSize).toBe(20);
  });

  test("all touch values are larger than desktop values", () => {
    const desktopConfig = getTouchConfig();

    global.window.ontouchstart = null;
    const touchConfig = getTouchConfig();

    expect(touchConfig.pointRadius).toBeGreaterThan(desktopConfig.pointRadius);
    expect(touchConfig.pointHoverRadius).toBeGreaterThan(
      desktopConfig.pointHoverRadius,
    );
    expect(touchConfig.hoverHitArea).toBeGreaterThan(
      desktopConfig.hoverHitArea,
    );
    expect(touchConfig.edgeThreshold).toBeGreaterThan(
      desktopConfig.edgeThreshold,
    );
    expect(touchConfig.cornerThreshold).toBeGreaterThan(
      desktopConfig.cornerThreshold,
    );
    expect(touchConfig.deleteButtonSize).toBeGreaterThan(
      desktopConfig.deleteButtonSize,
    );
  });

  test("returns object with all required properties", () => {
    const config = getTouchConfig();

    expect(config).toHaveProperty("pointRadius");
    expect(config).toHaveProperty("pointHoverRadius");
    expect(config).toHaveProperty("hoverHitArea");
    expect(config).toHaveProperty("edgeThreshold");
    expect(config).toHaveProperty("cornerThreshold");
    expect(config).toHaveProperty("deleteButtonSize");
  });

  test("all values are positive numbers", () => {
    const config = getTouchConfig();

    expect(config.pointRadius).toBeGreaterThan(0);
    expect(config.pointHoverRadius).toBeGreaterThan(0);
    expect(config.hoverHitArea).toBeGreaterThan(0);
    expect(config.edgeThreshold).toBeGreaterThan(0);
    expect(config.cornerThreshold).toBeGreaterThan(0);
    expect(config.deleteButtonSize).toBeGreaterThan(0);
  });
});
