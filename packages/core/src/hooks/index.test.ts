/**
 * Hook System Integration Tests
 *
 * Tests that all exports are accessible and work together correctly.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ComposedHooksResult,
  type ComposerOptions,
  type ContentLoaderOptions,
  // Composer
  HookComposer,
  // Loader
  HookContentLoader,
  type HookDefinition,
  type HookDefinitionInput,
  HookDefinitionInputSchema,
  HookDefinitionSchema,
  type HookLifecycle,
  HookLifecycleSchema,
  type HookQueryOptions,
  HookQueryOptionsSchema,
  // Registry
  HookRegistry,
  type HookType,
  // Types
  HookTypeSchema,
  type McpFeature,
  McpFeatureSchema,
  type RequirementLevel,
  RequirementLevelSchema,
  type ResolvedHook,
  composeHooks,
  createComposer,
  createContentLoader,
  createHookRegistry,
} from "./index.js";

describe("Hook System Exports", () => {
  describe("Type Schemas", () => {
    it("exports all Zod schemas", () => {
      expect(HookTypeSchema).toBeDefined();
      expect(HookLifecycleSchema).toBeDefined();
      expect(RequirementLevelSchema).toBeDefined();
      expect(McpFeatureSchema).toBeDefined();
      expect(HookDefinitionSchema).toBeDefined();
      expect(HookDefinitionInputSchema).toBeDefined();
      expect(HookQueryOptionsSchema).toBeDefined();
    });
  });

  describe("Registry", () => {
    it("exports HookRegistry class", () => {
      expect(HookRegistry).toBeDefined();
      const registry = new HookRegistry();
      expect(registry).toBeInstanceOf(HookRegistry);
    });

    it("exports createHookRegistry factory", () => {
      expect(createHookRegistry).toBeDefined();
      const registry = createHookRegistry();
      expect(registry).toBeInstanceOf(HookRegistry);
    });
  });

  describe("Loader", () => {
    it("exports HookContentLoader class", () => {
      expect(HookContentLoader).toBeDefined();
      const loader = new HookContentLoader({ basePath: tmpdir() });
      expect(loader).toBeInstanceOf(HookContentLoader);
    });

    it("exports createContentLoader factory", () => {
      expect(createContentLoader).toBeDefined();
      const loader = createContentLoader({ basePath: tmpdir() });
      expect(loader).toBeInstanceOf(HookContentLoader);
    });
  });

  describe("Composer", () => {
    it("exports HookComposer class", () => {
      expect(HookComposer).toBeDefined();
      const composer = new HookComposer();
      expect(composer).toBeInstanceOf(HookComposer);
    });

    it("exports createComposer factory", () => {
      expect(createComposer).toBeDefined();
      const composer = createComposer();
      expect(composer).toBeInstanceOf(HookComposer);
    });

    it("exports composeHooks convenience function", () => {
      expect(composeHooks).toBeDefined();
      expect(typeof composeHooks).toBe("function");
    });
  });
});

describe("Integration: Full Hook Workflow", () => {
  it("complete workflow: register, query, load inline, compose", () => {
    // 1. Create registry and register hooks
    const registry = createHookRegistry();

    registry.registerAll([
      {
        tag: "session-start",
        type: "session",
        lifecycle: "start",
        name: "Session Start",
        requirementLevel: "MUST",
        priority: 100,
      },
      {
        tag: "session-running",
        type: "session",
        lifecycle: "running",
        name: "Session Running",
        requirementLevel: "SHOULD",
        priority: 50,
      },
      {
        tag: "storage-memory",
        type: "storage",
        lifecycle: "start",
        name: "Memory Storage",
        requirementLevel: "MAY",
        priority: 30,
        conditions: { requiresStorage: ["memory"] },
      },
    ]);

    // 2. Query hooks for session start
    const startHooks = registry.query({
      type: "session",
      lifecycle: "start",
    });

    expect(startHooks).toHaveLength(1);
    expect(startHooks[0]!.id).toBe("mcp-toolkit:session:start:session-start");

    // 3. Query storage hooks with memory context
    const storageHooks = registry.query({
      type: "storage",
      storage: "memory",
    });

    expect(storageHooks).toHaveLength(1);
    expect(storageHooks[0]!.tag).toBe("storage-memory");

    // 4. Load content (inline for testing)
    const loader = createContentLoader({ basePath: tmpdir() });

    const resolvedHooks: ResolvedHook[] = startHooks.map((hook) =>
      loader.loadInline(hook, `# ${hook.name}\n\nContent for ${hook.id}`)
    );

    // 5. Compose hooks
    const result = composeHooks(resolvedHooks);

    expect(result.includedHooks).toHaveLength(1);
    expect(result.content).toContain("### Session Start");
  });

  it("type inference works correctly", () => {
    // These should all compile without errors due to proper type exports
    const type: HookType = "session";
    const lifecycle: HookLifecycle = "start";
    const level: RequirementLevel = "SHOULD";
    const feature: McpFeature = "sampling";

    const input: HookDefinitionInput = {
      tag: "test",
      type,
      lifecycle,
      name: "Test",
      requirementLevel: level,
    };

    const definition: HookDefinition = {
      ...input,
      id: "mcp-toolkit:session:start:test",
      app: "mcp-toolkit",
      priority: 50,
      tags: [],
    };

    const resolved: ResolvedHook = {
      ...definition,
      content: "content",
      resolvedAt: new Date().toISOString(),
    };

    const query: HookQueryOptions = {
      type: "session",
      lifecycle: "start",
      feature,
    };

    const composed: ComposedHooksResult = {
      content: "content",
      includedHooks: [{ id: "test", name: "Test", requirementLevel: "SHOULD" }],
      skippedHooks: [],
      failedHooks: [],
      notices: [],
      composedAt: new Date().toISOString(),
    };

    // All variables should be defined
    expect(type).toBe("session");
    expect(lifecycle).toBe("start");
    expect(level).toBe("SHOULD");
    expect(feature).toBe("sampling");
    expect(input.tag).toBe("test");
    expect(definition.priority).toBe(50);
    expect(resolved.content).toBe("content");
    expect(query.type).toBe("session");
    expect(composed.includedHooks).toHaveLength(1);
  });

  it("option interfaces work correctly", () => {
    const loaderOptions: ContentLoaderOptions = {
      basePath: join(tmpdir(), "hooks"),
      cache: false,
    };

    const composerOptions: ComposerOptions = {
      includeRfc2119Reference: false,
      includePreambles: false,
    };

    const loader = createContentLoader(loaderOptions);
    const composer = createComposer(composerOptions);

    expect(loader).toBeInstanceOf(HookContentLoader);
    expect(composer).toBeInstanceOf(HookComposer);
  });
});
