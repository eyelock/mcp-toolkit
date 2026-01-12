/**
 * Toolkit Model Storage
 *
 * Manages persistence of the domain model and toolkit state.
 * Uses a simple JSON file approach that integrates with the project.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DomainModel, EntityDefinition, ToolkitState } from "./schema.js";
import { DomainModelSchema, ToolkitStateSchema } from "./schema.js";

/** Default filename for the domain model */
export const MODEL_FILENAME = "toolkit.model.json";

/** Default filename for toolkit state */
export const STATE_FILENAME = ".toolkit-state.json";

/**
 * Storage options
 */
export interface StorageOptions {
  /** Base directory for storage (defaults to cwd) */
  baseDir?: string;
  /** Model filename (defaults to MODEL_FILENAME) */
  modelFilename?: string;
  /** State filename (defaults to STATE_FILENAME) */
  stateFilename?: string;
}

/**
 * Result type for storage operations
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Toolkit Model Storage
 *
 * Handles reading/writing the domain model and toolkit state.
 */
export class ToolkitStorage {
  private baseDir: string;
  private modelPath: string;
  private statePath: string;

  constructor(options: StorageOptions = {}) {
    this.baseDir = options.baseDir ?? process.cwd();
    this.modelPath = join(this.baseDir, options.modelFilename ?? MODEL_FILENAME);
    this.statePath = join(this.baseDir, options.stateFilename ?? STATE_FILENAME);
  }

  // ===========================================================================
  // Model Operations
  // ===========================================================================

  /**
   * Check if a model exists
   */
  hasModel(): boolean {
    return existsSync(this.modelPath);
  }

  /**
   * Load the domain model from disk
   */
  loadModel(): StorageResult<DomainModel> {
    try {
      if (!this.hasModel()) {
        return { success: false, error: "No model found" };
      }

      const content = readFileSync(this.modelPath, "utf-8");
      const data = JSON.parse(content);
      const parsed = DomainModelSchema.safeParse(data);

      if (!parsed.success) {
        return { success: false, error: `Invalid model: ${parsed.error.message}` };
      }

      return { success: true, data: parsed.data };
    } catch (error) {
      return { success: false, error: `Failed to load model: ${error}` };
    }
  }

  /**
   * Save the domain model to disk
   */
  saveModel(model: DomainModel): StorageResult<void> {
    try {
      const parsed = DomainModelSchema.safeParse(model);
      if (!parsed.success) {
        return { success: false, error: `Invalid model: ${parsed.error.message}` };
      }

      const dir = dirname(this.modelPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Update timestamps
      const now = new Date().toISOString();
      const modelWithTimestamps = {
        ...parsed.data,
        updatedAt: now,
        createdAt: parsed.data.createdAt ?? now,
      };

      writeFileSync(this.modelPath, JSON.stringify(modelWithTimestamps, null, 2));
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to save model: ${error}` };
    }
  }

  /**
   * Initialize a new model
   */
  initModel(name: string, description: string): StorageResult<DomainModel> {
    const model: DomainModel = {
      name,
      description,
      version: "1.0.0",
      entities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saveResult = this.saveModel(model);
    if (!saveResult.success) {
      return saveResult as StorageResult<DomainModel>;
    }

    return { success: true, data: model };
  }

  /**
   * Add an entity to the model
   */
  addEntity(entity: EntityDefinition): StorageResult<DomainModel> {
    const loadResult = this.loadModel();
    if (!loadResult.success || !loadResult.data) {
      return { success: false, error: loadResult.error ?? "No model loaded" };
    }

    const model = loadResult.data;

    // Check for duplicate
    if (model.entities.some((e) => e.name === entity.name)) {
      return { success: false, error: `Entity "${entity.name}" already exists` };
    }

    model.entities.push(entity);
    return this.saveModel(model).success
      ? { success: true, data: model }
      : { success: false, error: "Failed to save model" };
  }

  /**
   * Update an entity in the model
   */
  updateEntity(name: string, entity: EntityDefinition): StorageResult<DomainModel> {
    const loadResult = this.loadModel();
    if (!loadResult.success || !loadResult.data) {
      return { success: false, error: loadResult.error ?? "No model loaded" };
    }

    const model = loadResult.data;
    const index = model.entities.findIndex((e) => e.name === name);

    if (index === -1) {
      return { success: false, error: `Entity "${name}" not found` };
    }

    model.entities[index] = entity;
    return this.saveModel(model).success
      ? { success: true, data: model }
      : { success: false, error: "Failed to save model" };
  }

  /**
   * Remove an entity from the model
   */
  removeEntity(name: string): StorageResult<DomainModel> {
    const loadResult = this.loadModel();
    if (!loadResult.success || !loadResult.data) {
      return { success: false, error: loadResult.error ?? "No model loaded" };
    }

    const model = loadResult.data;
    const index = model.entities.findIndex((e) => e.name === name);

    if (index === -1) {
      return { success: false, error: `Entity "${name}" not found` };
    }

    model.entities.splice(index, 1);
    return this.saveModel(model).success
      ? { success: true, data: model }
      : { success: false, error: "Failed to save model" };
  }

  // ===========================================================================
  // State Operations
  // ===========================================================================

  /**
   * Check if state exists
   */
  hasState(): boolean {
    return existsSync(this.statePath);
  }

  /**
   * Load toolkit state from disk
   */
  loadState(): StorageResult<ToolkitState> {
    try {
      if (!this.hasState()) {
        // Return default state if none exists
        return {
          success: true,
          data: {
            phase: "design",
            generatedFiles: [],
            configuredClients: [],
          },
        };
      }

      const content = readFileSync(this.statePath, "utf-8");
      const data = JSON.parse(content);
      const parsed = ToolkitStateSchema.safeParse(data);

      if (!parsed.success) {
        return { success: false, error: `Invalid state: ${parsed.error.message}` };
      }

      return { success: true, data: parsed.data };
    } catch (error) {
      return { success: false, error: `Failed to load state: ${error}` };
    }
  }

  /**
   * Save toolkit state to disk
   */
  saveState(state: ToolkitState): StorageResult<void> {
    try {
      const parsed = ToolkitStateSchema.safeParse(state);
      if (!parsed.success) {
        return { success: false, error: `Invalid state: ${parsed.error.message}` };
      }

      const dir = dirname(this.statePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.statePath, JSON.stringify(parsed.data, null, 2));
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to save state: ${error}` };
    }
  }

  /**
   * Update toolkit state
   */
  updateState(updates: Partial<ToolkitState>): StorageResult<ToolkitState> {
    const loadResult = this.loadState();
    if (!loadResult.success || !loadResult.data) {
      return { success: false, error: loadResult.error ?? "No state loaded" };
    }

    const state = { ...loadResult.data, ...updates };
    const saveResult = this.saveState(state);

    return saveResult.success
      ? { success: true, data: state }
      : { success: false, error: "Failed to save state" };
  }

  /**
   * Clear all toolkit data
   */
  clear(): StorageResult<void> {
    try {
      if (existsSync(this.modelPath)) {
        const { unlinkSync } = require("node:fs");
        unlinkSync(this.modelPath);
      }
      if (existsSync(this.statePath)) {
        const { unlinkSync } = require("node:fs");
        unlinkSync(this.statePath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to clear: ${error}` };
    }
  }

  // ===========================================================================
  // Path Accessors
  // ===========================================================================

  getModelPath(): string {
    return this.modelPath;
  }

  getStatePath(): string {
    return this.statePath;
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

/**
 * Create a storage instance for the current directory
 */
export function createToolkitStorage(options?: StorageOptions): ToolkitStorage {
  return new ToolkitStorage(options);
}
