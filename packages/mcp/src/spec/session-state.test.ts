import { createMemoryProvider, type SessionProvider } from "@mcp-toolkit/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createBlockingResponse,
  createSessionStateTracker,
  type SessionStateTracker,
  WorkflowViolationError,
} from "./session-state.js";

describe("SessionStateTracker", () => {
  let tracker: SessionStateTracker;
  let provider: SessionProvider;

  beforeEach(() => {
    tracker = createSessionStateTracker("session_init", ["restricted_tool"]);
    provider = createMemoryProvider();
  });

  describe("policy", () => {
    it("recognises init tools", () => {
      expect(tracker.isInitTool("session_init")).toBe(true);
      expect(tracker.isInitTool("server_info")).toBe(true);
      expect(tracker.isInitTool("restricted_tool")).toBe(false);
    });

    it("recognises tools that require init", () => {
      expect(tracker.requiresInit("restricted_tool")).toBe(true);
      expect(tracker.requiresInit("some_other_tool")).toBe(false);
    });
  });

  describe("getState", () => {
    it("is uninitialized without a handle", async () => {
      expect(await tracker.getState(null, provider)).toBe("uninitialized");
    });

    it("is uninitialized for an unknown handle", async () => {
      expect(await tracker.getState("nope", provider)).toBe("uninitialized");
    });

    it("is initialized once the handle resolves", async () => {
      const created = await provider.initSession({ projectName: "test-project" });

      expect(await tracker.getState(created.data?.sessionId ?? "", provider)).toBe("initialized");
    });

    // State is derived, never remembered - so it follows storage, including
    // storage written by some other instance or a previous process.
    it("follows storage rather than call history", async () => {
      const created = await provider.initSession({ projectName: "test-project" });
      const sessionId = created.data?.sessionId ?? "";
      expect(await tracker.getState(sessionId, provider)).toBe("initialized");

      await provider.clearSession(sessionId);
      expect(await tracker.getState(sessionId, provider)).toBe("uninitialized");
    });
  });

  describe("checkToolAllowed", () => {
    it("always allows init tools, even with no handle", async () => {
      expect(await tracker.checkToolAllowed("session_init", null, provider)).toBeNull();
      expect(await tracker.checkToolAllowed("server_info", null, provider)).toBeNull();
    });

    it("allows unrestricted tools with no handle", async () => {
      expect(await tracker.checkToolAllowed("some_other_tool", null, provider)).toBeNull();
    });

    it("blocks a restricted tool when no handle is supplied", async () => {
      const message = await tracker.checkToolAllowed("restricted_tool", null, provider);

      expect(message).toContain("restricted_tool");
      expect(message).toContain("no session_id was supplied");
      expect(message).toContain("session_init");
    });

    it("blocks a restricted tool when the handle is unknown", async () => {
      const message = await tracker.checkToolAllowed("restricted_tool", "bogus-handle", provider);

      expect(message).toContain("bogus-handle");
      expect(message).toContain("unknown or has expired");
    });

    it("allows a restricted tool once the handle resolves", async () => {
      const created = await provider.initSession({ projectName: "test-project" });

      expect(
        await tracker.checkToolAllowed("restricted_tool", created.data?.sessionId ?? "", provider)
      ).toBeNull();
    });

    // The behaviour the in-memory tracker could not provide: a handle minted
    // by one process is honoured by a tracker that never saw it created.
    it("honours a handle it never saw created, given shared storage", async () => {
      const created = await provider.initSession({ projectName: "test-project" });
      const otherInstance = createSessionStateTracker("session_init", ["restricted_tool"]);

      expect(
        await otherInstance.checkToolAllowed(
          "restricted_tool",
          created.data?.sessionId ?? "",
          provider
        )
      ).toBeNull();
    });

    it("blocks when storage is not shared", async () => {
      const created = await provider.initSession({ projectName: "test-project" });
      const unsharedStorage = createMemoryProvider();

      const message = await tracker.checkToolAllowed(
        "restricted_tool",
        created.data?.sessionId ?? "",
        unsharedStorage
      );

      expect(message).toContain("unknown or has expired");
    });
  });

  describe("createBlockingResponse", () => {
    it("formats an error result", () => {
      const response = createBlockingResponse("nope");

      expect(response.isError).toBe(true);
      expect(response.content[0]?.text).toBe("nope");
    });
  });

  describe("WorkflowViolationError", () => {
    it("carries context about the violation", () => {
      const error = new WorkflowViolationError("blocked", "my_tool", "uninitialized", "call init");

      expect(error.name).toBe("WorkflowViolationError");
      expect(error.toolName).toBe("my_tool");
      expect(error.currentState).toBe("uninitialized");
      expect(error.requiredAction).toBe("call init");
    });
  });
});
