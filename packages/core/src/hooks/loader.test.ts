/**
 * Hook Content Loader Tests
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HookContentLoader, createContentLoader, getModuleDir } from "./loader.js";
import type { HookDefinition } from "./types.js";

describe("HookContentLoader", () => {
  let loader: HookContentLoader;
  let testDir: string;

  const createTestHook = (overrides: Partial<HookDefinition> = {}): HookDefinition => ({
    id: "test:hook",
    type: "session",
    lifecycle: "start",
    name: "Test Hook",
    priority: 100,
    dependencies: [],
    blocking: false,
    tags: [],
    ...overrides,
  });

  beforeEach(async () => {
    loader = createContentLoader();
    testDir = join(tmpdir(), `hook-loader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("resolveContentPath", () => {
    it("resolves to adjacent .md file by convention", () => {
      const hook = createTestHook();
      const definitionPath = "/path/to/hooks/session-start.ts";

      const contentPath = loader.resolveContentPath(hook, definitionPath);

      expect(contentPath).toBe("/path/to/hooks/session-start.md");
    });

    it("uses explicit contentFile when provided", () => {
      const hook = createTestHook({ contentFile: "content/start.md" });
      const definitionPath = "/path/to/hooks/index.ts";

      const contentPath = loader.resolveContentPath(hook, definitionPath);

      expect(contentPath).toBe("/path/to/hooks/content/start.md");
    });

    it("respects basePath option for explicit contentFile", () => {
      const loaderWithBase = createContentLoader({ basePath: "/custom/base" });
      const hook = createTestHook({ contentFile: "session/start.md" });
      const definitionPath = "/path/to/hooks/index.ts";

      const contentPath = loaderWithBase.resolveContentPath(hook, definitionPath);

      expect(contentPath).toBe("/custom/base/session/start.md");
    });

    it("handles various file extensions", () => {
      const hook = createTestHook();

      expect(loader.resolveContentPath(hook, "/path/file.ts")).toBe("/path/file.md");
      expect(loader.resolveContentPath(hook, "/path/file.js")).toBe("/path/file.md");
      expect(loader.resolveContentPath(hook, "/path/file.mts")).toBe("/path/file.md");
    });
  });

  describe("load", () => {
    it("loads content from resolved path", async () => {
      const contentPath = join(testDir, "hook.md");
      const definitionPath = join(testDir, "hook.ts");
      await writeFile(contentPath, "# Hook Content\n\nThis is the content.");

      const hook = createTestHook();
      const resolved = await loader.load(hook, definitionPath);

      expect(resolved.content).toBe("# Hook Content\n\nThis is the content.");
      expect(resolved.contentPath).toBe(contentPath);
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("preserves all hook properties in resolved result", async () => {
      const contentPath = join(testDir, "hook.md");
      const definitionPath = join(testDir, "hook.ts");
      await writeFile(contentPath, "content");

      const hook = createTestHook({
        id: "custom:hook",
        priority: 50,
        tags: ["tag1", "tag2"],
      });

      const resolved = await loader.load(hook, definitionPath);

      expect(resolved.id).toBe("custom:hook");
      expect(resolved.priority).toBe(50);
      expect(resolved.tags).toEqual(["tag1", "tag2"]);
    });

    it("throws for non-existent content file", async () => {
      const hook = createTestHook();
      const definitionPath = join(testDir, "non-existent.ts");

      await expect(loader.load(hook, definitionPath)).rejects.toThrow();
    });

    it("caches content by default", async () => {
      const contentPath = join(testDir, "hook.md");
      const definitionPath = join(testDir, "hook.ts");
      await writeFile(contentPath, "original content");

      const hook = createTestHook();

      // First load
      const first = await loader.load(hook, definitionPath);
      expect(first.content).toBe("original content");

      // Modify file
      await writeFile(contentPath, "modified content");

      // Second load should return cached content
      const second = await loader.load(hook, definitionPath);
      expect(second.content).toBe("original content");
    });

    it("respects cache option when disabled", async () => {
      const loaderNoCache = createContentLoader({ cache: false });
      const contentPath = join(testDir, "hook.md");
      const definitionPath = join(testDir, "hook.ts");
      await writeFile(contentPath, "original content");

      const hook = createTestHook();

      // First load
      const first = await loaderNoCache.load(hook, definitionPath);
      expect(first.content).toBe("original content");

      // Modify file
      await writeFile(contentPath, "modified content");

      // Second load should return new content
      const second = await loaderNoCache.load(hook, definitionPath);
      expect(second.content).toBe("modified content");
    });
  });

  describe("loadAll", () => {
    it("loads multiple hooks in parallel", async () => {
      await writeFile(join(testDir, "hook1.md"), "Content 1");
      await writeFile(join(testDir, "hook2.md"), "Content 2");
      await writeFile(join(testDir, "hook3.md"), "Content 3");

      const hooks = [
        { hook: createTestHook({ id: "hook:1" }), definitionPath: join(testDir, "hook1.ts") },
        { hook: createTestHook({ id: "hook:2" }), definitionPath: join(testDir, "hook2.ts") },
        { hook: createTestHook({ id: "hook:3" }), definitionPath: join(testDir, "hook3.ts") },
      ];

      const resolved = await loader.loadAll(hooks);

      expect(resolved).toHaveLength(3);
      expect(resolved[0]!.content).toBe("Content 1");
      expect(resolved[1]!.content).toBe("Content 2");
      expect(resolved[2]!.content).toBe("Content 3");
    });

    it("returns empty array for empty input", async () => {
      const resolved = await loader.loadAll([]);
      expect(resolved).toEqual([]);
    });
  });

  describe("loadInline", () => {
    it("creates resolved hook from inline content", () => {
      const hook = createTestHook();
      const content = "# Inline Content\n\nThis was provided directly.";

      const resolved = loader.loadInline(hook, content);

      expect(resolved.content).toBe(content);
      expect(resolved.contentPath).toBeUndefined();
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("preserves all hook properties", () => {
      const hook = createTestHook({
        id: "inline:hook",
        blocking: true,
      });

      const resolved = loader.loadInline(hook, "content");

      expect(resolved.id).toBe("inline:hook");
      expect(resolved.blocking).toBe(true);
    });
  });

  describe("cache management", () => {
    it("reports cache size", async () => {
      await writeFile(join(testDir, "hook1.md"), "Content 1");
      await writeFile(join(testDir, "hook2.md"), "Content 2");

      expect(loader.cacheSize()).toBe(0);

      await loader.load(createTestHook(), join(testDir, "hook1.ts"));
      expect(loader.cacheSize()).toBe(1);

      await loader.load(createTestHook(), join(testDir, "hook2.ts"));
      expect(loader.cacheSize()).toBe(2);
    });

    it("clears cache", async () => {
      await writeFile(join(testDir, "hook.md"), "Content");
      await loader.load(createTestHook(), join(testDir, "hook.ts"));

      expect(loader.cacheSize()).toBe(1);

      loader.clearCache();

      expect(loader.cacheSize()).toBe(0);
    });
  });
});

describe("createContentLoader", () => {
  it("creates loader with default options", () => {
    const loader = createContentLoader();
    expect(loader).toBeInstanceOf(HookContentLoader);
  });

  it("creates loader with custom options", () => {
    const loader = createContentLoader({
      basePath: "/custom",
      cache: false,
    });
    expect(loader).toBeInstanceOf(HookContentLoader);
  });
});

describe("getModuleDir", () => {
  it("extracts directory from import.meta.url", () => {
    const url = "file:///path/to/module/index.ts";
    const dir = getModuleDir(url);
    expect(dir).toBe("/path/to/module");
  });

  it("handles nested paths", () => {
    const url = "file:///deep/nested/path/to/hooks/session.ts";
    const dir = getModuleDir(url);
    expect(dir).toBe("/deep/nested/path/to/hooks");
  });
});
