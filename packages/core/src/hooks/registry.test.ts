/**
 * Hook Registry Tests
 */

import { beforeEach, describe, expect, it } from "vitest";
import { type HookRegistry, createHookRegistry } from "./registry.js";
import type { HookDefinitionInput } from "./types.js";

describe("HookRegistry", () => {
  let registry: HookRegistry;

  const createTestHook = (overrides: Partial<HookDefinitionInput> = {}): HookDefinitionInput => ({
    tag: "test-hook",
    type: "session",
    lifecycle: "start",
    name: "Test Hook",
    requirementLevel: "SHOULD",
    ...overrides,
  });

  beforeEach(() => {
    registry = createHookRegistry();
  });

  describe("register", () => {
    it("registers a valid hook with computed ID", () => {
      const hook = registry.register(createTestHook());

      expect(hook.id).toBe("mcp-toolkit:session:start:test-hook");
      expect(hook.priority).toBe(50); // default
      expect(registry.has("mcp-toolkit:session:start:test-hook")).toBe(true);
    });

    it("uses custom app prefix", () => {
      const hook = registry.register(createTestHook({ app: "my-app" }));

      expect(hook.id).toBe("my-app:session:start:test-hook");
      expect(hook.app).toBe("my-app");
    });

    it("throws on duplicate registration", () => {
      registry.register(createTestHook());

      expect(() => registry.register(createTestHook())).toThrow(
        "Hook with ID 'mcp-toolkit:session:start:test-hook' is already registered"
      );
    });

    it("validates hook definition", () => {
      expect(() =>
        registry.register({
          tag: "",
          type: "session",
          lifecycle: "start",
          name: "Test",
          requirementLevel: "SHOULD",
        } as HookDefinitionInput)
      ).toThrow();
    });

    it("applies defaults to registered hook", () => {
      const hook = registry.register(createTestHook());

      expect(hook.app).toBe("mcp-toolkit");
      expect(hook.priority).toBe(50);
      expect(hook.tags).toEqual([]);
    });
  });

  describe("registerAll", () => {
    it("registers multiple hooks", () => {
      const hooks = registry.registerAll([
        createTestHook({ tag: "hook-one" }),
        createTestHook({ tag: "hook-two" }),
        createTestHook({ tag: "hook-three" }),
      ]);

      expect(hooks).toHaveLength(3);
      expect(registry.size()).toBe(3);
    });

    it("throws if any hook is duplicate", () => {
      registry.register(createTestHook({ tag: "hook-one" }));

      expect(() =>
        registry.registerAll([
          createTestHook({ tag: "hook-two" }),
          createTestHook({ tag: "hook-one" }), // duplicate
        ])
      ).toThrow();
    });
  });

  describe("get", () => {
    it("returns registered hook by id", () => {
      registry.register(createTestHook());

      const hook = registry.get("mcp-toolkit:session:start:test-hook");
      expect(hook?.id).toBe("mcp-toolkit:session:start:test-hook");
    });

    it("returns undefined for non-existent hook", () => {
      expect(registry.get("non-existent")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("returns true for registered hook", () => {
      registry.register(createTestHook());
      expect(registry.has("mcp-toolkit:session:start:test-hook")).toBe(true);
    });

    it("returns false for non-existent hook", () => {
      expect(registry.has("non-existent")).toBe(false);
    });
  });

  describe("unregister", () => {
    it("removes registered hook", () => {
      registry.register(createTestHook());
      const removed = registry.unregister("mcp-toolkit:session:start:test-hook");

      expect(removed).toBe(true);
      expect(registry.has("mcp-toolkit:session:start:test-hook")).toBe(false);
    });

    it("returns false for non-existent hook", () => {
      expect(registry.unregister("non-existent")).toBe(false);
    });
  });

  describe("query", () => {
    beforeEach(() => {
      registry.registerAll([
        createTestHook({ tag: "session-start", type: "session", lifecycle: "start" }),
        createTestHook({ tag: "session-end", type: "session", lifecycle: "end" }),
        createTestHook({ tag: "action-start", type: "action", lifecycle: "start" }),
        createTestHook({ tag: "storage-mem", type: "storage", lifecycle: "start" }),
      ]);
    });

    it("returns all hooks with empty query", () => {
      const hooks = registry.query({});
      expect(hooks).toHaveLength(4);
    });

    it("filters by type", () => {
      const hooks = registry.query({ type: "session" });
      expect(hooks).toHaveLength(2);
      expect(hooks.every((h) => h.type === "session")).toBe(true);
    });

    it("filters by lifecycle", () => {
      const hooks = registry.query({ lifecycle: "start" });
      expect(hooks).toHaveLength(3);
      expect(hooks.every((h) => h.lifecycle === "start")).toBe(true);
    });

    it("filters by type and lifecycle", () => {
      const hooks = registry.query({ type: "session", lifecycle: "start" });
      expect(hooks).toHaveLength(1);
      expect(hooks[0]!.tag).toBe("session-start");
    });

    it("filters by tags", () => {
      registry.register(createTestHook({ tag: "tagged-hook", tags: ["important", "test"] }));

      const hooks = registry.query({ tags: ["important"] });
      expect(hooks).toHaveLength(1);
      expect(hooks[0]!.tags).toContain("important");
    });

    it("sorts by priority (higher first)", () => {
      registry.clear();
      registry.registerAll([
        createTestHook({ tag: "low", priority: 10 }),
        createTestHook({ tag: "high", priority: 100 }),
        createTestHook({ tag: "medium", priority: 50 }),
      ]);

      const hooks = registry.query({});
      expect(hooks.map((h) => h.tag)).toEqual(["high", "medium", "low"]);
    });
  });

  describe("conditions", () => {
    it("filters by requiresStorage", () => {
      registry.register(
        createTestHook({
          tag: "memory-hook",
          conditions: { requiresStorage: ["memory"] },
        })
      );

      // Without storage context, hook is excluded
      expect(registry.query({}).filter((h) => h.tag === "memory-hook")).toHaveLength(0);

      // With matching storage, hook is included
      const hooks = registry.query({ storage: "memory" });
      expect(hooks.some((h) => h.tag === "memory-hook")).toBe(true);
    });

    it("filters by requiresFeatures", () => {
      registry.register(
        createTestHook({
          tag: "sampling-hook",
          conditions: { requiresFeatures: ["sampling"] },
        })
      );

      // Without feature context, hook is excluded
      expect(registry.query({}).filter((h) => h.tag === "sampling-hook")).toHaveLength(0);

      // With matching feature, hook is included
      const hooks = registry.query({ feature: "sampling" });
      expect(hooks.some((h) => h.tag === "sampling-hook")).toBe(true);
    });

    it("filters by requiresConfig", () => {
      registry.register(
        createTestHook({
          tag: "config-hook",
          conditions: { requiresConfig: { debugMode: true, level: "verbose" } },
        })
      );

      // Without config context, hook is included (requiresConfig only checked when config provided)
      const hooksWithoutConfig = registry.query({});
      expect(hooksWithoutConfig.some((h) => h.tag === "config-hook")).toBe(true);

      // With matching config, hook is included
      const hooksWithMatch = registry.query({
        config: { debugMode: true, level: "verbose" },
      });
      expect(hooksWithMatch.some((h) => h.tag === "config-hook")).toBe(true);

      // With partial config match, hook is excluded
      const hooksPartialMatch = registry.query({
        config: { debugMode: true, level: "info" },
      });
      expect(hooksPartialMatch.some((h) => h.tag === "config-hook")).toBe(false);

      // With mismatched config, hook is excluded
      const hooksMismatch = registry.query({
        config: { debugMode: false },
      });
      expect(hooksMismatch.some((h) => h.tag === "config-hook")).toBe(false);
    });
  });

  describe("session and request filtering", () => {
    it("filters by sessionId - includes hooks without sessionId", () => {
      registry.register(createTestHook({ tag: "global-hook" }));
      registry.register(createTestHook({ tag: "session-hook", sessionId: "session-123" }));
      registry.register(createTestHook({ tag: "other-session-hook", sessionId: "session-456" }));

      const hooks = registry.query({ sessionId: "session-123" });

      // Should include global hook (no sessionId) and matching session hook
      expect(hooks.some((h) => h.tag === "global-hook")).toBe(true);
      expect(hooks.some((h) => h.tag === "session-hook")).toBe(true);
      // Should exclude hook with different sessionId
      expect(hooks.some((h) => h.tag === "other-session-hook")).toBe(false);
    });

    it("filters by requestId - includes hooks without requestId", () => {
      registry.register(createTestHook({ tag: "global-hook" }));
      registry.register(createTestHook({ tag: "request-hook", requestId: "req-abc" }));
      registry.register(createTestHook({ tag: "other-request-hook", requestId: "req-xyz" }));

      const hooks = registry.query({ requestId: "req-abc" });

      // Should include global hook (no requestId) and matching request hook
      expect(hooks.some((h) => h.tag === "global-hook")).toBe(true);
      expect(hooks.some((h) => h.tag === "request-hook")).toBe(true);
      // Should exclude hook with different requestId
      expect(hooks.some((h) => h.tag === "other-request-hook")).toBe(false);
    });

    it("filters by both sessionId and requestId", () => {
      registry.register(createTestHook({ tag: "global-hook" }));
      registry.register(
        createTestHook({
          tag: "scoped-hook",
          sessionId: "session-123",
          requestId: "req-abc",
        })
      );
      registry.register(
        createTestHook({
          tag: "wrong-session",
          sessionId: "session-other",
          requestId: "req-abc",
        })
      );

      const hooks = registry.query({ sessionId: "session-123", requestId: "req-abc" });

      expect(hooks.some((h) => h.tag === "global-hook")).toBe(true);
      expect(hooks.some((h) => h.tag === "scoped-hook")).toBe(true);
      expect(hooks.some((h) => h.tag === "wrong-session")).toBe(false);
    });
  });

  describe("all", () => {
    it("returns all registered hooks", () => {
      registry.registerAll([createTestHook({ tag: "hook-1" }), createTestHook({ tag: "hook-2" })]);

      expect(registry.all()).toHaveLength(2);
    });
  });

  describe("size", () => {
    it("returns count of registered hooks", () => {
      expect(registry.size()).toBe(0);

      registry.register(createTestHook({ tag: "hook-1" }));
      expect(registry.size()).toBe(1);

      registry.register(createTestHook({ tag: "hook-2" }));
      expect(registry.size()).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all hooks", () => {
      registry.registerAll([createTestHook({ tag: "hook-1" }), createTestHook({ tag: "hook-2" })]);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.all()).toEqual([]);
    });
  });
});
