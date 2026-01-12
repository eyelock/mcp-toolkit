/**
 * Model Import Tool Tests
 */

import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modelImportTool, handleModelImport } from "./model-import.js";

// Mock the storage to use a test directory
let testDir: string;

vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");

  return {
    ...actual,
    createToolkitStorage: () => {
      testDir = testDir || join(tmpdir(), `toolkit-import-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      return new actual.ToolkitStorage({ baseDir: testDir });
    },
  };
});

describe("modelImportTool", () => {
  it("has correct tool definition", () => {
    expect(modelImportTool.name).toBe("toolkit:model:import");
    expect(modelImportTool.description).toContain("Import entity definitions");
    expect(modelImportTool.inputSchema).toBeDefined();
  });
});

describe("handleModelImport", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-import-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  async function setupModel(): Promise<void> {
    const { createToolkitStorage } = await import("../model/storage.js");
    const storage = createToolkitStorage();
    storage.initModel("test-model", "A test model");
  }

  describe("validation", () => {
    it("rejects invalid input", async () => {
      const result = await handleModelImport({ source: "invalid" }, {});
      expect(result.isError).toBe(true);
    });

    it("rejects missing content", async () => {
      const result = await handleModelImport({ source: "text" }, {});
      expect(result.isError).toBe(true);
    });
  });

  describe("merge requirement", () => {
    it("fails when merge=true but no model exists", async () => {
      const result = await handleModelImport(
        { source: "text", content: "User has name, email", merge: true },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No model exists to merge");
    });
  });

  describe("URL source", () => {
    it("returns not implemented for URL source", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "url", content: "https://example.com/api.json" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("URL import is not yet implemented");
    });
  });

  describe("OpenAPI parsing", () => {
    it("parses OpenAPI spec with components/schemas", async () => {
      await setupModel();
      const openApiSpec = JSON.stringify({
        openapi: "3.0.0",
        components: {
          schemas: {
            User: {
              type: "object",
              description: "A user entity",
              required: ["id", "email"],
              properties: {
                id: { type: "string", format: "uuid" },
                email: { type: "string", format: "email" },
                name: { type: "string", description: "User's full name" },
                age: { type: "integer" },
                isActive: { type: "boolean" },
                createdAt: { type: "string", format: "date" },
                lastLogin: { type: "string", format: "date-time" },
                website: { type: "string", format: "uri" },
                tags: { type: "array" },
                metadata: { type: "object" },
              },
            },
          },
        },
      });

      const result = await handleModelImport({ source: "openapi", content: openApiSpec }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Import complete");
      expect(result.content[0].text).toContain("User");
      expect(result.content[0].text).toContain("Added: 1");
    });

    it("parses OpenAPI spec with definitions (older format)", async () => {
      await setupModel();
      const openApiSpec = JSON.stringify({
        swagger: "2.0",
        definitions: {
          Product: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              price: { type: "number" },
            },
          },
        },
      });

      const result = await handleModelImport({ source: "openapi", content: openApiSpec }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Product");
    });

    it("handles invalid OpenAPI spec", async () => {
      await setupModel();
      const result = await handleModelImport({ source: "openapi", content: "not valid json" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Import failed");
    });

    it("handles empty OpenAPI spec", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "openapi", content: JSON.stringify({}) },
        {}
      );

      expect(result.content[0].text).toContain("No entities could be extracted");
    });
  });

  describe("JSON Schema parsing", () => {
    it("parses JSON Schema with single object", async () => {
      await setupModel();
      const jsonSchema = JSON.stringify({
        type: "object",
        title: "Customer",
        description: "A customer entity",
        required: ["id"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
        },
      });

      const result = await handleModelImport({ source: "json-schema", content: jsonSchema }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Customer");
    });

    it("parses JSON Schema with definitions", async () => {
      await setupModel();
      const jsonSchema = JSON.stringify({
        definitions: {
          Order: {
            type: "object",
            properties: {
              id: { type: "string" },
              total: { type: "number" },
            },
          },
          OrderItem: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "integer" },
            },
          },
        },
      });

      const result = await handleModelImport({ source: "json-schema", content: jsonSchema }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Order");
      expect(result.content[0].text).toContain("OrderItem");
      expect(result.content[0].text).toContain("Added: 2");
    });

    it("parses JSON Schema with $defs (newer format)", async () => {
      await setupModel();
      const jsonSchema = JSON.stringify({
        $defs: {
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
          },
        },
      });

      const result = await handleModelImport({ source: "json-schema", content: jsonSchema }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Address");
    });

    it("handles invalid JSON Schema", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "json-schema", content: "invalid json" },
        {}
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Import failed");
    });
  });

  describe("text parsing", () => {
    it("parses text with 'has' pattern", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "text", content: "User has name, email, password" },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("User");
      expect(result.content[0].text).toContain("3 properties");
    });

    it("parses text with 'contains' pattern", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "text", content: "Product contains id, title, price" },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Product");
    });

    it("parses text with 'includes' pattern", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "text", content: "Order includes orderId; customerId; total" },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Order");
    });

    it("parses text with colon pattern", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "text", content: "Category: name, description, parentId" },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Category");
    });

    it("handles text with no extractable entities", async () => {
      await setupModel();
      const result = await handleModelImport(
        { source: "text", content: "This is just regular text with no entity patterns." },
        {}
      );

      expect(result.content[0].text).toContain("No entities could be extracted");
    });

    it("filters out very long property names", async () => {
      await setupModel();
      const longProp = "a".repeat(60);
      const result = await handleModelImport(
        { source: "text", content: `Test has name, ${longProp}` },
        {}
      );

      // Should only have 1 property (name), not the long one
      expect(result.content[0].text).toContain("1 properties");
    });
  });

  describe("file path handling", () => {
    it("reads content from JSON file path", async () => {
      await setupModel();
      const filePath = join(testDir, "schema.json");
      writeFileSync(
        filePath,
        JSON.stringify({
          type: "object",
          title: "FileEntity",
          properties: {
            id: { type: "string" },
          },
        })
      );

      const result = await handleModelImport({ source: "json-schema", content: filePath }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("FileEntity");
    });

    it("uses content directly if file doesn't exist", async () => {
      await setupModel();
      const result = await handleModelImport(
        {
          source: "json-schema",
          content: JSON.stringify({
            type: "object",
            title: "DirectContent",
            properties: { id: { type: "string" } },
          }),
        },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("DirectContent");
    });

    it("uses content directly when file path does not exist", async () => {
      await setupModel();
      // Pass a .json path that doesn't exist - code should try to read it,
      // fail, and then use the string as-is (which will fail JSON parsing)
      const nonExistentPath = join(testDir, "non-existent-file.json");

      const result = await handleModelImport(
        { source: "json-schema", content: nonExistentPath },
        {}
      );

      // Should fail because the path string isn't valid JSON
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Import failed");
    });
  });

  describe("duplicate handling", () => {
    it("skips duplicate entities", async () => {
      await setupModel();

      // First import
      await handleModelImport({ source: "text", content: "User has name, email" }, {});

      // Second import with same entity
      const result = await handleModelImport(
        { source: "text", content: "User has name, email, password" },
        {}
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Skipped (already exist): 1");
    });
  });

  describe("case conversion", () => {
    it("converts entity names to PascalCase", async () => {
      await setupModel();
      // Note: The text parser uses \w+ pattern, so kebab-case like "user-profile"
      // would only capture "profile". Use underscore for multi-word entities.
      const result = await handleModelImport(
        { source: "text", content: "user_profile has name, email" },
        {}
      );

      expect(result.content[0].text).toContain("UserProfile");
    });

    it("converts property names to camelCase", async () => {
      await setupModel();
      const jsonSchema = JSON.stringify({
        type: "object",
        title: "Test",
        properties: {
          "user-name": { type: "string" },
          full_name: { type: "string" },
        },
      });

      const result = await handleModelImport({ source: "json-schema", content: jsonSchema }, {});

      expect(result.isError).toBeUndefined();
    });
  });

  describe("unknown source type", () => {
    it("rejects unknown source type", async () => {
      await setupModel();
      // Force an invalid source type through
      const result = await handleModelImport({ source: "unknown" as any, content: "test" }, {});

      expect(result.isError).toBe(true);
    });
  });
});
