/**
 * Tests for UndoManager utility class.
 */

import { jest } from "@jest/globals";
import { UndoManager } from "../../coco_label_tool/static/js/utils/undo.js";

describe("UndoManager", () => {
  let undoManager;

  beforeEach(() => {
    undoManager = new UndoManager();
  });

  describe("constructor", () => {
    test("initializes with empty stacks", () => {
      expect(undoManager.canUndo()).toBe(false);
      expect(undoManager.canRedo()).toBe(false);
    });

    test("accepts custom max history", () => {
      const manager = new UndoManager(5);
      expect(manager.maxHistory).toBe(5);
    });

    test("defaults to 50 max history", () => {
      expect(undoManager.maxHistory).toBe(50);
    });
  });

  describe("push", () => {
    test("adds command to undo stack", () => {
      const command = {
        type: "test",
        description: "Test command",
        undo: jest.fn(),
      };

      undoManager.push(command);

      expect(undoManager.canUndo()).toBe(true);
    });

    test("clears redo stack when pushing new command", async () => {
      const command1 = {
        type: "test",
        description: "Command 1",
        undo: jest.fn().mockResolvedValue(undefined),
      };
      const command2 = {
        type: "test",
        description: "Command 2",
        undo: jest.fn(),
      };

      undoManager.push(command1);
      await undoManager.undo();
      expect(undoManager.canRedo()).toBe(true);

      undoManager.push(command2);
      expect(undoManager.canRedo()).toBe(false);
    });

    test("enforces max history limit", () => {
      const manager = new UndoManager(3);

      for (let i = 0; i < 5; i++) {
        manager.push({
          type: "test",
          description: `Command ${i}`,
          undo: jest.fn(),
        });
      }

      // Should only have 3 commands (the last 3)
      let count = 0;
      while (manager.canUndo()) {
        manager.undo();
        count++;
      }
      expect(count).toBe(3);
    });

    test("calls onChange callback", () => {
      const onChange = jest.fn();
      undoManager.onChange(onChange);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn(),
      });

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("undo", () => {
    test("calls undo function on command", async () => {
      const undoFn = jest.fn().mockResolvedValue(undefined);
      const command = {
        type: "test",
        description: "Test command",
        undo: undoFn,
      };

      undoManager.push(command);
      await undoManager.undo();

      expect(undoFn).toHaveBeenCalledTimes(1);
    });

    test("moves command to redo stack", async () => {
      const command = {
        type: "test",
        description: "Test command",
        undo: jest.fn().mockResolvedValue(undefined),
      };

      undoManager.push(command);
      expect(undoManager.canRedo()).toBe(false);

      await undoManager.undo();

      expect(undoManager.canUndo()).toBe(false);
      expect(undoManager.canRedo()).toBe(true);
    });

    test("returns false if nothing to undo", async () => {
      const result = await undoManager.undo();
      expect(result).toBe(false);
    });

    test("returns true on successful undo", async () => {
      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn().mockResolvedValue(undefined),
      });

      const result = await undoManager.undo();
      expect(result).toBe(true);
    });

    test("handles async undo functions", async () => {
      let value = 0;
      const command = {
        type: "test",
        description: "Async test",
        undo: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          value = 42;
        },
      };

      undoManager.push(command);
      await undoManager.undo();

      expect(value).toBe(42);
    });

    test("calls onChange callback", async () => {
      const onChange = jest.fn();
      undoManager.onChange(onChange);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn().mockResolvedValue(undefined),
      });
      onChange.mockClear();

      await undoManager.undo();

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    test("handles undo errors gracefully", async () => {
      const command = {
        type: "test",
        description: "Error test",
        undo: jest.fn().mockRejectedValue(new Error("Undo failed")),
      };

      undoManager.push(command);

      // Should not throw, but return false
      const result = await undoManager.undo();
      expect(result).toBe(false);
    });
  });

  describe("redo", () => {
    test("calls redo function on command", async () => {
      const redoFn = jest.fn().mockResolvedValue(undefined);
      const command = {
        type: "test",
        description: "Test command",
        undo: jest.fn().mockResolvedValue(undefined),
        redo: redoFn,
      };

      undoManager.push(command);
      await undoManager.undo();
      await undoManager.redo();

      expect(redoFn).toHaveBeenCalledTimes(1);
    });

    test("moves command back to undo stack", async () => {
      const command = {
        type: "test",
        description: "Test command",
        undo: jest.fn().mockResolvedValue(undefined),
        redo: jest.fn().mockResolvedValue(undefined),
      };

      undoManager.push(command);
      await undoManager.undo();
      await undoManager.redo();

      expect(undoManager.canUndo()).toBe(true);
      expect(undoManager.canRedo()).toBe(false);
    });

    test("returns false if nothing to redo", async () => {
      const result = await undoManager.redo();
      expect(result).toBe(false);
    });

    test("returns true on successful redo", async () => {
      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn().mockResolvedValue(undefined),
        redo: jest.fn().mockResolvedValue(undefined),
      });
      await undoManager.undo();

      const result = await undoManager.redo();
      expect(result).toBe(true);
    });

    test("calls onChange callback", async () => {
      const onChange = jest.fn();
      undoManager.onChange(onChange);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn().mockResolvedValue(undefined),
        redo: jest.fn().mockResolvedValue(undefined),
      });
      await undoManager.undo();
      onChange.mockClear();

      await undoManager.redo();

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    test("handles redo errors gracefully", async () => {
      const command = {
        type: "test",
        description: "Error test",
        undo: jest.fn().mockResolvedValue(undefined),
        redo: jest.fn().mockRejectedValue(new Error("Redo failed")),
      };

      undoManager.push(command);
      await undoManager.undo();

      const result = await undoManager.redo();
      expect(result).toBe(false);
    });

    test("works without explicit redo function (re-executes nothing)", async () => {
      const command = {
        type: "test",
        description: "No redo function",
        undo: jest.fn().mockResolvedValue(undefined),
        // No redo function provided
      };

      undoManager.push(command);
      await undoManager.undo();

      // Should succeed even without redo function
      const result = await undoManager.redo();
      expect(result).toBe(true);
      expect(undoManager.canUndo()).toBe(true);
    });
  });

  describe("canUndo / canRedo", () => {
    test("canUndo returns false when stack is empty", () => {
      expect(undoManager.canUndo()).toBe(false);
    });

    test("canUndo returns true when stack has commands", () => {
      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn(),
      });
      expect(undoManager.canUndo()).toBe(true);
    });

    test("canRedo returns false when stack is empty", () => {
      expect(undoManager.canRedo()).toBe(false);
    });

    test("canRedo returns true after undo", async () => {
      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn().mockResolvedValue(undefined),
      });
      await undoManager.undo();
      expect(undoManager.canRedo()).toBe(true);
    });
  });

  describe("getUndoDescription / getRedoDescription", () => {
    test("getUndoDescription returns null when stack is empty", () => {
      expect(undoManager.getUndoDescription()).toBeNull();
    });

    test("getUndoDescription returns description of top command", () => {
      undoManager.push({
        type: "test",
        description: "First command",
        undo: jest.fn(),
      });
      undoManager.push({
        type: "test",
        description: "Second command",
        undo: jest.fn(),
      });

      expect(undoManager.getUndoDescription()).toBe("Second command");
    });

    test("getRedoDescription returns null when stack is empty", () => {
      expect(undoManager.getRedoDescription()).toBeNull();
    });

    test("getRedoDescription returns description of top command", async () => {
      undoManager.push({
        type: "test",
        description: "Test command",
        undo: jest.fn().mockResolvedValue(undefined),
      });
      await undoManager.undo();

      expect(undoManager.getRedoDescription()).toBe("Test command");
    });
  });

  describe("clear", () => {
    test("clears both undo and redo stacks", async () => {
      undoManager.push({
        type: "test",
        description: "Command 1",
        undo: jest.fn().mockResolvedValue(undefined),
      });
      undoManager.push({
        type: "test",
        description: "Command 2",
        undo: jest.fn().mockResolvedValue(undefined),
      });
      await undoManager.undo();

      expect(undoManager.canUndo()).toBe(true);
      expect(undoManager.canRedo()).toBe(true);

      undoManager.clear();

      expect(undoManager.canUndo()).toBe(false);
      expect(undoManager.canRedo()).toBe(false);
    });

    test("calls onChange callback", () => {
      const onChange = jest.fn();
      undoManager.onChange(onChange);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn(),
      });
      onChange.mockClear();

      undoManager.clear();

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("onChange", () => {
    test("registers callback", () => {
      const callback = jest.fn();
      undoManager.onChange(callback);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn(),
      });

      expect(callback).toHaveBeenCalled();
    });

    test("replaces previous callback", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      undoManager.onChange(callback1);
      undoManager.onChange(callback2);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn(),
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    test("can clear callback by passing null", () => {
      const callback = jest.fn();
      undoManager.onChange(callback);
      undoManager.onChange(null);

      undoManager.push({
        type: "test",
        description: "Test",
        undo: jest.fn(),
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("multiple undo/redo operations", () => {
    test("undo/redo sequence works correctly", async () => {
      const values = [];

      const command1 = {
        type: "test",
        description: "Add 1",
        undo: async () => values.pop(),
        redo: async () => values.push(1),
      };
      const command2 = {
        type: "test",
        description: "Add 2",
        undo: async () => values.pop(),
        redo: async () => values.push(2),
      };
      const command3 = {
        type: "test",
        description: "Add 3",
        undo: async () => values.pop(),
        redo: async () => values.push(3),
      };

      // Simulate initial state after commands executed
      values.push(1, 2, 3);

      undoManager.push(command1);
      undoManager.push(command2);
      undoManager.push(command3);

      // Undo all three
      await undoManager.undo(); // removes 3
      expect(values).toEqual([1, 2]);

      await undoManager.undo(); // removes 2
      expect(values).toEqual([1]);

      await undoManager.undo(); // removes 1
      expect(values).toEqual([]);

      // Redo two
      await undoManager.redo(); // adds 1
      expect(values).toEqual([1]);

      await undoManager.redo(); // adds 2
      expect(values).toEqual([1, 2]);

      // Push new command (should clear redo for command3)
      const command4 = {
        type: "test",
        description: "Add 4",
        undo: async () => values.pop(),
        redo: async () => values.push(4),
      };
      values.push(4);
      undoManager.push(command4);

      expect(undoManager.canRedo()).toBe(false);
      expect(values).toEqual([1, 2, 4]);
    });
  });
});
