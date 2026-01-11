/**
 * MCP Toolkit Hooks Module Tests
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  coreHookDefinitions,
  createCoreHookRegistry,
  extendCoreHooks,
  getCoreHook,
  getHooksContentPath,
  getSessionEndContent,
  getSessionStartContent,
  loadCoreHooks,
  sessionEndCoreHook,
  sessionStartCoreHook,
} from "./index.js";

describe("MCP Toolkit Hooks Module", () => {
  describe("Hook Definitions", () => {
    it("exports session start core hook definition", () => {
      expect(sessionStartCoreHook).toBeDefined();
      expect(sessionStartCoreHook.tag).toBe("session-start-core");
      expect(sessionStartCoreHook.type).toBe("session");
      expect(sessionStartCoreHook.lifecycle).toBe("start");
      expect(sessionStartCoreHook.requirementLevel).toBe("MUST");
    });

    it("exports session end core hook definition", () => {
      expect(sessionEndCoreHook).toBeDefined();
      expect(sessionEndCoreHook.tag).toBe("session-end-core");
      expect(sessionEndCoreHook.type).toBe("session");
      expect(sessionEndCoreHook.lifecycle).toBe("end");
      expect(sessionEndCoreHook.requirementLevel).toBe("SHOULD");
    });

    it("exports all core hook definitions array", () => {
      expect(coreHookDefinitions).toHaveLength(2);
      expect(coreHookDefinitions).toContain(sessionStartCoreHook);
      expect(coreHookDefinitions).toContain(sessionEndCoreHook);
    });
  });

  describe("getHooksContentPath", () => {
    it("returns path to content directory", () => {
      const contentPath = getHooksContentPath();
      expect(contentPath).toContain("content");
      expect(contentPath).toContain("hooks");
    });

    it("returns same path as module directory + content", () => {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const expectedPath = join(__dirname, "content");
      expect(getHooksContentPath()).toBe(expectedPath);
    });
  });

  describe("createCoreHookRegistry", () => {
    it("creates registry with core hooks pre-registered", () => {
      const registry = createCoreHookRegistry();
      expect(registry.size()).toBe(2);
    });

    it("has session start hook registered", () => {
      const registry = createCoreHookRegistry();
      expect(registry.has("mcp-toolkit:session:start:session-start-core")).toBe(true);
    });

    it("has session end hook registered", () => {
      const registry = createCoreHookRegistry();
      expect(registry.has("mcp-toolkit:session:end:session-end-core")).toBe(true);
    });

    it("can query session start hooks", () => {
      const registry = createCoreHookRegistry();
      const hooks = registry.query({ type: "session", lifecycle: "start" });
      expect(hooks).toHaveLength(1);
      expect(hooks[0]!.name).toBe("Session Initialization");
    });
  });

  describe("loadCoreHooks", () => {
    it("loads session start hooks", async () => {
      const result = await loadCoreHooks("session", "start");
      expect(result.hooks).toHaveLength(1);
      expect(result.content).toContain("Session Initialization");
    });

    it("loads session end hooks", async () => {
      const result = await loadCoreHooks("session", "end");
      expect(result.hooks).toHaveLength(1);
      expect(result.content).toContain("Session Completion");
    });

    it("returns empty for non-matching lifecycle", async () => {
      const result = await loadCoreHooks("session", "running");
      expect(result.hooks).toHaveLength(0);
    });

    it("accepts custom registry", async () => {
      const registry = createCoreHookRegistry();
      // Unregister the start hook
      registry.unregister("mcp-toolkit:session:start:session-start-core");

      const result = await loadCoreHooks("session", "start", { registry });
      expect(result.hooks).toHaveLength(0);
    });
  });

  describe("getSessionStartContent", () => {
    it("returns session start guidance content", async () => {
      const content = await getSessionStartContent();
      expect(content).toContain("RFC 2119");
      expect(content).toContain("MUST");
    });
  });

  describe("getSessionEndContent", () => {
    it("returns session end guidance content", async () => {
      const content = await getSessionEndContent();
      expect(content).toContain("Session Completion");
    });
  });

  describe("extendCoreHooks", () => {
    it("adds additional hooks to registry", () => {
      const registry = extendCoreHooks([
        {
          tag: "custom-hook",
          type: "session",
          lifecycle: "running",
          name: "Custom Hook",
          requirementLevel: "MAY",
        },
      ]);

      expect(registry.size()).toBe(3);
      expect(registry.has("mcp-toolkit:session:running:custom-hook")).toBe(true);
    });

    it("accepts existing registry", () => {
      const registry = createCoreHookRegistry();
      const extended = extendCoreHooks(
        [
          {
            tag: "another-hook",
            type: "action",
            lifecycle: "start",
            name: "Another Hook",
            requirementLevel: "SHOULD",
          },
        ],
        registry
      );

      expect(extended).toBe(registry);
      expect(extended.size()).toBe(3);
    });
  });

  describe("getCoreHook", () => {
    it("returns session start hook by tag", () => {
      const hook = getCoreHook("session-start-core");
      expect(hook).toBeDefined();
      expect(hook!.name).toBe("Session Initialization");
    });

    it("returns session end hook by tag", () => {
      const hook = getCoreHook("session-end-core");
      expect(hook).toBeDefined();
      expect(hook!.name).toBe("Session Completion");
    });

    it("returns undefined for non-existent tag", () => {
      const hook = getCoreHook("non-existent");
      expect(hook).toBeUndefined();
    });
  });
});
