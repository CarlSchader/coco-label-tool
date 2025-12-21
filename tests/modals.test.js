import {
  ModalManager,
  hideAllModals,
  createWarningListItem,
  createNestedMismatchListItem,
} from "../coco_label_tool/static/js/modals.js";

class MockElement {
  constructor(id, classes = []) {
    this.id = id;
    this.classList = new MockClassList(classes);
    this.style = new Proxy(
      {},
      {
        get: (target, prop) => target[prop],
        set: (target, prop, value) => {
          target[prop] = value;
          if (prop === "cssText") {
            // Parse cssText into individual properties
            const styles = value.split(";").filter((s) => s.trim());
            styles.forEach((style) => {
              const [key, val] = style.split(":").map((s) => s.trim());
              if (key && val) target[key] = val;
            });
          }
          return true;
        },
      },
    );
    this._innerHTML = "";
    this.children = [];
    this.tagName = "DIV";
    this._textContent = "";
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this._textContent = value.replace(/<[^>]*>/g, "");
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    if (this._innerHTML) return this._innerHTML.replace(/<[^>]*>/g, "");
    return this.children.map((c) => c.textContent).join("");
  }

  set textContent(value) {
    this._textContent = value;
  }

  querySelector(selector) {
    if (selector.includes("font-weight")) {
      return this.children.find((c) => c.style["font-weight"]);
    }
    return null;
  }

  appendChild(child) {
    this.children.push(child);
  }
}

class MockClassList {
  constructor(classes = []) {
    this.classes = new Set(classes);
  }

  add(className) {
    this.classes.add(className);
  }

  remove(className) {
    this.classes.delete(className);
  }

  contains(className) {
    return this.classes.has(className);
  }
}

let mockDocument;

beforeEach(() => {
  const elements = {
    testModal: new MockElement("testModal", []),
    testContent: new MockElement("testContent", []),
    modal2: new MockElement("modal2", []),
    modal3: new MockElement("modal3", ["show"]),
  };

  mockDocument = {
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => {
      const el = new MockElement("", []);
      el.tagName = tag.toUpperCase();
      return el;
    },
  };

  global.document = mockDocument;
});

afterEach(() => {
  delete global.document;
});

describe("ModalManager", () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("constructor", () => {
    test("initializes with valid modal ID", () => {
      const modal = new ModalManager("testModal");
      expect(modal.modal).toBeDefined();
      expect(modal.modal.id).toBe("testModal");
    });

    test("logs error for invalid modal ID", () => {
      let errorLogged = false;
      console.error = () => {
        errorLogged = true;
      };

      const modal = new ModalManager("nonexistent");

      expect(modal.modal).toBeNull();
      expect(errorLogged).toBe(true);
    });

    test("stores modal element reference", () => {
      const modal = new ModalManager("testModal");
      expect(modal.modal).toBe(document.getElementById("testModal"));
    });
  });

  describe("show", () => {
    test("adds show class to modal", () => {
      const modal = new ModalManager("testModal");
      const element = document.getElementById("testModal");

      expect(element.classList.contains("show")).toBe(false);

      modal.show();

      expect(element.classList.contains("show")).toBe(true);
    });

    test("handles null modal gracefully", () => {
      const modal = new ModalManager("nonexistent");
      expect(() => modal.show()).not.toThrow();
    });

    test("does not duplicate show class", () => {
      const modal = new ModalManager("testModal");
      const element = document.getElementById("testModal");

      modal.show();
      modal.show();

      expect(element.classList.contains("show")).toBe(true);
    });
  });

  describe("hide", () => {
    test("removes show class from modal", () => {
      const modal = new ModalManager("modal3");
      const element = document.getElementById("modal3");

      expect(element.classList.contains("show")).toBe(true);

      modal.hide();

      expect(element.classList.contains("show")).toBe(false);
    });

    test("handles null modal gracefully", () => {
      const modal = new ModalManager("nonexistent");
      expect(() => modal.hide()).not.toThrow();
    });

    test("safe to call when already hidden", () => {
      const modal = new ModalManager("testModal");
      const element = document.getElementById("testModal");

      expect(element.classList.contains("show")).toBe(false);

      modal.hide();

      expect(element.classList.contains("show")).toBe(false);
    });
  });

  describe("isVisible", () => {
    test("returns true when modal has show class", () => {
      const modal = new ModalManager("modal3");
      expect(modal.isVisible()).toBe(true);
    });

    test("returns false when modal does not have show class", () => {
      const modal = new ModalManager("testModal");
      expect(modal.isVisible()).toBe(false);
    });

    test("returns falsy for null modal", () => {
      const modal = new ModalManager("nonexistent");
      expect(modal.isVisible()).toBeFalsy();
    });

    test("updates correctly after show/hide", () => {
      const modal = new ModalManager("testModal");

      expect(modal.isVisible()).toBe(false);

      modal.show();
      expect(modal.isVisible()).toBe(true);

      modal.hide();
      expect(modal.isVisible()).toBe(false);
    });
  });

  describe("setContent", () => {
    test("sets inner HTML of content element", () => {
      const modal = new ModalManager("testModal");
      const contentElement = document.getElementById("testContent");

      modal.setContent("testContent", "<p>New content</p>");

      expect(contentElement.innerHTML).toBe("<p>New content</p>");
    });

    test("handles non-existent content element gracefully", () => {
      const modal = new ModalManager("testModal");
      expect(() => modal.setContent("nonexistent", "content")).not.toThrow();
    });

    test("overwrites existing content", () => {
      const modal = new ModalManager("testModal");
      const contentElement = document.getElementById("testContent");

      modal.setContent("testContent", "First");
      expect(contentElement.innerHTML).toBe("First");

      modal.setContent("testContent", "Second");
      expect(contentElement.innerHTML).toBe("Second");
    });
  });

  describe("getContentElement", () => {
    test("returns content element by ID", () => {
      const modal = new ModalManager("testModal");
      const element = modal.getContentElement("testContent");

      expect(element).toBe(document.getElementById("testContent"));
    });

    test("returns null for non-existent element", () => {
      const modal = new ModalManager("testModal");
      const element = modal.getContentElement("nonexistent");

      expect(element).toBeNull();
    });
  });
});

describe("hideAllModals", () => {
  test("hides multiple modals", () => {
    const modal1 = new ModalManager("testModal");
    const modal2 = new ModalManager("modal2");
    const modal3 = new ModalManager("modal3");

    modal1.show();
    modal2.show();

    expect(modal1.isVisible()).toBe(true);
    expect(modal2.isVisible()).toBe(true);
    expect(modal3.isVisible()).toBe(true);

    hideAllModals(modal1, modal2, modal3);

    expect(modal1.isVisible()).toBe(false);
    expect(modal2.isVisible()).toBe(false);
    expect(modal3.isVisible()).toBe(false);
  });

  test("handles empty arguments", () => {
    expect(() => hideAllModals()).not.toThrow();
  });

  test("handles single modal", () => {
    const modal = new ModalManager("testModal");
    modal.show();

    hideAllModals(modal);

    expect(modal.isVisible()).toBe(false);
  });
});

describe("createWarningListItem", () => {
  test("creates item with annotated and missing items", () => {
    const item = createWarningListItem("Test", ["item1", "item2"], ["item3"]);

    expect(item.tagName).toBe("DIV");
    expect(item.textContent).toContain("Test");
    expect(item.textContent).toContain("item1, item2");
    expect(item.textContent).toContain("item3");
  });

  test("creates item with only annotated items", () => {
    const item = createWarningListItem("Test", ["item1"], []);

    expect(item.textContent).toContain("Test");
    expect(item.textContent).toContain("item1");
    expect(item.textContent).toContain("Annotated");
  });

  test("creates item with only missing items", () => {
    const item = createWarningListItem("Test", [], ["item1"]);

    expect(item.textContent).toContain("Test");
    expect(item.textContent).toContain("item1");
    expect(item.textContent).toContain("Missing");
  });

  test("applies custom styles", () => {
    const customStyle = {
      container: "color: red;",
      title: "font-weight: bold;",
    };
    const item = createWarningListItem("Test", ["a"], ["b"], customStyle);

    expect(item.style.color).toBe("red");
  });

  test("handles null/undefined arrays gracefully", () => {
    expect(() => createWarningListItem("Test", null, null)).not.toThrow();
    expect(() =>
      createWarningListItem("Test", undefined, undefined),
    ).not.toThrow();
  });

  test("creates proper DOM structure", () => {
    const item = createWarningListItem("Test", ["a"], ["b"]);

    expect(item.children.length).toBeGreaterThan(0);
    expect(item.querySelector('[style*="font-weight: bold"]')).toBeTruthy();
  });
});

describe("createNestedMismatchListItem", () => {
  test("creates item with mismatch data", () => {
    const mismatch = {
      inner: {
        id: 1,
        category: "wheel",
        supercategory: "part",
      },
      outer: {
        id: 2,
        category: "car",
        supercategory: "vehicle",
      },
    };

    const item = createNestedMismatchListItem(mismatch);

    expect(item.tagName).toBe("DIV");
    expect(item.textContent).toContain("wheel");
    expect(item.textContent).toContain("part");
    expect(item.textContent).toContain("car");
    expect(item.textContent).toContain("vehicle");
  });

  test("displays annotation IDs", () => {
    const mismatch = {
      inner: { id: 101, category: "a", supercategory: "b" },
      outer: { id: 202, category: "c", supercategory: "d" },
    };

    const item = createNestedMismatchListItem(mismatch);

    expect(item.textContent).toContain("101");
    expect(item.textContent).toContain("202");
  });

  test("creates proper DOM structure", () => {
    const mismatch = {
      inner: { id: 1, category: "a", supercategory: "b" },
      outer: { id: 2, category: "c", supercategory: "d" },
    };

    const item = createNestedMismatchListItem(mismatch);

    expect(item.children.length).toBe(2);
  });

  test("applies correct styling", () => {
    const mismatch = {
      inner: { id: 1, category: "a", supercategory: "b" },
      outer: { id: 2, category: "c", supercategory: "d" },
    };

    const item = createNestedMismatchListItem(mismatch);

    expect(item.style.cssText).toBeTruthy();
    expect(item.children[0].style.cssText).toBeTruthy();
    expect(item.children[1].style.cssText).toBeTruthy();
  });
});
