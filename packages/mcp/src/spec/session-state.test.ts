/**
 * Session State Management Tests
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  type SessionStateTracker,
  SessionStateTracker as SessionStateTrackerClass,
  createSessionStateTracker,
  createBlockingResponse,
  WorkflowViolationError,
} from "./session-state.js";

describe("SessionStateTracker", () => {
  let tracker: SessionStateTracker;

  beforeEach(() => {
    tracker = createSessionStateTracker("session_init", ["my_tool", "other_tool"]);
  });

  describe("initial state", () => {
    it("starts in uninitialized state", () => {
      expect(tracker.getState()).toBe("uninitialized");
    });

    it("is not initialized initially", () => {
      expect(tracker.isInitialized()).toBe(false);
    });

    it("has no session ID initially", () => {
      expect(tracker.getSessionId()).toBeNull();
    });
  });

  describe("setSessionId / getSessionId", () => {
    it("sets and gets session ID", () => {
      tracker.setSessionId("test-session-123");
      expect(tracker.getSessionId()).toBe("test-session-123");
    });
  });

  describe("checkToolAllowed", () => {
    it("allows init tools before initialization", () => {
      expect(tracker.checkToolAllowed("session_init")).toBeNull();
      expect(tracker.checkToolAllowed("server_info")).toBeNull();
    });

    it("blocks tools that require init before initialization", () => {
      const result = tracker.checkToolAllowed("my_tool");
      expect(result).toContain("requires session initialization");
      expect(result).toContain("session_init");
    });

    it("allows all tools after initialization", () => {
      tracker.recordToolCall("session_init");
      expect(tracker.checkToolAllowed("my_tool")).toBeNull();
      expect(tracker.checkToolAllowed("other_tool")).toBeNull();
    });

    it("tracks requestId when provided", () => {
      tracker.checkToolAllowed("session_init", "req-123");
      const timing = tracker.getTimingInfo();
      expect(timing.requestId).toBe("req-123");
    });
  });

  describe("recordToolCall", () => {
    it("transitions to initialized on init tool call", () => {
      const result = tracker.recordToolCall("session_init");
      expect(result.previousState).toBe("uninitialized");
      expect(result.newState).toBe("initialized");
      expect(result.transitioned).toBe(true);
      expect(result.guidance).toContain("initialized");
    });

    it("sets initAt timestamp on initialization", () => {
      const before = Date.now();
      tracker.recordToolCall("session_init");
      const timing = tracker.getTimingInfo();
      expect(timing.initAt).toBeGreaterThanOrEqual(before);
      expect(timing.initAt).toBeLessThanOrEqual(Date.now());
    });

    it("transitions to working on first real work", () => {
      tracker.recordToolCall("session_init");
      const result = tracker.recordToolCall("my_tool");
      expect(result.previousState).toBe("initialized");
      expect(result.newState).toBe("working");
      expect(result.transitioned).toBe(true);
    });

    it("stays in working state on subsequent calls", () => {
      tracker.recordToolCall("session_init");
      tracker.recordToolCall("my_tool");
      const result = tracker.recordToolCall("other_tool");
      expect(result.previousState).toBe("working");
      expect(result.newState).toBe("working");
      expect(result.transitioned).toBe(false);
    });

    it("tracks requestId when provided", () => {
      tracker.recordToolCall("session_init", "req-456");
      const timing = tracker.getTimingInfo();
      expect(timing.requestId).toBe("req-456");
    });
  });

  describe("reset", () => {
    it("resets all state", () => {
      tracker.setSessionId("test-session");
      tracker.recordToolCall("session_init", "req-123");
      tracker.recordToolCall("my_tool");

      tracker.reset();

      expect(tracker.getState()).toBe("uninitialized");
      expect(tracker.isInitialized()).toBe(false);
      expect(tracker.getSessionId()).toBeNull();
      const timing = tracker.getTimingInfo();
      expect(timing.initAt).toBeNull();
      expect(timing.requestId).toBeNull();
    });
  });

  describe("getTimingInfo", () => {
    it("returns complete timing info", () => {
      tracker.setSessionId("session-abc");
      tracker.recordToolCall("session_init", "req-xyz");

      const timing = tracker.getTimingInfo();
      expect(timing.state).toBe("initialized");
      expect(timing.sessionId).toBe("session-abc");
      expect(timing.requestId).toBe("req-xyz");
      expect(timing.initAt).not.toBeNull();
    });
  });
});

describe("createSessionStateTracker", () => {
  it("creates tracker with default init tool", () => {
    const tracker = createSessionStateTracker();
    expect(tracker.checkToolAllowed("session_init")).toBeNull();
    expect(tracker.checkToolAllowed("server_info")).toBeNull();
  });

  it("creates tracker with custom init tool", () => {
    const tracker = createSessionStateTracker("custom_init");
    expect(tracker.checkToolAllowed("custom_init")).toBeNull();
    expect(tracker.checkToolAllowed("session_init")).toBeNull(); // server_info also allowed
  });

  it("creates tracker with requiresInit tools", () => {
    const tracker = createSessionStateTracker("session_init", ["protected_tool"]);
    const result = tracker.checkToolAllowed("protected_tool");
    expect(result).toContain("requires session initialization");
  });
});

describe("Custom transition triggers", () => {
  it("handles custom transitions that are not initialized", () => {
    // Create tracker with custom transition from initialized to ready
    const tracker = new SessionStateTrackerClass({
      initTools: new Set(["session_init"]),
      requiresInit: new Set(),
      transitionTriggers: new Map([
        ["session_init", "initialized"],
        ["activate_tool", "ready"], // Custom transition from initialized to ready
      ]),
    });

    // First, initialize
    tracker.recordToolCall("session_init");
    expect(tracker.getState()).toBe("initialized");

    // Then trigger custom transition (initialized -> ready)
    const result = tracker.recordToolCall("activate_tool");
    expect(result.transitioned).toBe(true);
    expect(result.newState).toBe("ready");
    expect(result.guidance).toBeUndefined(); // Custom transitions don't have built-in guidance
  });
});

describe("createBlockingResponse", () => {
  it("creates properly formatted error response", () => {
    const response = createBlockingResponse("Test error message");
    expect(response.isError).toBe(true);
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
    expect(response.content[0].text).toBe("Test error message");
  });
});

describe("WorkflowViolationError", () => {
  it("creates error with all properties", () => {
    const error = new WorkflowViolationError(
      "Tool blocked",
      "my_tool",
      "uninitialized",
      "Call session_init first"
    );

    expect(error.message).toBe("Tool blocked");
    expect(error.name).toBe("WorkflowViolationError");
    expect(error.toolName).toBe("my_tool");
    expect(error.currentState).toBe("uninitialized");
    expect(error.requiredAction).toBe("Call session_init first");
  });

  it("is instanceof Error", () => {
    const error = new WorkflowViolationError("msg", "tool", "uninitialized", "action");
    expect(error).toBeInstanceOf(Error);
  });
});
