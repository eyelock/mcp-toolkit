/**
 * Model Design Tool Tests
 */

import { mkdirSync, rmSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleModelDesign, modelDesignTool } from "./model-design.js";
import type { EntityDefinition } from "../model/index.js";

// Mock the storage to use a test directory
let testDir: string;

vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");

  return {
    ...actual,
    createToolkitStorage: () => {
      testDir = testDir || join(tmpdir(), `toolkit-design-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      return new actual.ToolkitStorage({ baseDir: testDir });
    },
  };
});

describe("modelDesignTool", () => {
  it("has correct tool definition", () => {
    expect(modelDesignTool.name).toBe("toolkit:model:design");
    expect(modelDesignTool.description).toContain("Design a domain model");
    expect(modelDesignTool.inputSchema).toBeDefined();
  });
});

describe("handleModelDesign", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-design-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const sampleEntity: EntityDefinition = {
    name: "User",
    description: "A user in the system",
    properties: [
      { name: "id", type: "uuid", required: true, unique: true },
      { name: "email", type: "email", required: true, unique: true, description: "User email" },
      { name: "name", type: "string", required: false, unique: false },
    ],
    relationships: [{ target: "Profile", type: "one-to-one", description: "User profile" }],
    tags: ["core"],
  };

  describe("start action", () => {
    it("rejects missing name", async () => {
      const result = await handleModelDesign({ action: "start" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("provide");
    });

    it("rejects missing description", async () => {
      const result = await handleModelDesign({ action: "start", name: "test-model" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("provide");
    });

    it("creates a new model successfully", async () => {
      const result = await handleModelDesign(
        { action: "start", name: "my-model", description: "My test model" },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Created new model");
      expect(result.content[0].text).toContain("my-model");
      expect(result.content[0].text).toContain("Next steps");
    });

    it("rejects when model already exists", async () => {
      // Create first model
      await handleModelDesign(
        { action: "start", name: "existing-model", description: "First model" },
        {}
      );

      // Try to create another
      const result = await handleModelDesign(
        { action: "start", name: "another-model", description: "Second model" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already exists");
    });

    it("handles initModel failure", async () => {
      // Make the test directory read-only to cause initModel to fail
      chmodSync(testDir, 0o555);

      const result = await handleModelDesign(
        { action: "start", name: "fail-model", description: "Should fail" },
        {}
      );

      // Restore permissions for cleanup
      chmodSync(testDir, 0o755);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to create model");
    });
  });

  describe("show action", () => {
    it("reports no model when none exists", async () => {
      const result = await handleModelDesign({ action: "show" }, {});

      expect(result.content[0].text).toContain("No model found");
    });

    it("shows model with no entities", async () => {
      await handleModelDesign(
        { action: "start", name: "empty-model", description: "An empty model" },
        {}
      );

      const result = await handleModelDesign({ action: "show" }, {});

      expect(result.content[0].text).toContain("empty-model");
      expect(result.content[0].text).toContain("No entities defined");
    });

    it("shows model with entities", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );
      await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      const result = await handleModelDesign({ action: "show" }, {});

      expect(result.content[0].text).toContain("test-model");
      expect(result.content[0].text).toContain("User");
      expect(result.content[0].text).toContain("1 Entities");
      expect(result.content[0].text).toContain("Properties");
    });
  });

  describe("add-entity action", () => {
    it("rejects missing entity", async () => {
      const result = await handleModelDesign({ action: "add-entity" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("entity");
    });

    it("adds entity successfully", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const result = await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Added entity");
      expect(result.content[0].text).toContain("User");
      expect(result.content[0].text).toContain("1 entities");
    });

    it("formats entity with properties and relationships", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const result = await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      // Check property formatting
      expect(result.content[0].text).toContain("id");
      expect(result.content[0].text).toContain("uuid");
      expect(result.content[0].text).toContain("`email`"); // required property (no ?)
      expect(result.content[0].text).toContain("`name?`"); // optional property marked with ?

      // Check relationship formatting
      expect(result.content[0].text).toContain("Relationships");
      expect(result.content[0].text).toContain("Profile");
      expect(result.content[0].text).toContain("one-to-one");
    });

    it("fails when no model exists", async () => {
      const result = await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to add entity");
    });

    it("fails when adding duplicate entity", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );
      await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      const result = await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already exists");
    });
  });

  describe("update-entity action", () => {
    it("rejects missing name", async () => {
      const result = await handleModelDesign({ action: "update-entity" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("name");
    });

    it("rejects missing entity definition", async () => {
      const result = await handleModelDesign({ action: "update-entity", name: "User" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("entity");
    });

    it("updates entity successfully", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );
      await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      const updatedEntity: EntityDefinition = {
        ...sampleEntity,
        description: "Updated user description",
        properties: [
          ...sampleEntity.properties,
          { name: "phone", type: "string", required: false, unique: false },
        ],
      };

      const result = await handleModelDesign(
        { action: "update-entity", name: "User", entity: updatedEntity },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Updated entity");
      expect(result.content[0].text).toContain("User");
    });

    it("fails when entity doesn't exist", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const result = await handleModelDesign(
        { action: "update-entity", name: "NonExistent", entity: sampleEntity },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to update");
    });
  });

  describe("remove-entity action", () => {
    it("rejects missing name", async () => {
      const result = await handleModelDesign({ action: "remove-entity" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("name");
    });

    it("removes entity successfully", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );
      await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      const result = await handleModelDesign({ action: "remove-entity", name: "User" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Removed entity");
      expect(result.content[0].text).toContain("User");
      expect(result.content[0].text).toContain("0 entities");
    });

    it("fails when entity doesn't exist", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const result = await handleModelDesign({ action: "remove-entity", name: "NonExistent" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to remove");
    });
  });

  describe("finalize action", () => {
    it("rejects when no model exists", async () => {
      const result = await handleModelDesign({ action: "finalize" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No model");
    });

    it("rejects when model has no entities", async () => {
      await handleModelDesign(
        { action: "start", name: "empty-model", description: "Empty model" },
        {}
      );

      const result = await handleModelDesign({ action: "finalize" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Cannot finalize an empty model");
    });

    it("finalizes model successfully", async () => {
      await handleModelDesign(
        { action: "start", name: "final-model", description: "Model to finalize" },
        {}
      );
      await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      const result = await handleModelDesign({ action: "finalize" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Model design complete");
      expect(result.content[0].text).toContain("final-model");
      expect(result.content[0].text).toContain("Next steps");
      expect(result.content[0].text).toContain("toolkit:generate");
    });

    it("updates state to generate phase", async () => {
      await handleModelDesign(
        { action: "start", name: "state-model", description: "State test model" },
        {}
      );
      await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});
      await handleModelDesign({ action: "finalize" }, {});

      const { createToolkitStorage } = await import("../model/storage.js");
      const storage = createToolkitStorage();
      const state = storage.loadState();

      expect(state.data?.phase).toBe("generate");
    });
  });

  describe("invalid action", () => {
    it("rejects unknown action via schema validation", async () => {
      const result = await handleModelDesign({ action: "invalid" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid");
    });
  });

  describe("invalid input", () => {
    it("rejects completely invalid input", async () => {
      const result = await handleModelDesign({ not_action: "test" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid input");
    });
  });

  describe("entity formatting edge cases", () => {
    it("formats entity without relationships", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const entityWithoutRelationships: EntityDefinition = {
        name: "Simple",
        description: "A simple entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      };

      const result = await handleModelDesign(
        { action: "add-entity", entity: entityWithoutRelationships },
        {}
      );

      expect(result.content[0].text).not.toContain("Relationships:");
    });

    it("formats entity with property descriptions", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const result = await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      expect(result.content[0].text).toContain("User email");
    });

    it("formats optional vs required properties", async () => {
      await handleModelDesign(
        { action: "start", name: "test-model", description: "Test model" },
        {}
      );

      const result = await handleModelDesign({ action: "add-entity", entity: sampleEntity }, {});

      // Required properties don't have ?
      expect(result.content[0].text).toContain("`id`:");
      // Optional properties have ?
      expect(result.content[0].text).toContain("`name?`:");
    });
  });
});
