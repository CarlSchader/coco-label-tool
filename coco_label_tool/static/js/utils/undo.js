/**
 * Undo/Redo manager using command pattern.
 * Supports sync and async commands.
 *
 * Command interface:
 * {
 *   type: string,           // e.g., "save-annotation"
 *   description: string,    // e.g., "Save annotation"
 *   undo: async () => void, // Reverse the action
 *   redo?: async () => void // Re-apply (optional, no-op if not provided)
 * }
 */
export class UndoManager {
  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.changeCallback = null;
  }

  /**
   * Push a command onto the undo stack.
   * Clears the redo stack since we're starting a new branch.
   * Enforces max history limit by removing oldest commands.
   */
  push(command) {
    this.undoStack.push(command);
    this.redoStack = [];

    // Enforce max history limit
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notifyChange();
  }

  /**
   * Undo the most recent command.
   * Calls the command's undo function and moves it to the redo stack.
   * @returns {Promise<boolean>} true if undo succeeded, false if nothing to undo or error
   */
  async undo() {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.undoStack.pop();

    try {
      await command.undo();
      this.redoStack.push(command);
      this.notifyChange();
      return true;
    } catch (error) {
      console.error("Undo failed:", error);
      // Don't push to redo stack on failure
      return false;
    }
  }

  /**
   * Redo the most recently undone command.
   * Calls the command's redo function (if provided) and moves it back to undo stack.
   * @returns {Promise<boolean>} true if redo succeeded, false if nothing to redo or error
   */
  async redo() {
    if (!this.canRedo()) {
      return false;
    }

    const command = this.redoStack.pop();

    try {
      if (command.redo) {
        await command.redo();
      }
      this.undoStack.push(command);
      this.notifyChange();
      return true;
    } catch (error) {
      console.error("Redo failed:", error);
      // Don't push back to undo stack on failure
      return false;
    }
  }

  /**
   * Check if there are commands to undo.
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if there are commands to redo.
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next command to undo.
   * @returns {string|null} Description or null if nothing to undo
   */
  getUndoDescription() {
    if (!this.canUndo()) {
      return null;
    }
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the next command to redo.
   * @returns {string|null} Description or null if nothing to redo
   */
  getRedoDescription() {
    if (!this.canRedo()) {
      return null;
    }
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Clear both undo and redo stacks.
   * Useful when changing context (e.g., switching images).
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  /**
   * Register a callback to be called when stacks change.
   * Used for updating UI (enable/disable buttons).
   * @param {Function|null} callback - Called with no arguments when state changes
   */
  onChange(callback) {
    this.changeCallback = callback;
  }

  /**
   * Internal: notify the change callback if registered.
   */
  notifyChange() {
    if (this.changeCallback) {
      this.changeCallback();
    }
  }
}
