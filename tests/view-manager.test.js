/**
 * Tests for view-manager.js - URL-based view switching
 */

import {
  ViewType,
  getCurrentView,
  getViewParams,
  parseUrlParams,
  buildUrl,
} from "../coco_label_tool/static/js/utils/view-manager.js";

describe("ViewType", () => {
  test("has EDITOR value", () => {
    expect(ViewType.EDITOR).toBe("editor");
  });

  test("has GALLERY value", () => {
    expect(ViewType.GALLERY).toBe("gallery");
  });
});

describe("parseUrlParams", () => {
  test("parses empty search string", () => {
    const params = parseUrlParams("");
    expect(params).toEqual({});
  });

  test("parses single param", () => {
    const params = parseUrlParams("?view=gallery");
    expect(params).toEqual({ view: "gallery" });
  });

  test("parses multiple params", () => {
    const params = parseUrlParams("?view=gallery&page=2&filter=annotated");
    expect(params).toEqual({
      view: "gallery",
      page: "2",
      filter: "annotated",
    });
  });

  test("handles params without question mark", () => {
    const params = parseUrlParams("view=editor&index=5");
    expect(params).toEqual({ view: "editor", index: "5" });
  });

  test("handles empty param values", () => {
    const params = parseUrlParams("?view=&filter=all");
    expect(params).toEqual({ view: "", filter: "all" });
  });

  test("handles special characters in values", () => {
    const params = parseUrlParams("?filter=all&sort=annotations_desc");
    expect(params).toEqual({ filter: "all", sort: "annotations_desc" });
  });
});

describe("getCurrentView", () => {
  test("returns GALLERY when no view param (default)", () => {
    const view = getCurrentView({});
    expect(view).toBe(ViewType.GALLERY);
  });

  test("returns EDITOR when view=editor", () => {
    const view = getCurrentView({ view: "editor" });
    expect(view).toBe(ViewType.EDITOR);
  });

  test("returns GALLERY when view=gallery", () => {
    const view = getCurrentView({ view: "gallery" });
    expect(view).toBe(ViewType.GALLERY);
  });

  test("returns GALLERY for unknown view value (default)", () => {
    const view = getCurrentView({ view: "unknown" });
    expect(view).toBe(ViewType.GALLERY);
  });

  test("returns GALLERY for empty view value (default)", () => {
    const view = getCurrentView({ view: "" });
    expect(view).toBe(ViewType.GALLERY);
  });
});

describe("getViewParams", () => {
  test("returns empty object for editor view with no params", () => {
    const params = getViewParams({ view: "editor" });
    expect(params).toEqual({});
  });

  test("returns index for editor view", () => {
    const params = getViewParams({ view: "editor", index: "5" });
    expect(params).toEqual({ index: "5" });
  });

  test("returns gallery params", () => {
    const params = getViewParams({
      view: "gallery",
      page: "2",
      filter: "annotated",
      sort: "filename",
    });
    expect(params).toEqual({
      page: "2",
      filter: "annotated",
      sort: "filename",
    });
  });

  test("excludes view param from result", () => {
    const params = getViewParams({ view: "gallery", page: "0" });
    expect(params.view).toBeUndefined();
    expect(params.page).toBe("0");
  });

  test("excludes unrelated params", () => {
    const params = getViewParams({
      view: "editor",
      index: "3",
      unrelated: "value",
    });
    expect(params).toEqual({ index: "3" });
  });
});

describe("buildUrl", () => {
  test("builds editor URL with no params", () => {
    const url = buildUrl(ViewType.EDITOR, {});
    expect(url).toBe("/?view=editor");
  });

  test("builds editor URL with index", () => {
    const url = buildUrl(ViewType.EDITOR, { index: 5 });
    expect(url).toBe("/?view=editor&index=5");
  });

  test("builds gallery URL with no params", () => {
    const url = buildUrl(ViewType.GALLERY, {});
    expect(url).toBe("/?view=gallery");
  });

  test("builds gallery URL with all params", () => {
    const url = buildUrl(ViewType.GALLERY, {
      page: 2,
      filter: "annotated",
      sort: "filename",
    });
    expect(url).toBe("/?view=gallery&page=2&filter=annotated&sort=filename");
  });

  test("omits undefined params", () => {
    const url = buildUrl(ViewType.GALLERY, {
      page: 0,
      filter: undefined,
      sort: "index",
    });
    expect(url).toBe("/?view=gallery&page=0&sort=index");
  });

  test("omits null params", () => {
    const url = buildUrl(ViewType.GALLERY, {
      page: 1,
      filter: null,
    });
    expect(url).toBe("/?view=gallery&page=1");
  });

  test("handles zero values correctly", () => {
    const url = buildUrl(ViewType.GALLERY, { page: 0 });
    expect(url).toBe("/?view=gallery&page=0");
  });

  test("handles empty string params", () => {
    const url = buildUrl(ViewType.EDITOR, { index: "" });
    // Empty strings should be included
    expect(url).toBe("/?view=editor&index=");
  });
});

describe("URL round-trip", () => {
  test("editor with index survives round-trip", () => {
    const originalParams = { view: "editor", index: "42" };
    const view = getCurrentView(originalParams);
    const viewParams = getViewParams(originalParams);
    const url = buildUrl(view, viewParams);

    expect(url).toBe("/?view=editor&index=42");
  });

  test("gallery with all params survives round-trip", () => {
    const originalParams = {
      view: "gallery",
      page: "3",
      filter: "unannotated",
      sort: "annotations_desc",
    };
    const view = getCurrentView(originalParams);
    const viewParams = getViewParams(originalParams);
    const url = buildUrl(view, viewParams);

    expect(url).toBe(
      "/?view=gallery&page=3&filter=unannotated&sort=annotations_desc",
    );
  });
});
