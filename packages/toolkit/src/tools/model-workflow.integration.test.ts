/**
 * Model Workflow Integration Tests
 *
 * Tests the complete model design → generate workflow using the test harness.
 * These tests verify that tools work correctly together in realistic scenarios.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertToolResult, createTestHarness, runTestCases } from "@mcp-toolkit/testing";
import type { TestCase } from "@mcp-toolkit/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityDefinition } from "../model/index.js";
import { handleGenerate } from "./generate.js";
import { handleModelDesign } from "./model-design.js";

// =============================================================================
// Test Setup - Mock storage to use temp directory
// =============================================================================

let testDir: string;

vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");

  return {
    ...actual,
    createToolkitStorage: () => {
      if (!testDir) {
        testDir = join(tmpdir(), `toolkit-workflow-test-${Date.now()}`);
      }
      if (!existsSync(testDir)) {
        mkdirSync(testDir, { recursive: true });
      }
      return new actual.ToolkitStorage({ baseDir: testDir });
    },
  };
});

// =============================================================================
// Test Fixtures
// =============================================================================

const userEntity: EntityDefinition = {
  name: "User",
  description: "A user in the system",
  properties: [
    { name: "id", type: "uuid", required: true, unique: true },
    { name: "email", type: "email", required: true, unique: true, description: "User email" },
    { name: "name", type: "string", required: true, unique: false },
    { name: "createdAt", type: "datetime", required: true, unique: false },
  ],
  relationships: [{ target: "Profile", type: "one-to-one", description: "User profile" }],
  tags: ["core", "auth"],
};

const profileEntity: EntityDefinition = {
  name: "Profile",
  description: "User profile with extended information",
  properties: [
    { name: "id", type: "uuid", required: true, unique: true },
    { name: "userId", type: "uuid", required: true, unique: true },
    { name: "bio", type: "string", required: false, unique: false },
    { name: "avatarUrl", type: "url", required: false, unique: false },
  ],
  relationships: [{ target: "User", type: "one-to-one", description: "Owning user" }],
  tags: ["profile"],
};

const postEntity: EntityDefinition = {
  name: "Post",
  description: "A blog post created by a user",
  properties: [
    { name: "id", type: "uuid", required: true, unique: true },
    { name: "title", type: "string", required: true, unique: false },
    { name: "content", type: "string", required: true, unique: false },
    { name: "authorId", type: "uuid", required: true, unique: false },
    { name: "publishedAt", type: "datetime", required: false, unique: false },
  ],
  // Note: Schema only supports "one-to-one", "one-to-many", "many-to-many"
  // This represents the "belongs to" side of a one-to-many from User's perspective
  relationships: [{ target: "User", type: "one-to-one", description: "Author of the post" }],
  tags: ["content"],
};

// =============================================================================
// Integration Tests
// =============================================================================

describe("Model Workflow Integration Tests", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-workflow-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Test Harness Integration", () => {
    it("creates harness with model design and generate tools", () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      expect(harness.listTools()).toContain("toolkit:model:design");
      expect(harness.listTools()).toContain("toolkit:generate");
    });
  });

  describe("Complete Model Design Workflow", () => {
    it("executes full workflow: start → add entities → finalize → generate", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      // Step 1: Start the model
      const startResult = await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "blog-api",
        description: "A simple blog API with users and posts",
      });
      expect(startResult.result.isError).toBeUndefined();
      expect(startResult.result.content[0].text).toContain("Created new model");
      expect(startResult.result.content[0].text).toContain("blog-api");

      // Step 2: Add User entity
      const addUserResult = await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });
      expect(addUserResult.result.isError).toBeUndefined();
      expect(addUserResult.result.content[0].text).toContain("Added entity");
      expect(addUserResult.result.content[0].text).toContain("User");

      // Step 3: Add Profile entity
      const addProfileResult = await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: profileEntity,
      });
      expect(addProfileResult.result.isError).toBeUndefined();
      expect(addProfileResult.result.content[0].text).toContain("Profile");

      // Step 4: Add Post entity
      const addPostResult = await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: postEntity,
      });
      expect(addPostResult.result.isError).toBeUndefined();
      expect(addPostResult.result.content[0].text).toContain("3 entities");

      // Step 5: Show model to verify state
      const showResult = await harness.callTool("toolkit:model:design", {
        action: "show",
      });
      expect(showResult.result.content[0].text).toContain("blog-api");
      expect(showResult.result.content[0].text).toContain("3 Entities");
      expect(showResult.result.content[0].text).toContain("User");
      expect(showResult.result.content[0].text).toContain("Profile");
      expect(showResult.result.content[0].text).toContain("Post");

      // Step 6: Finalize model
      const finalizeResult = await harness.callTool("toolkit:model:design", {
        action: "finalize",
      });
      expect(finalizeResult.result.isError).toBeUndefined();
      expect(finalizeResult.result.content[0].text).toContain("Model design complete");
      expect(finalizeResult.result.content[0].text).toContain("toolkit:generate");

      // Step 7: Generate code (dry run)
      const generateResult = await harness.callTool("toolkit:generate", {
        tier: "definitions",
        dryRun: true,
      });
      expect(generateResult.result.isError).toBeUndefined();
      expect(generateResult.result.content[0].text).toContain("Dry Run");
      expect(generateResult.result.content[0].text).toContain("tools.ts");
      expect(generateResult.result.content[0].text).toContain("resources.ts");
    });

    it("tracks workflow duration through harness", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      const { durationMs: startDuration } = await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "timed-model",
        description: "Model for timing test",
      });
      expect(startDuration).toBeGreaterThanOrEqual(0);

      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });

      const { durationMs: finalizeDuration } = await harness.callTool("toolkit:model:design", {
        action: "finalize",
      });
      expect(finalizeDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Generation Tiers", () => {
    const setupModel = async (harness: ReturnType<typeof createTestHarness>) => {
      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "tier-test-model",
        description: "Model for testing generation tiers",
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });
      await harness.callTool("toolkit:model:design", {
        action: "finalize",
      });
    };

    it("generates tier 1 (definitions) with tools and resources", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });
      await setupModel(harness);

      const result = await harness.callTool("toolkit:generate", {
        tier: "definitions",
        dryRun: true,
      });

      expect(result.result.isError).toBeUndefined();
      const text = result.result.content[0].text;
      expect(text).toContain("tools.ts");
      expect(text).toContain("resources.ts");
      expect(text).toContain("userTool");
      expect(text).toContain("userTemplate");
      expect(text).toContain("Total: 2 files");
    });

    it("generates tier 2 (stubs) with handler stubs", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });
      await setupModel(harness);

      const result = await harness.callTool("toolkit:generate", {
        tier: "stubs",
        dryRun: true,
      });

      expect(result.result.isError).toBeUndefined();
      const text = result.result.content[0].text;
      expect(text).toContain("handler stub");
      expect(text).toContain("user.ts");
      // Note: TODO appears in the full content but dryRun truncates at 500 chars
      expect(text).toContain("Tier 2");
      expect(text).toContain("Total: 3 files");
    });

    it("generates tier 3 (full) with complete implementations", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });
      await setupModel(harness);

      const result = await harness.callTool("toolkit:generate", {
        tier: "full",
        dryRun: true,
      });

      expect(result.result.isError).toBeUndefined();
      const text = result.result.content[0].text;
      expect(text).toContain("full implementation");
      expect(text).toContain("CRUD");
      expect(text).toContain("index.ts"); // handlers index
      expect(text).toContain("Total: 4 files"); // tools, resources, user handler, handlers index
    });
  });

  describe("Selective Entity Generation", () => {
    it("generates code for specific entities only", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "selective-model",
        description: "Model for selective generation",
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: postEntity,
      });
      await harness.callTool("toolkit:model:design", {
        action: "finalize",
      });

      // Generate only User entity
      const result = await harness.callTool("toolkit:generate", {
        tier: "definitions",
        entities: ["User"],
        dryRun: true,
      });

      expect(result.result.isError).toBeUndefined();
      const text = result.result.content[0].text;
      expect(text).toContain("userTool");
      expect(text).not.toContain("postTool");
    });
  });

  describe("Error Handling Workflow", () => {
    it("fails generation when no model exists", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      const result = await harness.callTool("toolkit:generate", {
        tier: "definitions",
        dryRun: true,
      });

      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("No model found");
    });

    it("fails finalize on empty model", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "empty-model",
        description: "Model with no entities",
      });

      const result = await harness.callTool("toolkit:model:design", {
        action: "finalize",
      });

      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("Cannot finalize an empty model");
    });

    it("fails generation with non-existent entity filter", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "filter-model",
        description: "Model for filter test",
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });
      await harness.callTool("toolkit:model:design", {
        action: "finalize",
      });

      const result = await harness.callTool("toolkit:generate", {
        tier: "definitions",
        entities: ["NonExistent"],
        dryRun: true,
      });

      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("No matching entities");
    });

    it("prevents creating duplicate models", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "first-model",
        description: "First model",
      });

      const result = await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "second-model",
        description: "Second model",
      });

      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("already exists");
    });
  });

  describe("Entity Modification Workflow", () => {
    it("supports update-remove-add cycle", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      // Start model and add entity
      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "modify-model",
        description: "Model for modification test",
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });

      // Update entity
      const updatedUser: EntityDefinition = {
        ...userEntity,
        description: "Updated user description",
        properties: [
          ...userEntity.properties,
          { name: "phone", type: "string", required: false, unique: false },
        ],
      };
      const updateResult = await harness.callTool("toolkit:model:design", {
        action: "update-entity",
        name: "User",
        entity: updatedUser,
      });
      expect(updateResult.result.isError).toBeUndefined();
      expect(updateResult.result.content[0].text).toContain("Updated entity");

      // Verify update in show
      const showResult = await harness.callTool("toolkit:model:design", {
        action: "show",
      });
      expect(showResult.result.content[0].text).toContain("phone");
      expect(showResult.result.content[0].text).toContain("Updated user description");

      // Remove and re-add different entity
      await harness.callTool("toolkit:model:design", {
        action: "remove-entity",
        name: "User",
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: postEntity,
      });

      const finalShow = await harness.callTool("toolkit:model:design", {
        action: "show",
      });
      // Check for entity heading "## User" to ensure User entity is removed
      // Note: "User" still appears in Post's relationship to User
      expect(finalShow.result.content[0].text).not.toContain("## User");
      expect(finalShow.result.content[0].text).toContain("## Post");
    });
  });

  describe("Test Case Runner Integration", () => {
    it("runs test cases using runTestCases helper", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      // Setup model first
      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "test-case-model",
        description: "Model for test cases",
      });
      await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });

      const testCases: TestCase[] = [
        {
          name: "show model displays entities",
          toolCall: {
            name: "toolkit:model:design",
            arguments: { action: "show" },
          },
          expected: {
            isError: undefined,
            contentContains: "User",
          },
        },
        {
          name: "finalize model succeeds",
          toolCall: {
            name: "toolkit:model:design",
            arguments: { action: "finalize" },
          },
          expected: {
            contentContains: "Model design complete",
          },
        },
        {
          name: "generate produces output",
          toolCall: {
            name: "toolkit:generate",
            arguments: { tier: "definitions", dryRun: true },
          },
          expected: {
            contentContains: "Dry Run",
          },
        },
      ];

      const results = await runTestCases(harness, testCases);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.passed)).toBe(true);
      expect(results[0].name).toBe("show model displays entities");
      expect(results[1].name).toBe("finalize model succeeds");
      expect(results[2].name).toBe("generate produces output");
    });
  });

  describe("assertToolResult Integration", () => {
    it("validates tool results with assertToolResult", async () => {
      const harness = createTestHarness({
        tools: {
          "toolkit:model:design": handleModelDesign,
          "toolkit:generate": handleGenerate,
        },
      });

      await harness.callTool("toolkit:model:design", {
        action: "start",
        name: "assert-model",
        description: "Model for assertion test",
      });

      const { result } = await harness.callTool("toolkit:model:design", {
        action: "add-entity",
        entity: userEntity,
      });

      // Test contentContains
      const containsAssertion = assertToolResult(result, {
        contentContains: "Added entity",
      });
      expect(containsAssertion.passed).toBe(true);

      // Test contentMatches (regex)
      const matchesAssertion = assertToolResult(result, {
        contentMatches: "\\d+ entities?",
      });
      expect(matchesAssertion.passed).toBe(true);

      // Test custom assertion
      const customAssertion = assertToolResult(result, {
        custom: (r) => r.content.length > 0,
      });
      expect(customAssertion.passed).toBe(true);
    });
  });
});
