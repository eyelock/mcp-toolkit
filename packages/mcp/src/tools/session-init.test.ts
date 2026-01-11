import { createMemoryProvider } from "@mcp-toolkit/storage";
import type { SessionProvider } from "@mcp-toolkit/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerContext } from "../server.js";
import {
  handleSessionClear,
  handleSessionInit,
  handleSessionStatus,
  handleSessionUpdate,
  sessionClearTool,
  sessionInitTool,
  sessionStatusTool,
  sessionUpdateTool,
} from "./session-init.js";

// Default identity for testing
const defaultIdentity = {
  canonicalName: "test-toolkit",
  tags: {},
};

describe("Session Tools", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = {
      provider: createMemoryProvider(),
      identity: defaultIdentity,
      name: "test-toolkit",
      version: "0.0.0",
    };
  });

  describe("sessionInitTool", () => {
    it("has correct name and description", () => {
      expect(sessionInitTool.name).toBe("session_init");
      expect(sessionInitTool.description).toBeDefined();
      expect(sessionInitTool.inputSchema).toBeDefined();
    });
  });

  describe("handleSessionInit", () => {
    it("initializes a session successfully", async () => {
      const result = await handleSessionInit({ projectName: "test-project" }, context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as { text: string }).text).toContain("Session initialized");
    });

    it("returns error for invalid input", async () => {
      const result = await handleSessionInit({ projectName: "Invalid Name" }, context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Invalid input");
    });

    it("returns error if session already exists", async () => {
      await context.provider.initSession({ projectName: "existing" });

      const result = await handleSessionInit({ projectName: "new-project" }, context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("already exists");
    });

    it("returns error if provider fails", async () => {
      // Mock provider that fails on initSession
      const mockProvider: SessionProvider = {
        name: "mock",
        hasSession: vi.fn().mockResolvedValue(false),
        getSession: vi.fn().mockResolvedValue({ success: true, data: null }),
        initSession: vi.fn().mockResolvedValue({
          success: false,
          error: "Provider internal error",
        }),
        updateSession: vi.fn(),
        clearSession: vi.fn(),
      };
      const mockContext: ServerContext = {
        provider: mockProvider,
        identity: defaultIdentity,
        name: "test-toolkit",
        version: "0.0.0",
      };

      const result = await handleSessionInit({ projectName: "test-project" }, mockContext);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain(
        "Failed to initialize session"
      );
    });

    it("shows enabled features", async () => {
      const result = await handleSessionInit(
        { projectName: "test", features: { tools: true, prompts: true } },
        context
      );

      expect((result.content[0] as { text: string }).text).toContain("tools");
    });

    it("shows 'none' when no features are enabled", async () => {
      const result = await handleSessionInit(
        {
          projectName: "test",
          features: { tools: false, resources: false, prompts: false, sampling: false },
        },
        context
      );

      expect((result.content[0] as { text: string }).text).toContain("Features: none");
    });

    it("shows (none) when no tags are set", async () => {
      const result = await handleSessionInit({ projectName: "test-project" }, context);

      expect((result.content[0] as { text: string }).text).toContain("Tags: (none)");
    });

    it("shows tags when set", async () => {
      const taggedContext: ServerContext = {
        provider: createMemoryProvider(),
        identity: { canonicalName: "test-toolkit", tags: { env: "development", team: "platform" } },
        name: "test-toolkit",
        version: "0.0.0",
      };

      const result = await handleSessionInit({ projectName: "test-project" }, taggedContext);

      expect((result.content[0] as { text: string }).text).toContain(
        "Tags: env=development, team=platform"
      );
    });
  });

  describe("sessionUpdateTool", () => {
    it("has correct name and description", () => {
      expect(sessionUpdateTool.name).toBe("session_update");
      expect(sessionUpdateTool.description).toBeDefined();
    });
  });

  describe("handleSessionUpdate", () => {
    it("returns error if no session exists", async () => {
      const result = await handleSessionUpdate({ projectName: "new-name" }, context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("No active session");
    });

    it("updates session successfully", async () => {
      await context.provider.initSession({ projectName: "old-name" });

      const result = await handleSessionUpdate({ projectName: "new-name" }, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("updated successfully");
    });

    it("returns error if update fails", async () => {
      await context.provider.initSession({ projectName: "test" });

      const result = await handleSessionUpdate({ projectName: "Invalid Name" }, context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Failed to update");
    });
  });

  describe("sessionClearTool", () => {
    it("has correct name and description", () => {
      expect(sessionClearTool.name).toBe("session_clear");
      expect(sessionClearTool.description).toBeDefined();
    });
  });

  describe("handleSessionClear", () => {
    it("clears the session", async () => {
      await context.provider.initSession({ projectName: "test" });

      const result = await handleSessionClear({}, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("cleared");
      expect(await context.provider.hasSession()).toBe(false);
    });
  });

  describe("sessionStatusTool", () => {
    it("has correct name and description", () => {
      expect(sessionStatusTool.name).toBe("session_status");
      expect(sessionStatusTool.description).toBeDefined();
    });
  });

  describe("handleSessionStatus", () => {
    it("returns message when no session exists", async () => {
      const result = await handleSessionStatus({}, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("No active session");
    });

    it("returns session status when session exists", async () => {
      await context.provider.initSession({ projectName: "test-project" });

      const result = await handleSessionStatus({}, context);

      expect((result.content[0] as { text: string }).text).toContain("Session Status");
      expect((result.content[0] as { text: string }).text).toContain("test-project");
    });

    it("shows 'none' when session has no enabled features", async () => {
      await context.provider.initSession({
        projectName: "test-project",
        features: { tools: false, resources: false, prompts: false, sampling: false },
      });

      const result = await handleSessionStatus({}, context);

      expect((result.content[0] as { text: string }).text).toContain("Features: none");
    });

    it("shows (none) when no tags are set", async () => {
      await context.provider.initSession({ projectName: "test-project" });

      const result = await handleSessionStatus({}, context);

      expect((result.content[0] as { text: string }).text).toContain("Tags: (none)");
    });

    it("shows tags when set", async () => {
      const taggedContext: ServerContext = {
        provider: createMemoryProvider(),
        identity: { canonicalName: "test-toolkit", tags: { env: "staging", owner: "david" } },
        name: "test-toolkit",
        version: "0.0.0",
      };
      await taggedContext.provider.initSession({ projectName: "test-project" });

      const result = await handleSessionStatus({}, taggedContext);

      expect((result.content[0] as { text: string }).text).toContain(
        "Tags: env=staging, owner=david"
      );
    });
  });
});
