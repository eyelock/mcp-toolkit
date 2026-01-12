/**
 * Model Design Tool Tests
 */

import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleModelDesign, modelDesignTool } from "./model-design.js";

// Mock the storage to use a test directory
vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");
  let testDir: string;

  return {
    ...actual,
    createToolkitStorage: () => {
      testDir = testDir || join(tmpdir(), `toolkit-test-${Date.now()}`);
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
  describe("start action", () => {
    it("rejects missing name", async () => {
      const result = await handleModelDesign(
        { action: "start" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("provide");
    });

    it("rejects missing description", async () => {
      const result = await handleModelDesign(
        { action: "start", name: "test-model" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("provide");
    });
  });

  describe("show action", () => {
    it("reports no model when none exists", async () => {
      const result = await handleModelDesign(
        { action: "show" },
        {}
      );

      expect(result.content[0].text).toContain("No model found");
    });
  });

  describe("add-entity action", () => {
    it("rejects missing entity", async () => {
      const result = await handleModelDesign(
        { action: "add-entity" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("entity");
    });
  });

  describe("update-entity action", () => {
    it("rejects missing name", async () => {
      const result = await handleModelDesign(
        { action: "update-entity" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("name");
    });
  });

  describe("remove-entity action", () => {
    it("rejects missing name", async () => {
      const result = await handleModelDesign(
        { action: "remove-entity" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("name");
    });
  });

  describe("finalize action", () => {
    it("rejects when no model exists", async () => {
      const result = await handleModelDesign(
        { action: "finalize" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No model");
    });
  });

  describe("invalid action", () => {
    it("rejects unknown action via schema validation", async () => {
      const result = await handleModelDesign(
        { action: "invalid" },
        {}
      );

      expect(result.isError).toBe(true);
      // Zod validates the action enum before our code handles it
      expect(result.content[0].text).toContain("Invalid");
    });
  });

  describe("invalid input", () => {
    it("rejects completely invalid input", async () => {
      const result = await handleModelDesign(
        { not_action: "test" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid input");
    });
  });
});
