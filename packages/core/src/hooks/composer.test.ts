/**
 * Hook Composer Tests
 */

import { describe, expect, it } from "vitest";
import { HookComposer, createComposer, composeHooks } from "./composer.js";
import type { ResolvedHook } from "./types.js";

describe("HookComposer", () => {
  const createResolvedHook = (overrides: Partial<ResolvedHook> = {}): ResolvedHook => ({
    id: "test:hook",
    type: "session",
    lifecycle: "start",
    name: "Test Hook",
    priority: 100,
    dependencies: [],
    blocking: false,
    tags: [],
    content: "Test content",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  });

  describe("compose", () => {
    it("returns empty result for empty input", () => {
      const composer = createComposer();
      const result = composer.compose([]);

      expect(result.content).toBe("");
      expect(result.hooks).toEqual([]);
      expect(result.blockingHooks).toEqual([]);
      expect(result.composedAt).toBeDefined();
    });

    it("composes single hook", () => {
      const composer = createComposer();
      const hook = createResolvedHook({
        id: "single:hook",
        name: "Single Hook",
        content: "# Single Hook Content",
      });

      const result = composer.compose([hook]);

      expect(result.content).toBe("# Single Hook Content");
      expect(result.hooks).toHaveLength(1);
      expect(result.hooks[0]!.id).toBe("single:hook");
    });

    it("joins multiple hooks with separator", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({ id: "hook:1", content: "Content 1", priority: 10 }),
        createResolvedHook({ id: "hook:2", content: "Content 2", priority: 20 }),
        createResolvedHook({ id: "hook:3", content: "Content 3", priority: 30 }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toBe("Content 1\n\nContent 2\n\nContent 3");
      expect(result.hooks).toHaveLength(3);
    });

    it("respects custom separator", () => {
      const composer = createComposer({ separator: "\n---\n" });
      const hooks = [
        createResolvedHook({ id: "hook:1", content: "Content 1", priority: 10 }),
        createResolvedHook({ id: "hook:2", content: "Content 2", priority: 20 }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toBe("Content 1\n---\nContent 2");
    });

    it("sorts hooks by priority", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({ id: "low", content: "Low", priority: 100 }),
        createResolvedHook({ id: "high", content: "High", priority: 10 }),
        createResolvedHook({ id: "medium", content: "Medium", priority: 50 }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toBe("High\n\nMedium\n\nLow");
      expect(result.hooks.map((h) => h.id)).toEqual(["high", "medium", "low"]);
    });

    it("identifies blocking hooks", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({ id: "normal", blocking: false, priority: 10 }),
        createResolvedHook({ id: "blocker1", blocking: true, priority: 20 }),
        createResolvedHook({ id: "blocker2", blocking: true, priority: 30 }),
      ];

      const result = composer.compose(hooks);

      expect(result.blockingHooks).toEqual(["blocker1", "blocker2"]);
    });

    it("includes headers when enabled", () => {
      const composer = createComposer({ includeHeaders: true });
      const hooks = [
        createResolvedHook({
          id: "hook:1",
          name: "First Hook",
          content: "First content",
          priority: 10,
        }),
        createResolvedHook({
          id: "hook:2",
          name: "Second Hook",
          content: "Second content",
          priority: 20,
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toContain("## First Hook");
      expect(result.content).toContain("First content");
      expect(result.content).toContain("## Second Hook");
    });

    it("uses custom header format", () => {
      const composer = createComposer({
        includeHeaders: true,
        headerFormat: "<!-- {id} ({priority}) -->",
      });
      const hooks = [
        createResolvedHook({
          id: "custom:hook",
          name: "Custom",
          content: "Content",
          priority: 42,
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toContain("<!-- custom:hook (42) -->");
    });
  });

  describe("dependency ordering", () => {
    it("places dependencies before dependents", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "dependent",
          content: "Dependent",
          priority: 10,
          dependencies: ["base"],
        }),
        createResolvedHook({
          id: "base",
          content: "Base",
          priority: 20,
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toBe("Base\n\nDependent");
    });

    it("handles chain of dependencies", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "level3",
          content: "Level 3",
          priority: 10,
          dependencies: ["level2"],
        }),
        createResolvedHook({
          id: "level1",
          content: "Level 1",
          priority: 30,
        }),
        createResolvedHook({
          id: "level2",
          content: "Level 2",
          priority: 20,
          dependencies: ["level1"],
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toBe("Level 1\n\nLevel 2\n\nLevel 3");
    });

    it("throws on circular dependencies", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "a",
          content: "A",
          dependencies: ["b"],
        }),
        createResolvedHook({
          id: "b",
          content: "B",
          dependencies: ["a"],
        }),
      ];

      expect(() => composer.compose(hooks)).toThrow("Circular dependency");
    });

    it("throws on self-dependency", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "self",
          content: "Self",
          dependencies: ["self"],
        }),
      ];

      expect(() => composer.compose(hooks)).toThrow("Circular dependency");
    });

    it("silently ignores missing dependencies", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "hook",
          content: "Content",
          dependencies: ["non-existent"],
        }),
      ];

      // Should not throw
      const result = composer.compose(hooks);
      expect(result.hooks).toHaveLength(1);
    });

    it("combines dependency and priority ordering", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "high-priority-dep",
          content: "High Dep",
          priority: 5,
          dependencies: ["base"],
        }),
        createResolvedHook({
          id: "low-priority-nodep",
          content: "Low NoDep",
          priority: 100,
        }),
        createResolvedHook({
          id: "base",
          content: "Base",
          priority: 50,
        }),
      ];

      const result = composer.compose(hooks);

      // base must come before high-priority-dep despite lower priority
      const order = result.hooks.map((h) => h.id);
      expect(order.indexOf("base")).toBeLessThan(order.indexOf("high-priority-dep"));
    });
  });

  describe("result metadata", () => {
    it("includes hook summary in result", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          id: "test:hook",
          name: "Test Hook",
          priority: 42,
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.hooks[0]).toEqual({
        id: "test:hook",
        name: "Test Hook",
        priority: 42,
      });
    });

    it("includes valid timestamp", () => {
      const composer = createComposer();
      const before = new Date().toISOString();
      const result = composer.compose([]);
      const after = new Date().toISOString();

      expect(result.composedAt >= before).toBe(true);
      expect(result.composedAt <= after).toBe(true);
    });
  });
});

describe("createComposer", () => {
  it("creates composer with default options", () => {
    const composer = createComposer();
    expect(composer).toBeInstanceOf(HookComposer);
  });

  it("creates composer with custom options", () => {
    const composer = createComposer({
      separator: "---",
      includeHeaders: true,
      headerFormat: "### {name}",
    });
    expect(composer).toBeInstanceOf(HookComposer);
  });
});

describe("composeHooks", () => {
  it("composes hooks with default options", () => {
    const hooks = [
      {
        id: "hook:1",
        type: "session" as const,
        lifecycle: "start" as const,
        name: "Hook One",
        priority: 10,
        dependencies: [],
        blocking: false,
        tags: [],
        content: "Content 1",
        resolvedAt: new Date().toISOString(),
      },
      {
        id: "hook:2",
        type: "session" as const,
        lifecycle: "start" as const,
        name: "Hook Two",
        priority: 20,
        dependencies: [],
        blocking: false,
        tags: [],
        content: "Content 2",
        resolvedAt: new Date().toISOString(),
      },
    ];

    const result = composeHooks(hooks);

    expect(result.content).toBe("Content 1\n\nContent 2");
    expect(result.hooks).toHaveLength(2);
  });
});
