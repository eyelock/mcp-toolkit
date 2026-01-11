/**
 * Hook Composer Tests
 */

import { describe, expect, it } from "vitest";
import { composeHooks, createComposer } from "./composer.js";
import type { ResolvedHook } from "./types.js";

describe("HookComposer", () => {
  const createResolvedHook = (overrides: Partial<ResolvedHook> = {}): ResolvedHook => ({
    id: "mcp-toolkit:session:start:test-hook",
    app: "mcp-toolkit",
    tag: "test-hook",
    type: "session",
    lifecycle: "start",
    name: "Test Hook",
    requirementLevel: "SHOULD",
    priority: 50,
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
      expect(result.includedHooks).toEqual([]);
      expect(result.skippedHooks).toEqual([]);
      expect(result.failedHooks).toEqual([]);
      expect(result.notices).toEqual([]);
      expect(result.composedAt).toBeDefined();
    });

    it("groups hooks by requirement level", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          tag: "may-hook",
          name: "May Hook",
          requirementLevel: "MAY",
          content: "May content",
        }),
        createResolvedHook({
          tag: "must-hook",
          name: "Must Hook",
          requirementLevel: "MUST",
          content: "Must content",
        }),
        createResolvedHook({
          tag: "should-hook",
          name: "Should Hook",
          requirementLevel: "SHOULD",
          content: "Should content",
        }),
      ];

      const result = composer.compose(hooks);

      // MUST should come first, then SHOULD, then MAY
      expect(result.content).toMatch(
        /## MUST[\s\S]*Must content[\s\S]*## SHOULD[\s\S]*Should content[\s\S]*## MAY[\s\S]*May content/
      );
    });

    it("includes RFC 2119 reference by default", () => {
      const composer = createComposer();
      const hooks = [createResolvedHook()];

      const result = composer.compose(hooks);

      expect(result.content).toContain("RFC 2119");
    });

    it("excludes RFC 2119 reference when disabled", () => {
      const composer = createComposer({ includeRfc2119Reference: false });
      const hooks = [createResolvedHook()];

      const result = composer.compose(hooks);

      expect(result.content).not.toContain("RFC 2119");
    });

    it("includes section preambles by default", () => {
      const composer = createComposer();
      const hooks = [createResolvedHook({ requirementLevel: "MUST", content: "Must content" })];

      const result = composer.compose(hooks);

      expect(result.content).toContain("absolute requirements");
    });

    it("excludes section preambles when disabled", () => {
      const composer = createComposer({ includePreambles: false });
      const hooks = [createResolvedHook({ requirementLevel: "MUST", content: "Must content" })];

      const result = composer.compose(hooks);

      expect(result.content).not.toContain("absolute requirements");
    });

    it("sorts hooks by priority within requirement level (higher first)", () => {
      const composer = createComposer({ includePreambles: false });
      const hooks = [
        createResolvedHook({
          tag: "low",
          name: "Low Priority",
          requirementLevel: "SHOULD",
          priority: 10,
          content: "Low content",
        }),
        createResolvedHook({
          tag: "high",
          name: "High Priority",
          requirementLevel: "SHOULD",
          priority: 100,
          content: "High content",
        }),
        createResolvedHook({
          tag: "medium",
          name: "Medium Priority",
          requirementLevel: "SHOULD",
          priority: 50,
          content: "Medium content",
        }),
      ];

      const result = composer.compose(hooks);

      // High priority should come first within SHOULD section
      const shouldSection = result.content.split("## SHOULD")[1];
      expect(shouldSection!.indexOf("High Priority")).toBeLessThan(
        shouldSection!.indexOf("Medium Priority")
      );
      expect(shouldSection!.indexOf("Medium Priority")).toBeLessThan(
        shouldSection!.indexOf("Low Priority")
      );
    });

    it("includes hook names as subsection headers", () => {
      const composer = createComposer({ includePreambles: false });
      const hooks = [
        createResolvedHook({
          name: "My Custom Hook",
          requirementLevel: "SHOULD",
          content: "Hook content",
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.content).toContain("### My Custom Hook");
    });

    it("tracks included hooks in result", () => {
      const composer = createComposer();
      const hooks = [
        createResolvedHook({
          tag: "hook-1",
          name: "Hook One",
          requirementLevel: "MUST",
        }),
        createResolvedHook({
          tag: "hook-2",
          name: "Hook Two",
          requirementLevel: "SHOULD",
        }),
      ];

      const result = composer.compose(hooks);

      expect(result.includedHooks).toHaveLength(2);
      expect(result.includedHooks[0]!.name).toBe("Hook One");
      expect(result.includedHooks[0]!.requirementLevel).toBe("MUST");
      expect(result.includedHooks[1]!.name).toBe("Hook Two");
    });
  });

  describe("composeWithTransparency", () => {
    it("tracks skipped hooks with reasons", () => {
      const composer = createComposer();
      const resolved = [createResolvedHook()];
      const skipped = [
        {
          hook: {
            id: "skipped:hook",
            name: "Skipped Hook",
            requirementLevel: "SHOULD" as const,
            priority: 50,
          },
          reason: "requires storage: memory",
        },
      ];

      const result = composer.composeWithTransparency(resolved, skipped, []);

      expect(result.skippedHooks).toHaveLength(1);
      expect(result.skippedHooks[0]!.skipReason).toBe("requires storage: memory");
      expect(result.notices).toContain(
        "1 hook(s) were skipped (conditions not met): Skipped Hook (requires storage: memory)"
      );
    });

    it("tracks failed hooks with errors", () => {
      const composer = createComposer();
      const resolved = [createResolvedHook()];
      const failed = [
        {
          hook: {
            id: "failed:hook",
            name: "Failed Hook",
            requirementLevel: "SHOULD" as const,
            priority: 50,
          },
          error: "File not found",
        },
      ];

      const result = composer.composeWithTransparency(resolved, [], failed);

      expect(result.failedHooks).toHaveLength(1);
      expect(result.failedHooks[0]!.error).toBe("File not found");
      expect(result.notices).toContain("1 hook(s) failed to load: Failed Hook (File not found)");
    });
  });

  describe("composeHooks convenience function", () => {
    it("uses default options", () => {
      const hooks = [createResolvedHook({ requirementLevel: "MUST", content: "Content" })];

      const result = composeHooks(hooks);

      expect(result.content).toContain("RFC 2119");
      expect(result.content).toContain("## MUST");
    });
  });
});
