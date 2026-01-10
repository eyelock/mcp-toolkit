/**
 * Hook System Integration Tests
 *
 * Tests that all exports are accessible and work together correctly.
 */

import { describe, expect, it } from "vitest";
import {
  // Types
  HookTypeSchema,
  HookLifecycleSchema,
  HookDefinitionSchema,
  HookDefinitionInputSchema,
  ResolvedHookSchema,
  HookQueryOptionsSchema,
  ComposedHooksResultSchema,
  type HookType,
  type HookLifecycle,
  type HookDefinition,
  type HookDefinitionInput,
  type ResolvedHook,
  type HookQueryOptions,
  type ComposedHooksResult,
  // Registry
  HookRegistry,
  createHookRegistry,
  // Loader
  HookContentLoader,
  createContentLoader,
  getModuleDir,
  type ContentLoaderOptions,
  // Composer
  HookComposer,
  createComposer,
  composeHooks,
  type ComposerOptions,
} from "./index.js";

describe("Hook System Exports", () => {
  describe("Type Schemas", () => {
    it("exports all Zod schemas", () => {
      expect(HookTypeSchema).toBeDefined();
      expect(HookLifecycleSchema).toBeDefined();
      expect(HookDefinitionSchema).toBeDefined();
      expect(HookDefinitionInputSchema).toBeDefined();
      expect(ResolvedHookSchema).toBeDefined();
      expect(HookQueryOptionsSchema).toBeDefined();
      expect(ComposedHooksResultSchema).toBeDefined();
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
      const loader = new HookContentLoader();
      expect(loader).toBeInstanceOf(HookContentLoader);
    });

    it("exports createContentLoader factory", () => {
      expect(createContentLoader).toBeDefined();
      const loader = createContentLoader();
      expect(loader).toBeInstanceOf(HookContentLoader);
    });

    it("exports getModuleDir helper", () => {
      expect(getModuleDir).toBeDefined();
      expect(typeof getModuleDir).toBe("function");
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
        id: "mcp-toolkit:session:start",
        type: "session",
        lifecycle: "start",
        name: "Session Start",
        priority: 10,
      },
      {
        id: "mcp-toolkit:session:config",
        type: "session",
        lifecycle: "config",
        name: "Configuration",
        priority: 20,
        dependencies: ["mcp-toolkit:session:start"],
      },
      {
        id: "provider:git:config",
        type: "provider",
        lifecycle: "config",
        name: "Git Provider Config",
        priority: 30,
        conditions: { requiresProvider: "git-notes" },
      },
    ]);

    // 2. Query hooks for session start
    const startHooks = registry.query({
      type: "session",
      lifecycle: "start",
    });

    expect(startHooks).toHaveLength(1);
    expect(startHooks[0]!.id).toBe("mcp-toolkit:session:start");

    // 3. Query config hooks for git provider
    const configHooks = registry.query({
      lifecycle: "config",
      provider: "git-notes",
    });

    expect(configHooks).toHaveLength(2);

    // 4. Load content (inline for testing)
    const loader = createContentLoader();

    const resolvedHooks: ResolvedHook[] = configHooks.map((hook) =>
      loader.loadInline(hook, `# ${hook.name}\n\nContent for ${hook.id}`)
    );

    // 5. Compose hooks
    const result = composeHooks(resolvedHooks);

    expect(result.hooks).toHaveLength(2);
    expect(result.content).toContain("# Configuration");
    expect(result.content).toContain("# Git Provider Config");

    // Verify dependency ordering
    const configIndex = result.content.indexOf("Configuration");
    const gitIndex = result.content.indexOf("Git Provider Config");
    expect(configIndex).toBeLessThan(gitIndex);
  });

  it("type inference works correctly", () => {
    // These should all compile without errors due to proper type exports
    const type: HookType = "session";
    const lifecycle: HookLifecycle = "start";

    const input: HookDefinitionInput = {
      id: "test",
      type,
      lifecycle,
      name: "Test",
    };

    const definition: HookDefinition = {
      ...input,
      priority: 100,
      dependencies: [],
      blocking: false,
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
    };

    const composed: ComposedHooksResult = {
      content: "content",
      hooks: [{ id: "test", name: "Test", priority: 100 }],
      composedAt: new Date().toISOString(),
      blockingHooks: [],
    };

    // All variables should be defined
    expect(type).toBe("session");
    expect(lifecycle).toBe("start");
    expect(input.id).toBe("test");
    expect(definition.priority).toBe(100);
    expect(resolved.content).toBe("content");
    expect(query.type).toBe("session");
    expect(composed.hooks).toHaveLength(1);
  });

  it("option interfaces work correctly", () => {
    const loaderOptions: ContentLoaderOptions = {
      basePath: "/custom",
      cache: false,
    };

    const composerOptions: ComposerOptions = {
      separator: "---",
      includeHeaders: true,
      headerFormat: "## {name}",
    };

    const loader = createContentLoader(loaderOptions);
    const composer = createComposer(composerOptions);

    expect(loader).toBeInstanceOf(HookContentLoader);
    expect(composer).toBeInstanceOf(HookComposer);
  });
});
