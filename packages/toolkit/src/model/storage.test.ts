/**
 * Model Storage Tests
 */

import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EntityDefinition } from "./schema.js";
import { ToolkitStorage, createToolkitStorage } from "./storage.js";

describe("ToolkitStorage", () => {
  let testDir: string;
  let storage: ToolkitStorage;

  beforeEach(() => {
    // Create a unique test directory
    testDir = join(tmpdir(), `toolkit-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    storage = new ToolkitStorage({ baseDir: testDir });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Model Operations", () => {
    it("reports no model when none exists", () => {
      expect(storage.hasModel()).toBe(false);
    });

    it("initializes a new model", () => {
      const result = storage.initModel("test-model", "A test model");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe("test-model");
      expect(result.data?.description).toBe("A test model");
      expect(result.data?.entities).toEqual([]);
      expect(storage.hasModel()).toBe(true);
    });

    it("creates model directory if it does not exist", () => {
      // Create storage pointing to a nested directory that doesn't exist
      const nestedDir = join(testDir, "nested", "deep", "model");
      const nestedStorage = new ToolkitStorage({ baseDir: nestedDir });

      const result = nestedStorage.initModel("nested-model", "A nested model");

      expect(result.success).toBe(true);
      expect(existsSync(nestedDir)).toBe(true);
    });

    it("loads an existing model", () => {
      storage.initModel("test-model", "A test model");

      const result = storage.loadModel();

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("test-model");
    });

    it("adds an entity to the model", () => {
      storage.initModel("test-model", "A test model");

      const entity: EntityDefinition = {
        name: "User",
        description: "A user entity",
        properties: [
          { name: "id", type: "uuid", required: true, unique: true },
          { name: "email", type: "email", required: true, unique: true },
        ],
        relationships: [],
        tags: [],
      };

      const result = storage.addEntity(entity);

      expect(result.success).toBe(true);
      expect(result.data?.entities).toHaveLength(1);
      expect(result.data?.entities[0].name).toBe("User");
    });

    it("rejects duplicate entity names", () => {
      storage.initModel("test-model", "A test model");

      const entity: EntityDefinition = {
        name: "User",
        description: "A user entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      storage.addEntity(entity);
      const result = storage.addEntity(entity);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("updates an existing entity", () => {
      storage.initModel("test-model", "A test model");

      const entity: EntityDefinition = {
        name: "User",
        description: "A user entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      storage.addEntity(entity);

      const updatedEntity: EntityDefinition = {
        name: "User",
        description: "An updated user entity",
        properties: [
          { name: "id", type: "uuid", required: true, unique: true },
          { name: "name", type: "string", required: true, unique: false },
        ],
        relationships: [],
        tags: [],
      };

      const result = storage.updateEntity("User", updatedEntity);

      expect(result.success).toBe(true);
      expect(result.data?.entities[0].description).toBe("An updated user entity");
      expect(result.data?.entities[0].properties).toHaveLength(2);
    });

    it("fails to update entity when save fails", () => {
      storage.initModel("test-model", "A test model");

      const entity: EntityDefinition = {
        name: "User",
        description: "A user entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      storage.addEntity(entity);

      // Make the model file read-only to cause save to fail
      chmodSync(storage.getModelPath(), 0o444);

      const updatedEntity: EntityDefinition = {
        name: "User",
        description: "Updated",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      const result = storage.updateEntity("User", updatedEntity);

      // Restore permissions for cleanup
      chmodSync(storage.getModelPath(), 0o644);

      expect(result.success).toBe(false);
    });

    it("removes an entity from the model", () => {
      storage.initModel("test-model", "A test model");

      const entity: EntityDefinition = {
        name: "User",
        description: "A user entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      storage.addEntity(entity);
      expect(storage.loadModel().data?.entities).toHaveLength(1);

      const result = storage.removeEntity("User");

      expect(result.success).toBe(true);
      expect(result.data?.entities).toHaveLength(0);
    });

    it("fails to remove non-existent entity", () => {
      storage.initModel("test-model", "A test model");

      const result = storage.removeEntity("NonExistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails to remove entity when save fails", () => {
      storage.initModel("test-model", "A test model");

      const entity: EntityDefinition = {
        name: "User",
        description: "A user entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      storage.addEntity(entity);

      // Make the model file read-only to cause save to fail
      chmodSync(storage.getModelPath(), 0o444);

      const result = storage.removeEntity("User");

      // Restore permissions for cleanup
      chmodSync(storage.getModelPath(), 0o644);

      expect(result.success).toBe(false);
    });

    it("fails to load invalid model JSON", () => {
      writeFileSync(storage.getModelPath(), "not valid json");

      const result = storage.loadModel();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to load model");
    });

    it("fails to load model with invalid schema", () => {
      writeFileSync(storage.getModelPath(), JSON.stringify({ invalid: "schema" }));

      const result = storage.loadModel();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid model");
    });

    it("fails to add entity when no model exists", () => {
      const entity: EntityDefinition = {
        name: "Test",
        description: "Test",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      const result = storage.addEntity(entity);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No model");
    });

    it("fails to update entity when no model exists", () => {
      const entity: EntityDefinition = {
        name: "Test",
        description: "Test",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      const result = storage.updateEntity("Test", entity);

      expect(result.success).toBe(false);
    });

    it("fails to remove entity when no model exists", () => {
      const result = storage.removeEntity("Test");

      expect(result.success).toBe(false);
    });
  });

  describe("State Operations", () => {
    it("returns default state when none exists", () => {
      const result = storage.loadState();

      expect(result.success).toBe(true);
      expect(result.data?.phase).toBe("design");
      expect(result.data?.generatedFiles).toEqual([]);
    });

    it("saves and loads state", () => {
      storage.saveState({
        phase: "generate",
        generatedFiles: ["file1.ts", "file2.ts"],
        configuredClients: ["claude-desktop"],
      });

      const result = storage.loadState();

      expect(result.success).toBe(true);
      expect(result.data?.phase).toBe("generate");
      expect(result.data?.generatedFiles).toEqual(["file1.ts", "file2.ts"]);
      expect(result.data?.configuredClients).toEqual(["claude-desktop"]);
    });

    it("updates state partially", () => {
      storage.saveState({
        phase: "design",
        generatedFiles: [],
        configuredClients: [],
      });

      storage.updateState({ phase: "generate" });

      const result = storage.loadState();

      expect(result.success).toBe(true);
      expect(result.data?.phase).toBe("generate");
    });

    it("fails to load invalid state JSON", () => {
      writeFileSync(storage.getStatePath(), "not valid json");

      const result = storage.loadState();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to load state");
    });

    it("fails to load state with invalid schema", () => {
      // phase must be one of: design, generate, setup, complete
      writeFileSync(storage.getStatePath(), JSON.stringify({ phase: "invalid-phase" }));

      const result = storage.loadState();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid state");
    });

    it("fails to save invalid state", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input handling
      const result = storage.saveState({ phase: "invalid-phase" as any } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid state");
    });

    it("returns updateState result with data on success", () => {
      storage.saveState({
        phase: "design",
        generatedFiles: [],
        configuredClients: [],
      });

      const result = storage.updateState({ phase: "generate" });

      expect(result.success).toBe(true);
      expect(result.data?.phase).toBe("generate");
    });

    it("creates state directory if it does not exist", () => {
      // Create storage pointing to a nested directory that doesn't exist
      const nestedDir = join(testDir, "nested", "deep", "state");
      const nestedStorage = new ToolkitStorage({ baseDir: nestedDir });

      const result = nestedStorage.saveState({
        phase: "design",
        generatedFiles: [],
        configuredClients: [],
      });

      expect(result.success).toBe(true);
      expect(existsSync(nestedDir)).toBe(true);
    });

    it("fails to updateState when loadState fails", () => {
      // Write invalid state JSON to make loadState fail
      writeFileSync(storage.getStatePath(), "invalid json");

      const result = storage.updateState({ phase: "generate" });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("fails to updateState when saveState fails", () => {
      // First create valid state
      storage.saveState({
        phase: "design",
        generatedFiles: [],
        configuredClients: [],
      });

      // Make the state file read-only to cause save to fail
      chmodSync(storage.getStatePath(), 0o444);

      const result = storage.updateState({ phase: "generate" });

      // Restore permissions for cleanup
      chmodSync(storage.getStatePath(), 0o644);

      expect(result.success).toBe(false);
    });
  });

  describe("Path Accessors", () => {
    it("returns correct paths", () => {
      expect(storage.getBaseDir()).toBe(testDir);
      expect(storage.getModelPath()).toContain("toolkit.model.json");
      expect(storage.getStatePath()).toContain(".toolkit-state.json");
    });
  });

  describe("Clear", () => {
    it("clears all data", () => {
      storage.initModel("test-model", "A test model");
      storage.saveState({ phase: "complete", generatedFiles: [], configuredClients: [] });

      expect(storage.hasModel()).toBe(true);
      expect(storage.hasState()).toBe(true);

      storage.clear();

      expect(storage.hasModel()).toBe(false);
      expect(storage.hasState()).toBe(false);
    });

    it("handles clear error gracefully", () => {
      storage.initModel("test-model", "A test model");

      // Make the model file read-only and directory read-only to cause unlink to fail
      chmodSync(storage.getModelPath(), 0o444);
      chmodSync(testDir, 0o555);

      const result = storage.clear();

      // Restore permissions for cleanup
      chmodSync(testDir, 0o755);
      chmodSync(storage.getModelPath(), 0o644);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to clear");
    });
  });
});

describe("createToolkitStorage", () => {
  it("creates a storage instance", () => {
    const storage = createToolkitStorage({ baseDir: tmpdir() });
    expect(storage).toBeInstanceOf(ToolkitStorage);
  });
});
