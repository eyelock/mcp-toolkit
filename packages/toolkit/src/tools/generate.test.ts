/**
 * Generate Tool Tests
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityDefinition } from "../model/index.js";
import { generateTool, handleGenerate } from "./generate.js";

// Mock the storage to use a test directory
let testDir: string;

vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");

  return {
    ...actual,
    createToolkitStorage: (options?: { baseDir?: string }) => {
      const baseDir = options?.baseDir || testDir;
      return new actual.ToolkitStorage({ baseDir });
    },
  };
});

describe("generateTool", () => {
  it("has correct tool definition", () => {
    expect(generateTool.name).toBe("toolkit:generate");
    expect(generateTool.description).toContain("Generate MCP code");
    expect(generateTool.inputSchema).toBeDefined();
  });
});

describe("handleGenerate", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-gen-test-${Date.now()}`);
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
      { name: "email", type: "email", required: true, unique: true },
      { name: "name", type: "string", required: true, unique: false },
      { name: "age", type: "number", required: false, unique: false },
      { name: "isActive", type: "boolean", required: true, unique: false },
      { name: "birthDate", type: "date", required: false, unique: false },
      { name: "lastLogin", type: "datetime", required: false, unique: false },
      { name: "tags", type: "array", required: false, unique: false },
      { name: "metadata", type: "object", required: false, unique: false },
      { name: "settings", type: "json", required: false, unique: false },
      { name: "website", type: "url", required: false, unique: false },
    ],
    relationships: [],
    tags: [],
  };

  async function setupModel(): Promise<void> {
    const { createToolkitStorage } = await import("../model/storage.js");
    const storage = createToolkitStorage();
    storage.initModel("test-model", "A test model");
    storage.addEntity(sampleEntity);
  }

  describe("validation", () => {
    it("rejects invalid input", async () => {
      const result = await handleGenerate({ tier: "invalid" }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid");
    });

    it("rejects missing tier", async () => {
      const result = await handleGenerate({}, {});
      expect(result.isError).toBe(true);
    });
  });

  describe("model requirement", () => {
    it("fails when no model exists", async () => {
      const result = await handleGenerate({ tier: "definitions" }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No model found");
    });
  });

  describe("entity filtering", () => {
    it("filters entities by name", async () => {
      await setupModel();
      const { createToolkitStorage } = await import("../model/storage.js");
      const storage = createToolkitStorage();
      storage.addEntity({
        name: "Product",
        description: "A product",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
        relationships: [],
        tags: [],
      });

      const result = await handleGenerate(
        { tier: "definitions", entities: ["User"], dryRun: true },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("userTool");
      expect(result.content[0].text).not.toContain("productTool");
    });

    it("fails when no matching entities found", async () => {
      await setupModel();
      const result = await handleGenerate(
        { tier: "definitions", entities: ["NonExistent"], dryRun: true },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No matching entities");
      expect(result.content[0].text).toContain("Available:");
    });
  });

  describe("tier: definitions (dry run)", () => {
    it("generates tool definitions", async () => {
      await setupModel();
      const result = await handleGenerate({ tier: "definitions", dryRun: true }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Dry Run");
      expect(result.content[0].text).toContain("tools.ts");
      expect(result.content[0].text).toContain("resources.ts");
      expect(result.content[0].text).toContain("userTool");
    });

    it("generates resource definitions", async () => {
      await setupModel();
      const result = await handleGenerate({ tier: "definitions", dryRun: true }, {});

      expect(result.content[0].text).toContain("userTemplate");
      expect(result.content[0].text).toContain("ResourceTemplate");
    });
  });

  describe("tier: stubs (dry run)", () => {
    it("generates handler stubs", async () => {
      await setupModel();
      const result = await handleGenerate({ tier: "stubs", dryRun: true }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("handlers");
      expect(result.content[0].text).toContain("user.ts");
      // Check for stub marker in the visible portion (output is truncated at 500 chars)
      expect(result.content[0].text).toContain("Tier 2");
    });
  });

  describe("tier: full (dry run)", () => {
    it("generates full CRUD implementations", async () => {
      await setupModel();
      const result = await handleGenerate({ tier: "full", dryRun: true }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("handlers");
      expect(result.content[0].text).toContain("user.ts");
      expect(result.content[0].text).toContain("index.ts");
      expect(result.content[0].text).toContain("randomUUID");
    });
  });

  describe("file writing", () => {
    it("writes tier 1 files to disk", async () => {
      await setupModel();
      const outputDir = join(testDir, "generated");

      const result = await handleGenerate({ tier: "definitions", outputDir, dryRun: false }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Generation Complete");
      expect(result.content[0].text).toContain("Tier: definitions");
      expect(existsSync(join(outputDir, "tools.ts"))).toBe(true);
      expect(existsSync(join(outputDir, "resources.ts"))).toBe(true);
    });

    it("writes tier 2 files to disk", async () => {
      await setupModel();
      const outputDir = join(testDir, "generated2");

      const result = await handleGenerate({ tier: "stubs", outputDir, dryRun: false }, {});

      expect(result.isError).toBeUndefined();
      expect(existsSync(join(outputDir, "tools.ts"))).toBe(true);
      expect(existsSync(join(outputDir, "handlers", "user.ts"))).toBe(true);

      const handlerContent = readFileSync(join(outputDir, "handlers", "user.ts"), "utf-8");
      expect(handlerContent).toContain("TODO");
      expect(handlerContent).toContain("handleUser");
    });

    it("writes tier 3 files to disk", async () => {
      await setupModel();
      const outputDir = join(testDir, "generated3");

      const result = await handleGenerate({ tier: "full", outputDir, dryRun: false }, {});

      expect(result.isError).toBeUndefined();
      expect(existsSync(join(outputDir, "handlers", "user.ts"))).toBe(true);
      expect(existsSync(join(outputDir, "handlers", "index.ts"))).toBe(true);

      const handlerContent = readFileSync(join(outputDir, "handlers", "user.ts"), "utf-8");
      expect(handlerContent).toContain("randomUUID");
      expect(handlerContent).toContain("loadAll");
      expect(handlerContent).toContain("saveAll");
    });

    it("updates state after generation", async () => {
      await setupModel();
      const outputDir = join(testDir, "generated4");

      await handleGenerate({ tier: "full", outputDir, dryRun: false }, {});

      const { createToolkitStorage } = await import("../model/storage.js");
      const storage = createToolkitStorage();
      const state = storage.loadState();

      expect(state.data?.phase).toBe("setup");
      expect(state.data?.generationTier).toBe("full");
      expect(state.data?.generatedFiles?.length).toBeGreaterThan(0);
    });
  });

  describe("type mapping", () => {
    it("maps all property types correctly in generated code", async () => {
      await setupModel();
      // Write files to check full content (dry run truncates at 500 chars)
      const outputDir = join(testDir, "type-mapping-test");
      const result = await handleGenerate({ tier: "full", outputDir, dryRun: false }, {});

      expect(result.isError).toBeUndefined();

      // Check type mappings in the generated handler file
      const handlerContent = readFileSync(join(outputDir, "handlers", "user.ts"), "utf-8");
      expect(handlerContent).toContain("string"); // uuid, email, url, string
      expect(handlerContent).toContain("number");
      expect(handlerContent).toContain("boolean");
    });
  });

  describe("file write errors", () => {
    it("handles file write errors gracefully", async () => {
      await setupModel();
      // Use a path that can't be written to (trying to write to a read-only location)
      const outputDir = "/dev/null/cannot-write-here";

      const result = await handleGenerate({ tier: "definitions", outputDir, dryRun: false }, {});

      // Should still complete but with errors array
      expect(result.content[0].text).toContain("Generation Complete");
    });
  });
});
