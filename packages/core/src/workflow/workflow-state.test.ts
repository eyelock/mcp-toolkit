import { beforeEach, describe, expect, it } from "vitest";
import {
  type BlockingHookDef,
  type WorkflowStateTracker,
  checkWorkflowAllowed,
  createWorkflowStateTracker,
  getDefaultWorkflowTracker,
  markWorkflowHookCompleted,
  registerBlockingHook,
  resetDefaultWorkflowTracker,
} from "./workflow-state.js";

describe("WorkflowStateTracker", () => {
  let tracker: WorkflowStateTracker;

  beforeEach(() => {
    tracker = createWorkflowStateTracker();
  });

  describe("registerBlockingHook", () => {
    it("should register a blocking hook", () => {
      const def: BlockingHookDef = {
        hookId: "toolkit:config:start:config",
        toolPrefix: "toolkit:",
        name: "Toolkit Configuration",
        blockMessage: "You must complete the toolkit configuration first.",
      };

      tracker.registerBlockingHook(def);
      expect(tracker.getBlockingHooks()).toHaveLength(1);
      expect(tracker.getBlockingHooks()[0]).toEqual(def);
    });

    it("should register multiple blocking hooks", () => {
      const defs: BlockingHookDef[] = [
        {
          hookId: "hook1",
          toolPrefix: "prefix1:",
          name: "Hook 1",
          blockMessage: "Blocked by hook 1",
        },
        {
          hookId: "hook2",
          toolPrefix: "prefix2:",
          name: "Hook 2",
          blockMessage: "Blocked by hook 2",
        },
      ];

      tracker.registerBlockingHooks(defs);
      expect(tracker.getBlockingHooks()).toHaveLength(2);
    });
  });

  describe("checkToolAllowed", () => {
    beforeEach(() => {
      tracker.registerBlockingHook({
        hookId: "toolkit:config:start:config",
        toolPrefix: "toolkit:",
        name: "Toolkit Configuration",
        blockMessage: "You must complete the toolkit configuration first.",
      });
    });

    it("should block tools matching the prefix when hook is incomplete", () => {
      const result = tracker.checkToolAllowed("toolkit:build_model");

      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe("toolkit:config:start:config");
      expect(result.message).toBe("You must complete the toolkit configuration first.");
      expect(result.hint).toContain("Toolkit Configuration");
    });

    it("should allow tools not matching any blocking prefix", () => {
      const result = tracker.checkToolAllowed("other_tool");

      expect(result.allowed).toBe(true);
      expect(result.blockedBy).toBeUndefined();
    });

    it("should allow tools after blocking hook completes", () => {
      // Initially blocked
      expect(tracker.checkToolAllowed("toolkit:build_model").allowed).toBe(false);

      // Mark hook as completed
      tracker.markHookCompleted("toolkit:config:start:config");

      // Now allowed
      const result = tracker.checkToolAllowed("toolkit:build_model");
      expect(result.allowed).toBe(true);
    });
  });

  describe("markHookCompleted", () => {
    it("should mark a hook as completed", () => {
      tracker.markHookCompleted("my-hook");

      expect(tracker.isHookCompleted("my-hook")).toBe(true);
    });

    it("should store completion data", () => {
      const data = { projectName: "my-project" };
      tracker.markHookCompleted("my-hook", data);

      const status = tracker.getHookCompletion("my-hook");
      expect(status?.data).toEqual(data);
      expect(status?.completedAt).toBeDefined();
    });

    it("should track multiple completed hooks", () => {
      tracker.markHookCompleted("hook1");
      tracker.markHookCompleted("hook2");

      expect(tracker.getCompletedHooks()).toHaveLength(2);
    });
  });

  describe("createBlockingResponse", () => {
    it("should create a properly formatted MCP error response", () => {
      const result = {
        allowed: false,
        blockedBy: "toolkit:config",
        message: "Configuration required",
        hint: "Complete config first",
      };

      const response = tracker.createBlockingResponse(result);

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.workflowViolation).toBe(true);
      expect(parsed.blockedBy).toBe("toolkit:config");
    });
  });

  describe("reset", () => {
    it("should clear completed hooks but keep blocking hook registrations", () => {
      tracker.registerBlockingHook({
        hookId: "hook1",
        toolPrefix: "prefix:",
        name: "Hook 1",
        blockMessage: "Blocked",
      });
      tracker.markHookCompleted("hook1");

      tracker.reset();

      expect(tracker.isHookCompleted("hook1")).toBe(false);
      expect(tracker.getBlockingHooks()).toHaveLength(1);
    });
  });
});

describe("Default Workflow Tracker", () => {
  beforeEach(() => {
    resetDefaultWorkflowTracker();
  });

  it("should provide a singleton instance", () => {
    const tracker1 = getDefaultWorkflowTracker();
    const tracker2 = getDefaultWorkflowTracker();

    expect(tracker1).toBe(tracker2);
  });

  it("should support convenience functions", () => {
    registerBlockingHook({
      hookId: "test:hook",
      toolPrefix: "test:",
      name: "Test Hook",
      blockMessage: "Blocked by test",
    });

    // Initially blocked
    expect(checkWorkflowAllowed("test:tool").allowed).toBe(false);

    // Mark completed
    markWorkflowHookCompleted("test:hook");

    // Now allowed
    expect(checkWorkflowAllowed("test:tool").allowed).toBe(true);
  });

  it("should reset properly", () => {
    registerBlockingHook({
      hookId: "test:hook",
      toolPrefix: "test:",
      name: "Test Hook",
      blockMessage: "Blocked",
    });
    markWorkflowHookCompleted("test:hook");

    resetDefaultWorkflowTracker();

    // Fresh tracker, no blocking hooks registered
    expect(checkWorkflowAllowed("test:tool").allowed).toBe(true);
  });
});
