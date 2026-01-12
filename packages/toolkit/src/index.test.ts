import { describe, it, expect, beforeEach } from "vitest";
import {
  createToolkitRegistry,
  registerToolkitHooks,
  registerToolkitBlocking,
  resolveToolkitHooks,
  composeToolkitHooks,
  isToolkitConfigured,
  markToolkitConfigured,
  getContentPath,
  allToolkitHooks,
  toolkitBlockingHooks,
  CONFIG_HOOK_ID,
  configHook,
  modelHook,
  planHook,
  buildHook,
  reviewHook,
} from "./index.js";
import { HookRegistry } from "@mcp-toolkit/core";
import { createWorkflowStateTracker, type WorkflowStateTracker } from "@mcp-toolkit/mcp";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
});
