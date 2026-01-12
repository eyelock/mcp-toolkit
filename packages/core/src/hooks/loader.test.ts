/**
 * Hook Content Loader Tests
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type HookContentLoader, createContentLoader } from "./loader.js";
import type { HookDefinition } from "./types.js";

describe("HookContentLoader", () => {
  let loader: HookContentLoader;
  let testDir: string;

  const createTestHook = (overrides: Partial<HookDefinition> = {}): HookDefinition => ({
    id: "mcp-toolkit:session:start:test-hook",
    app: "mcp-toolkit",
    tag: "test-hook",
    type: "session",
    lifecycle: "start",
    name: "Test Hook",
    requirementLevel: "SHOULD",
    priority: 50,
    tags: [],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `hook-loader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    loader = createContentLoader({ basePath: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("resolveContentPath", () => {
    it("resolves to tag.md in basePath by convention", () => {
      const hook = createTestHook({ tag: "welcome" });

      const contentPath = loader.resolveContentPath(hook);

      expect(contentPath).toBe(join(testDir, "welcome.md"));
    });

    it("uses explicit contentFile when provided", () => {
      const hook = createTestHook({
        tag: "welcome",
        contentFile: "content/welcome.md",
      });

      const contentPath = loader.resolveContentPath(hook);

      expect(contentPath).toBe(join(testDir, "content/welcome.md"));
    });
  });

  describe("load", () => {
    it("loads content from resolved path", async () => {
      const contentPath = join(testDir, "test-hook.md");
      await writeFile(contentPath, "# Hook Content\n\nThis is the content.");

      const hook = createTestHook();
      const resolved = await loader.load(hook);

      expect(resolved.content).toBe("# Hook Content\n\nThis is the content.");
      expect(resolved.contentPath).toBe(contentPath);
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("preserves all hook properties in resolved result", async () => {
      const contentPath = join(testDir, "custom-hook.md");
      await writeFile(contentPath, "content");

      const hook = createTestHook({
        tag: "custom-hook",
        priority: 100,
        tags: ["tag1", "tag2"],
      });
      const resolved = await loader.load(hook);

      expect(resolved.tag).toBe("custom-hook");
      expect(resolved.priority).toBe(100);
      expect(resolved.tags).toEqual(["tag1", "tag2"]);
    });

    it("throws when content file does not exist", async () => {
      const hook = createTestHook({ tag: "non-existent" });

      await expect(loader.load(hook)).rejects.toThrow();
    });

    it("caches loaded content by default", async () => {
      const contentPath = join(testDir, "test-hook.md");
      await writeFile(contentPath, "original content");

      const hook = createTestHook();

      // First load
      const first = await loader.load(hook);
      expect(first.content).toBe("original content");

      // Modify file
      await writeFile(contentPath, "modified content");

      // Second load returns cached
      const second = await loader.load(hook);
      expect(second.content).toBe("original content");
    });
  });

  describe("loadAll", () => {
    it("loads multiple hooks and tracks failures", async () => {
      await writeFile(join(testDir, "success.md"), "Success content");

      const hooks = [createTestHook({ tag: "success" }), createTestHook({ tag: "missing" })];

      const { resolved, failed } = await loader.loadAll(hooks);

      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.tag).toBe("success");
      expect(failed).toHaveLength(1);
      expect(failed[0]!.hook.tag).toBe("missing");
      expect(failed[0]!.error).toBeDefined();
    });

    it("handles non-Error thrown values", async () => {
      const hook = createTestHook({ tag: "throw-string" });

      // Mock load to throw a non-Error value
      vi.spyOn(loader, "load").mockRejectedValueOnce("string error thrown");

      const { resolved, failed } = await loader.loadAll([hook]);

      expect(resolved).toHaveLength(0);
      expect(failed).toHaveLength(1);
      expect(failed[0]!.error).toBe("string error thrown");
    });
  });

  describe("loadInline", () => {
    it("creates resolved hook from inline content", () => {
      const hook = createTestHook();
      const resolved = loader.loadInline(hook, "# Inline Content");

      expect(resolved.content).toBe("# Inline Content");
      expect(resolved.contentPath).toBeUndefined();
      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  describe("cache management", () => {
    it("clearCache clears all cached content", async () => {
      const contentPath = join(testDir, "test-hook.md");
      await writeFile(contentPath, "original content");

      const hook = createTestHook();

      // Load and cache
      await loader.load(hook);
      expect(loader.cacheSize()).toBe(1);

      // Clear cache
      loader.clearCache();
      expect(loader.cacheSize()).toBe(0);

      // Modify file and reload
      await writeFile(contentPath, "modified content");
      const reloaded = await loader.load(hook);
      expect(reloaded.content).toBe("modified content");
    });

    it("disables cache when cache option is false", async () => {
      const loaderNoCache = createContentLoader({ basePath: testDir, cache: false });
      const contentPath = join(testDir, "test-hook.md");
      await writeFile(contentPath, "original content");

      const hook = createTestHook();

      // First load
      await loaderNoCache.load(hook);

      // Modify file
      await writeFile(contentPath, "modified content");

      // Second load returns new content
      const second = await loaderNoCache.load(hook);
      expect(second.content).toBe("modified content");
    });
  });
});
