/**
 * Hook Types Tests
 *
 * Tests for Zod schema validation of hook system types
 */

import { describe, expect, it } from "vitest";
import {
  HookDefinitionInputSchema,
  HookDefinitionSchema,
  HookLifecycleSchema,
  HookQueryOptionsSchema,
  HookTypeSchema,
  McpFeatureSchema,
  RequirementLevelSchema,
} from "./types.js";

describe("HookTypeSchema", () => {
  it("accepts valid hook types", () => {
    expect(HookTypeSchema.parse("session")).toBe("session");
    expect(HookTypeSchema.parse("action")).toBe("action");
    expect(HookTypeSchema.parse("storage")).toBe("storage");
    expect(HookTypeSchema.parse("config")).toBe("config");
  });

  it("rejects invalid hook types", () => {
    expect(() => HookTypeSchema.parse("invalid")).toThrow();
    expect(() => HookTypeSchema.parse("")).toThrow();
    expect(() => HookTypeSchema.parse(123)).toThrow();
    // Old value should be rejected
    expect(() => HookTypeSchema.parse("provider")).toThrow();
  });
});

describe("HookLifecycleSchema", () => {
  it("accepts valid lifecycle phases", () => {
    expect(HookLifecycleSchema.parse("start")).toBe("start");
    expect(HookLifecycleSchema.parse("running")).toBe("running");
    expect(HookLifecycleSchema.parse("progress")).toBe("progress");
    expect(HookLifecycleSchema.parse("cancel")).toBe("cancel");
    expect(HookLifecycleSchema.parse("end")).toBe("end");
  });

  it("rejects invalid lifecycle phases", () => {
    expect(() => HookLifecycleSchema.parse("invalid")).toThrow();
    expect(() => HookLifecycleSchema.parse("")).toThrow();
    // Old values should be rejected
    expect(() => HookLifecycleSchema.parse("config")).toThrow();
    expect(() => HookLifecycleSchema.parse("action")).toThrow();
  });
});

describe("RequirementLevelSchema", () => {
  it("accepts valid RFC 2119 requirement levels", () => {
    expect(RequirementLevelSchema.parse("MUST")).toBe("MUST");
    expect(RequirementLevelSchema.parse("MUST NOT")).toBe("MUST NOT");
    expect(RequirementLevelSchema.parse("SHOULD")).toBe("SHOULD");
    expect(RequirementLevelSchema.parse("SHOULD NOT")).toBe("SHOULD NOT");
    expect(RequirementLevelSchema.parse("MAY")).toBe("MAY");
  });

  it("rejects invalid requirement levels", () => {
    expect(() => RequirementLevelSchema.parse("must")).toThrow(); // case-sensitive
    expect(() => RequirementLevelSchema.parse("required")).toThrow();
    expect(() => RequirementLevelSchema.parse("")).toThrow();
  });
});

describe("McpFeatureSchema", () => {
  it("accepts valid MCP features", () => {
    expect(McpFeatureSchema.parse("tools")).toBe("tools");
    expect(McpFeatureSchema.parse("resources")).toBe("resources");
    expect(McpFeatureSchema.parse("prompts")).toBe("prompts");
    expect(McpFeatureSchema.parse("sampling")).toBe("sampling");
    expect(McpFeatureSchema.parse("elicitation")).toBe("elicitation");
  });

  it("rejects invalid features", () => {
    expect(() => McpFeatureSchema.parse("invalid")).toThrow();
    expect(() => McpFeatureSchema.parse("")).toThrow();
  });
});

describe("HookDefinitionSchema", () => {
  const validHook = {
    tag: "welcome",
    type: "session" as const,
    lifecycle: "start" as const,
    name: "Welcome Hook",
    requirementLevel: "SHOULD" as const,
  };

  it("accepts minimal valid definition and computes ID", () => {
    const result = HookDefinitionSchema.parse(validHook);
    expect(result.tag).toBe("welcome");
    expect(result.type).toBe("session");
    expect(result.lifecycle).toBe("start");
    expect(result.name).toBe("Welcome Hook");
    expect(result.requirementLevel).toBe("SHOULD");
    // ID is computed from app:type:lifecycle:tag
    expect(result.id).toBe("mcp-toolkit:session:start:welcome");
  });

  it("applies default values", () => {
    const result = HookDefinitionSchema.parse(validHook);
    expect(result.app).toBe("mcp-toolkit");
    expect(result.priority).toBe(50);
    expect(result.tags).toEqual([]);
  });

  it("uses custom app prefix in computed ID", () => {
    const result = HookDefinitionSchema.parse({
      ...validHook,
      app: "my-server",
    });
    expect(result.id).toBe("my-server:session:start:welcome");
    expect(result.app).toBe("my-server");
  });

  it("accepts full definition with all optional fields", () => {
    const fullHook = {
      ...validHook,
      app: "custom-app",
      description: "A test hook",
      priority: 100,
      contentFile: "./content.md",
      conditions: {
        requiresStorage: ["memory", "file"],
        requiresFeatures: ["sampling", "tools"],
        requiresConfig: { debug: true },
      },
      sessionId: "session-123",
      requestId: "request-456",
      tags: ["test", "example"],
    };

    const result = HookDefinitionSchema.parse(fullHook);
    expect(result.description).toBe("A test hook");
    expect(result.priority).toBe(100);
    expect(result.contentFile).toBe("./content.md");
    expect(result.conditions?.requiresStorage).toEqual(["memory", "file"]);
    expect(result.conditions?.requiresFeatures).toEqual(["sampling", "tools"]);
    expect(result.sessionId).toBe("session-123");
    expect(result.requestId).toBe("request-456");
    expect(result.tags).toEqual(["test", "example"]);
  });

  it("enforces kebab-case for tag", () => {
    expect(() => HookDefinitionSchema.parse({ ...validHook, tag: "CamelCase" })).toThrow();
    expect(() => HookDefinitionSchema.parse({ ...validHook, tag: "snake_case" })).toThrow();
    expect(() => HookDefinitionSchema.parse({ ...validHook, tag: "with spaces" })).toThrow();

    // Valid kebab-case
    const result = HookDefinitionSchema.parse({
      ...validHook,
      tag: "my-valid-tag-123",
    });
    expect(result.tag).toBe("my-valid-tag-123");
  });

  it("rejects empty tag", () => {
    expect(() => HookDefinitionSchema.parse({ ...validHook, tag: "" })).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => HookDefinitionSchema.parse({ ...validHook, name: "" })).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => HookDefinitionSchema.parse({ tag: "test" })).toThrow();
    expect(() => HookDefinitionSchema.parse({ tag: "test", type: "session" })).toThrow();
    expect(() =>
      HookDefinitionSchema.parse({
        tag: "test",
        type: "session",
        lifecycle: "start",
        name: "Test",
        // missing requirementLevel
      })
    ).toThrow();
  });
});

describe("HookDefinitionInputSchema", () => {
  it("allows omitting defaulted fields", () => {
    const input = {
      tag: "welcome",
      type: "session" as const,
      lifecycle: "start" as const,
      name: "Welcome Hook",
      requirementLevel: "SHOULD" as const,
    };

    const result = HookDefinitionInputSchema.parse(input);
    expect(result.app).toBeUndefined();
    expect(result.priority).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it("still requires tag, type, lifecycle, name, requirementLevel", () => {
    expect(() =>
      HookDefinitionInputSchema.parse({
        tag: "test",
        type: "session",
        lifecycle: "start",
        name: "Test",
        // missing requirementLevel
      })
    ).toThrow();
  });
});

describe("HookQueryOptionsSchema", () => {
  it("accepts empty options", () => {
    const result = HookQueryOptionsSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts all filter options", () => {
    const options = {
      type: "session" as const,
      lifecycle: "start" as const,
      tags: ["tag1", "tag2"],
      storage: "memory",
      feature: "sampling" as const,
      config: { key: "value" },
      sessionId: "session-123",
      requestId: "request-456",
    };

    const result = HookQueryOptionsSchema.parse(options);
    expect(result.type).toBe("session");
    expect(result.lifecycle).toBe("start");
    expect(result.tags).toEqual(["tag1", "tag2"]);
    expect(result.storage).toBe("memory");
    expect(result.feature).toBe("sampling");
    expect(result.sessionId).toBe("session-123");
    expect(result.requestId).toBe("request-456");
  });

  it("validates feature against McpFeature enum", () => {
    expect(() => HookQueryOptionsSchema.parse({ feature: "invalid" })).toThrow();

    const result = HookQueryOptionsSchema.parse({ feature: "tools" });
    expect(result.feature).toBe("tools");
  });
});
