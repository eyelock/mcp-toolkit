import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  HookRegistry,
  type WorkflowStateTracker,
  createWorkflowStateTracker,
} from "@mcp-toolkit/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONFIG_HOOK_ID,
  allToolkitHooks,
  buildHook,
  composeToolkitHooks,
  configHook,
  createToolkitRegistry,
  getContentPath,
  getToolkitComponents,
  getToolkitHandlers,
  isToolkitConfigured,
  markToolkitConfigured,
  modelHook,
  planHook,
  registerToolkit,
  registerToolkitBlocking,
  registerToolkitHooks,
  resolveToolkitHooks,
  reviewHook,
  toolkitBlockingHooks,
} from "./index.js";

describe("@mcp-toolkit/toolkit", () => {
  describe("Hook Definitions", () => {
    it("should export all 5 workflow hooks", () => {
      expect(allToolkitHooks).toHaveLength(5);
    });

    it("should have config hook with blocking=true", () => {
      expect(configHook.blocking).toBe(true);
    });

    it("should have other hooks depending on config", () => {
      expect(modelHook.dependencies).toContain(CONFIG_HOOK_ID);
      expect(planHook.dependencies).toContain(CONFIG_HOOK_ID);
      expect(buildHook.dependencies).toContain(CONFIG_HOOK_ID);
      expect(reviewHook.dependencies).toContain(CONFIG_HOOK_ID);
    });

    it("should have correct lifecycle phases", () => {
      expect(configHook.lifecycle).toBe("start");
      expect(modelHook.lifecycle).toBe("start");
      expect(planHook.lifecycle).toBe("running");
      expect(buildHook.lifecycle).toBe("running");
      expect(reviewHook.lifecycle).toBe("end");
    });

    it("should have correct requirement levels", () => {
      expect(configHook.requirementLevel).toBe("MUST");
      expect(modelHook.requirementLevel).toBe("SHOULD");
      expect(planHook.requirementLevel).toBe("SHOULD");
      expect(buildHook.requirementLevel).toBe("MAY");
      expect(reviewHook.requirementLevel).toBe("SHOULD");
    });
  });

  describe("createToolkitRegistry", () => {
    it("should create a registry with all toolkit hooks", () => {
      const registry = createToolkitRegistry();

      expect(registry.size()).toBe(5);
      expect(registry.has(CONFIG_HOOK_ID)).toBe(true);
    });
  });

  describe("registerToolkitHooks", () => {
    it("should register hooks with an existing registry", () => {
      const registry = new HookRegistry();
      expect(registry.size()).toBe(0);

      registerToolkitHooks(registry);
      expect(registry.size()).toBe(5);
    });
  });

  describe("Blocking Hook Definitions", () => {
    it("should have blocking hook for config", () => {
      expect(toolkitBlockingHooks).toHaveLength(1);
      expect(toolkitBlockingHooks[0].hookId).toBe(CONFIG_HOOK_ID);
      expect(toolkitBlockingHooks[0].toolPrefix).toBe("toolkit:");
    });
  });

  describe("registerToolkitBlocking", () => {
    let tracker: WorkflowStateTracker;

    beforeEach(() => {
      tracker = createWorkflowStateTracker();
    });

    it("should register blocking hooks with tracker", () => {
      registerToolkitBlocking(tracker);

      // Should block toolkit tools
      const result = tracker.checkToolAllowed("toolkit:build_model");
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe(CONFIG_HOOK_ID);
    });

    it("should register blocking hooks without tracker using default", () => {
      // Call without tracker - uses default registerBlockingHook
      registerToolkitBlocking();
      // No assertion needed - just verifying the code path runs without error
    });
  });

  describe("isToolkitConfigured / markToolkitConfigured", () => {
    let tracker: WorkflowStateTracker;

    beforeEach(() => {
      tracker = createWorkflowStateTracker();
      registerToolkitBlocking(tracker);
    });

    it("should return false before config is marked", () => {
      expect(isToolkitConfigured(tracker)).toBe(false);
    });

    it("should return true after config is marked", () => {
      markToolkitConfigured(tracker, { projectName: "test-project" });
      expect(isToolkitConfigured(tracker)).toBe(true);
    });

    it("should unblock toolkit tools after config", () => {
      // Initially blocked
      expect(tracker.checkToolAllowed("toolkit:test").allowed).toBe(false);

      // Mark configured
      markToolkitConfigured(tracker, { projectName: "test" });

      // Now allowed
      expect(tracker.checkToolAllowed("toolkit:test").allowed).toBe(true);
    });
  });

  describe("getContentPath", () => {
    it("should return a path that exists", () => {
      const contentPath = getContentPath();
      expect(existsSync(contentPath)).toBe(true);
    });

    it("should contain markdown files", () => {
      const contentPath = getContentPath();
      expect(existsSync(join(contentPath, "config.md"))).toBe(true);
      expect(existsSync(join(contentPath, "model.md"))).toBe(true);
      expect(existsSync(join(contentPath, "plan.md"))).toBe(true);
      expect(existsSync(join(contentPath, "build.md"))).toBe(true);
      expect(existsSync(join(contentPath, "review.md"))).toBe(true);
    });
  });

  describe("resolveToolkitHooks", () => {
    it("should resolve all hooks with content", async () => {
      const resolved = await resolveToolkitHooks();

      expect(resolved).toHaveLength(5);
      for (const hook of resolved) {
        expect(hook.content).toBeDefined();
        expect(hook.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe("composeToolkitHooks", () => {
    it("should compose hooks into a single result", async () => {
      const result = await composeToolkitHooks();

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.includedHooks).toHaveLength(5);
    });

    it("should group by requirement level", async () => {
      const result = await composeToolkitHooks();

      // Should have MUST section (config)
      expect(result.content).toContain("## MUST");
      // Should have SHOULD section (model, plan, review)
      expect(result.content).toContain("## SHOULD");
      // Should have MAY section (build)
      expect(result.content).toContain("## MAY");
    });
  });

  describe("getToolkitHandlers", () => {
    it("should return all handler functions", () => {
      const handlers = getToolkitHandlers();

      expect(handlers.isToolkitTool).toBeDefined();
      expect(typeof handlers.isToolkitTool).toBe("function");
      expect(handlers.handleToolCall).toBeDefined();
      expect(typeof handlers.handleToolCall).toBe("function");
      expect(handlers.isToolkitResource).toBeDefined();
      expect(typeof handlers.isToolkitResource).toBe("function");
      expect(handlers.handleResourceRead).toBeDefined();
      expect(typeof handlers.handleResourceRead).toBe("function");
      expect(handlers.isToolkitPrompt).toBeDefined();
      expect(typeof handlers.isToolkitPrompt).toBe("function");
      expect(handlers.handlePrompt).toBeDefined();
      expect(typeof handlers.handlePrompt).toBe("function");
    });

    it("should have working isToolkitTool handler", () => {
      const handlers = getToolkitHandlers();
      expect(handlers.isToolkitTool("toolkit:model:design")).toBe(true);
      expect(handlers.isToolkitTool("other:tool")).toBe(false);
    });

    it("should have working isToolkitResource handler", () => {
      const handlers = getToolkitHandlers();
      expect(handlers.isToolkitResource("toolkit://model")).toBe(true);
      expect(handlers.isToolkitResource("other://resource")).toBe(false);
    });

    it("should have working isToolkitPrompt handler", () => {
      const handlers = getToolkitHandlers();
      expect(handlers.isToolkitPrompt("toolkit-design-start")).toBe(true);
      expect(handlers.isToolkitPrompt("other-prompt")).toBe(false);
    });
  });

  describe("registerToolkit", () => {
    it("should return components and handlers", () => {
      const result = registerToolkit();

      expect(result.components).toBeDefined();
      expect(result.handlers).toBeDefined();
    });

    it("should have matching components from getToolkitComponents", () => {
      const result = registerToolkit();
      const components = getToolkitComponents();

      expect(result.components.tools).toEqual(components.tools);
      expect(result.components.resources).toEqual(components.resources);
      expect(result.components.prompts).toEqual(components.prompts);
    });

    it("should have matching handlers from getToolkitHandlers", () => {
      const result = registerToolkit();
      const handlers = getToolkitHandlers();

      // Check that the functions are the same
      expect(result.handlers.isToolkitTool.toString()).toBe(handlers.isToolkitTool.toString());
      expect(result.handlers.handleToolCall.toString()).toBe(handlers.handleToolCall.toString());
    });
  });
});
