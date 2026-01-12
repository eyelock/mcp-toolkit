/**
 * Model Storage Tests
 */

import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolkitStorage, createToolkitStorage } from "./storage.js";
import type { EntityDefinition } from "./schema.js";

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
  });
});

describe("createToolkitStorage", () => {
  it("creates a storage instance", () => {
    const storage = createToolkitStorage({ baseDir: tmpdir() });
    expect(storage).toBeInstanceOf(ToolkitStorage);
  });
});
