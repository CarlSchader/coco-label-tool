/**
 * Registry for managing mode classes and their metadata.
 * Uses factory pattern to create mode instances.
 */
export class ModeRegistry {
  constructor() {
    this.modes = new Map();
  }

  register(modeId, ModeClass, metadata = {}) {
    if (!modeId || typeof modeId !== 'string') {
      throw new Error('modeId must be a non-empty string');
    }

    if (typeof ModeClass !== 'function') {
      throw new Error('ModeClass must be a constructor function');
    }

    if (this.modes.has(modeId)) {
      throw new Error(`Mode "${modeId}" is already registered`);
    }

    this.modes.set(modeId, {
      ModeClass,
      metadata,
    });
  }

  create(modeId, config = {}) {
    if (!this.has(modeId)) {
      throw new Error(`Mode "${modeId}" is not registered`);
    }

    const { ModeClass } = this.modes.get(modeId);
    return new ModeClass(config);
  }

  has(modeId) {
    return this.modes.has(modeId);
  }

  getModeInfo(modeId) {
    if (!this.has(modeId)) {
      return null;
    }

    const { metadata } = this.modes.get(modeId);
    return metadata;
  }

  getAllModes() {
    const result = [];
    for (const [id, { metadata }] of this.modes) {
      result.push({ id, ...metadata });
    }
    return result;
  }

  unregister(modeId) {
    this.modes.delete(modeId);
  }
}
