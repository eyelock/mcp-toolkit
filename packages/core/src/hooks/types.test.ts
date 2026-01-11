/**
 * Hook Types Tests
 *
 * Tests for Zod schema validation of hook system types
 */

import { describe, expect, it } from "vitest";
import {
  ComposedHooksResultSchema,
  HookDefinitionInputSchema,
  HookDefinitionSchema,
  HookLifecycleSchema,
  HookQueryOptionsSchema,
  HookTypeSchema,
  ResolvedHookSchema,
} from "./types.js";

describe("HookTypeSchema", () => {
  it("accepts valid hook types", () => {
    expect(HookTypeSchema.parse("session")).toBe("session");
    expect(HookTypeSchema.parse("action")).toBe("action");
    expect(HookTypeSchema.parse("provider")).toBe("provider");
  });

  it("rejects invalid hook types", () => {
    expect(() => HookTypeSchema.parse("invalid")).toThrow();
    expect(() => HookTypeSchema.parse("")).toThrow();
    expect(() => HookTypeSchema.parse(123)).toThrow();
  });
});

describe("HookLifecycleSchema", () => {
  it("accepts valid lifecycle phases", () => {
    expect(HookLifecycleSchema.parse("start")).toBe("start");
    expect(HookLifecycleSchema.parse("config")).toBe("config");
    expect(HookLifecycleSchema.parse("action")).toBe("action");
    expect(HookLifecycleSchema.parse("end")).toBe("end");
  });

  it("rejects invalid lifecycle phases", () => {
    expect(() => HookLifecycleSchema.parse("invalid")).toThrow();
    expect(() => HookLifecycleSchema.parse("")).toThrow();
  });
});

describe("HookDefinitionSchema", () => {
  const validHook = {
    id: "test:hook",
    type: "session" as const,
    lifecycle: "start" as const,
    name: "Test Hook",
  };

  it("accepts minimal valid definition", () => {
    const result = HookDefinitionSchema.parse(validHook);
    expect(result.id).toBe("test:hook");
    expect(result.type).toBe("session");
    expect(result.lifecycle).toBe("start");
    expect(result.name).toBe("Test Hook");
  });

  it("applies default values", () => {
    const result = HookDefinitionSchema.parse(validHook);
    expect(result.priority).toBe(100);
    expect(result.dependencies).toEqual([]);
    expect(result.blocking).toBe(false);
    expect(result.tags).toEqual([]);
  });

  it("accepts full definition with all optional fields", () => {
    const fullHook = {
      ...validHook,
      description: "A test hook",
      priority: 50,
      contentFile: "./content.md",
      dependencies: ["dep:one", "dep:two"],
      blocking: true,
      conditions: {
        requiresProvider: "git-notes",
        requiresFeature: "advanced",
        requiresConfig: { debug: true },
      },
      tags: ["test", "example"],
    };

    const result = HookDefinitionSchema.parse(fullHook);
    expect(result.description).toBe("A test hook");
    expect(result.priority).toBe(50);
    expect(result.contentFile).toBe("./content.md");
    expect(result.dependencies).toEqual(["dep:one", "dep:two"]);
    expect(result.blocking).toBe(true);
    expect(result.conditions?.requiresProvider).toBe("git-notes");
    expect(result.tags).toEqual(["test", "example"]);
  });

  it("rejects empty id", () => {
    expect(() => HookDefinitionSchema.parse({ ...validHook, id: "" })).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => HookDefinitionSchema.parse({ ...validHook, name: "" })).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => HookDefinitionSchema.parse({ id: "test" })).toThrow();
    expect(() => HookDefinitionSchema.parse({ id: "test", type: "session" })).toThrow();
  });
});

describe("HookDefinitionInputSchema", () => {
  it("allows omitting defaulted fields", () => {
    const input = {
      id: "test:hook",
      type: "session" as const,
      lifecycle: "start" as const,
      name: "Test Hook",
    };

    const result = HookDefinitionInputSchema.parse(input);
    expect(result.priority).toBeUndefined();
    expect(result.dependencies).toBeUndefined();
  });
});

describe("ResolvedHookSchema", () => {
  it("extends HookDefinition with content fields", () => {
    const resolved = {
      id: "test:hook",
      type: "session" as const,
      lifecycle: "start" as const,
      name: "Test Hook",
      content: "# Test Content\n\nThis is the hook content.",
      resolvedAt: new Date().toISOString(),
    };

    const result = ResolvedHookSchema.parse(resolved);
    expect(result.content).toBe(resolved.content);
    expect(result.resolvedAt).toBe(resolved.resolvedAt);
  });

  it("accepts optional contentPath", () => {
    const resolved = {
      id: "test:hook",
      type: "session" as const,
      lifecycle: "start" as const,
      name: "Test Hook",
      content: "content",
      contentPath: "/path/to/content.md",
      resolvedAt: new Date().toISOString(),
    };

    const result = ResolvedHookSchema.parse(resolved);
    expect(result.contentPath).toBe("/path/to/content.md");
  });

  it("rejects invalid datetime format", () => {
    const resolved = {
      id: "test:hook",
      type: "session" as const,
      lifecycle: "start" as const,
      name: "Test Hook",
      content: "content",
      resolvedAt: "not-a-date",
    };

    expect(() => ResolvedHookSchema.parse(resolved)).toThrow();
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
      provider: "git-notes",
      feature: "advanced",
      config: { key: "value" },
    };

    const result = HookQueryOptionsSchema.parse(options);
    expect(result.type).toBe("session");
    expect(result.lifecycle).toBe("start");
    expect(result.tags).toEqual(["tag1", "tag2"]);
  });
});

describe("ComposedHooksResultSchema", () => {
  it("validates complete composed result", () => {
    const result = {
      content: "# Combined Content",
      hooks: [
        { id: "hook1", name: "Hook One", priority: 10 },
        { id: "hook2", name: "Hook Two", priority: 20 },
      ],
      composedAt: new Date().toISOString(),
      blockingHooks: ["hook2"],
    };

    const parsed = ComposedHooksResultSchema.parse(result);
    expect(parsed.hooks).toHaveLength(2);
    expect(parsed.blockingHooks).toContain("hook2");
  });

  it("requires all fields", () => {
    expect(() =>
      ComposedHooksResultSchema.parse({
        content: "test",
        hooks: [],
      })
    ).toThrow();
  });
});
