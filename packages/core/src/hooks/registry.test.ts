/**
 * Hook Registry Tests
 */

import { beforeEach, describe, expect, it } from "vitest";
import { HookRegistry, createHookRegistry } from "./registry.js";
import type { HookDefinitionInput } from "./types.js";

describe("HookRegistry", () => {
  let registry: HookRegistry;

  const createTestHook = (overrides: Partial<HookDefinitionInput> = {}): HookDefinitionInput => ({
    id: "test:hook",
    type: "session",
    lifecycle: "start",
    name: "Test Hook",
    ...overrides,
  });

  beforeEach(() => {
    registry = createHookRegistry();
  });

  describe("register", () => {
    it("registers a valid hook", () => {
      const hook = registry.register(createTestHook());

      expect(hook.id).toBe("test:hook");
      expect(hook.priority).toBe(100); // default
      expect(registry.has("test:hook")).toBe(true);
    });

    it("throws on duplicate registration", () => {
      registry.register(createTestHook());

      expect(() => registry.register(createTestHook())).toThrow(
        "Hook with ID 'test:hook' is already registered"
      );
    });

    it("validates hook definition", () => {
      expect(() =>
        registry.register({
          id: "",
          type: "session",
          lifecycle: "start",
          name: "Test",
        })
      ).toThrow();
    });

    it("applies defaults to registered hook", () => {
      const hook = registry.register(createTestHook());

      expect(hook.priority).toBe(100);
      expect(hook.dependencies).toEqual([]);
      expect(hook.blocking).toBe(false);
      expect(hook.tags).toEqual([]);
    });
  });

  describe("registerAll", () => {
    it("registers multiple hooks", () => {
      const hooks = registry.registerAll([
        createTestHook({ id: "hook:one" }),
        createTestHook({ id: "hook:two" }),
        createTestHook({ id: "hook:three" }),
      ]);

      expect(hooks).toHaveLength(3);
      expect(registry.size()).toBe(3);
    });

    it("throws if any hook is duplicate", () => {
      registry.register(createTestHook({ id: "hook:one" }));

      expect(() =>
        registry.registerAll([
          createTestHook({ id: "hook:two" }),
          createTestHook({ id: "hook:one" }), // duplicate
        ])
      ).toThrow();
    });
  });

  describe("get", () => {
    it("returns registered hook by id", () => {
      registry.register(createTestHook());

      const hook = registry.get("test:hook");
      expect(hook?.id).toBe("test:hook");
    });

    it("returns undefined for non-existent hook", () => {
      expect(registry.get("non-existent")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("returns true for registered hook", () => {
      registry.register(createTestHook());
      expect(registry.has("test:hook")).toBe(true);
    });

    it("returns false for non-existent hook", () => {
      expect(registry.has("non-existent")).toBe(false);
    });
  });

  describe("unregister", () => {
    it("removes registered hook", () => {
      registry.register(createTestHook());
      const removed = registry.unregister("test:hook");

      expect(removed).toBe(true);
      expect(registry.has("test:hook")).toBe(false);
    });

    it("returns false for non-existent hook", () => {
      expect(registry.unregister("non-existent")).toBe(false);
    });
  });

  describe("query", () => {
    beforeEach(() => {
      registry.registerAll([
        createTestHook({
          id: "session:start:one",
          type: "session",
          lifecycle: "start",
          priority: 10,
          tags: ["core"],
        }),
        createTestHook({
          id: "session:start:two",
          type: "session",
          lifecycle: "start",
          priority: 20,
          tags: ["optional"],
        }),
        createTestHook({
          id: "session:end",
          type: "session",
          lifecycle: "end",
          priority: 15,
        }),
        createTestHook({
          id: "action:save",
          type: "action",
          lifecycle: "action",
          priority: 5,
          tags: ["core"],
        }),
        createTestHook({
          id: "provider:git",
          type: "provider",
          lifecycle: "config",
          priority: 50,
          conditions: { requiresProvider: "git-notes" },
        }),
      ]);
    });

    it("returns all hooks without conditions when no options provided", () => {
      const results = registry.query();
      // provider:git is excluded because its condition requires a provider
      expect(results).toHaveLength(4);
    });

    it("filters by type", () => {
      const results = registry.query({ type: "session" });

      expect(results).toHaveLength(3);
      expect(results.every((h) => h.type === "session")).toBe(true);
    });

    it("filters by lifecycle", () => {
      const results = registry.query({ lifecycle: "start" });

      expect(results).toHaveLength(2);
      expect(results.every((h) => h.lifecycle === "start")).toBe(true);
    });

    it("filters by type and lifecycle", () => {
      const results = registry.query({ type: "session", lifecycle: "start" });

      expect(results).toHaveLength(2);
    });

    it("filters by tags (any match)", () => {
      const results = registry.query({ tags: ["core"] });

      expect(results).toHaveLength(2);
      expect(results.some((h) => h.id === "session:start:one")).toBe(true);
      expect(results.some((h) => h.id === "action:save")).toBe(true);
    });

    it("filters by multiple tags (any match)", () => {
      const results = registry.query({ tags: ["core", "optional"] });

      expect(results).toHaveLength(3);
    });

    it("sorts results by priority", () => {
      // Query with git-notes provider to include all 5 hooks
      const results = registry.query({ provider: "git-notes" });
      const priorities = results.map((h) => h.priority);

      expect(priorities).toEqual([5, 10, 15, 20, 50]);
    });

    it("excludes hooks with unmet provider condition", () => {
      const results = registry.query({ provider: "memory" });

      expect(results).toHaveLength(4);
      expect(results.every((h) => h.id !== "provider:git")).toBe(true);
    });

    it("includes hooks with met provider condition", () => {
      const results = registry.query({ provider: "git-notes" });

      expect(results).toHaveLength(5);
      expect(results.some((h) => h.id === "provider:git")).toBe(true);
    });
  });

  describe("query with conditions", () => {
    it("evaluates requiresFeature condition", () => {
      registry.register(
        createTestHook({
          id: "feature:hook",
          conditions: { requiresFeature: "advanced" },
        })
      );

      expect(registry.query({ feature: "basic" })).toHaveLength(0);
      expect(registry.query({ feature: "advanced" })).toHaveLength(1);
    });

    it("evaluates requiresConfig condition", () => {
      registry.register(
        createTestHook({
          id: "config:hook",
          conditions: { requiresConfig: { debug: true, level: "verbose" } },
        })
      );

      expect(registry.query({ config: { debug: false } })).toHaveLength(0);
      expect(registry.query({ config: { debug: true } })).toHaveLength(0);
      expect(registry.query({ config: { debug: true, level: "verbose" } })).toHaveLength(1);
    });

    it("includes hooks without conditions", () => {
      registry.register(createTestHook({ id: "no-conditions" }));
      registry.register(
        createTestHook({
          id: "with-conditions",
          conditions: { requiresProvider: "special" },
        })
      );

      const results = registry.query();
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("no-conditions");
    });
  });

  describe("all", () => {
    it("returns all registered hooks", () => {
      registry.registerAll([
        createTestHook({ id: "hook:one" }),
        createTestHook({ id: "hook:two" }),
      ]);

      const all = registry.all();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no hooks registered", () => {
      expect(registry.all()).toEqual([]);
    });
  });

  describe("size", () => {
    it("returns correct count", () => {
      expect(registry.size()).toBe(0);

      registry.register(createTestHook({ id: "one" }));
      expect(registry.size()).toBe(1);

      registry.register(createTestHook({ id: "two" }));
      expect(registry.size()).toBe(2);

      registry.unregister("one");
      expect(registry.size()).toBe(1);
    });
  });

  describe("clear", () => {
    it("removes all hooks", () => {
      registry.registerAll([createTestHook({ id: "one" }), createTestHook({ id: "two" })]);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.all()).toEqual([]);
    });
  });
});

describe("createHookRegistry", () => {
  it("creates a new registry instance", () => {
    const registry = createHookRegistry();
    expect(registry).toBeInstanceOf(HookRegistry);
    expect(registry.size()).toBe(0);
  });
});
