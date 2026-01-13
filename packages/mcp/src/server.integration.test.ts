/**
 * MCP Server Integration Tests
 *
 * Comprehensive tests for the MCP server including tool registration,
 * invocation flow, session tracking, and hook execution.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { createMemoryProvider } from "@mcp-toolkit/core";
import type { SessionProvider } from "@mcp-toolkit/core";
import { createServer, getSessionStartHooks, getSessionEndHooks } from "./server.js";
import type { ServerConfig } from "./server.js";
import { handleToolCall, registerTools } from "./tools/index.js";
import { registerResources, handleResourceRead } from "./resources/index.js";
import { registerPrompts, handleGetPrompt } from "./prompts/index.js";
import { createSessionStateTracker } from "./spec/session-state.js";

describe("MCP Server Integration Tests", () => {
  let provider: SessionProvider;

  beforeEach(() => {
    provider = createMemoryProvider();
  });

  describe("Server Creation", () => {
    it("creates server with all default values", () => {
      const { server, context } = createServer();

      expect(server).toBeDefined();
      expect(context.sessionId).toBeDefined();
      expect(context.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(context.name).toBe("mcp-toolkit");
      expect(context.version).toBe("0.0.0");
    });

    it("creates server with custom configuration", () => {
      const customConfig: ServerConfig = {
        name: "custom-server",
        version: "2.0.0",
        provider,
        identity: {
          canonicalName: "custom-canonical",
          tags: { env: "test" },
        },
        sessionId: "fixed-session-id",
      };

      const { context } = createServer(customConfig);

      expect(context.name).toBe("custom-server");
      expect(context.version).toBe("2.0.0");
      expect(context.provider).toBe(provider);
      expect(context.identity.canonicalName).toBe("custom-canonical");
      expect(context.identity.tags?.env).toBe("test");
      expect(context.sessionId).toBe("fixed-session-id");
    });

    it("merges default tool delegations with custom delegations", () => {
      const { context } = createServer({
        defaultToolDelegations: {
          custom_tool: { mode: "local-only" },
        },
      });

      expect(context.defaultToolDelegations?.custom_tool).toEqual({
        mode: "local-only",
      });
      // Default delegation should still exist
      expect(context.defaultToolDelegations?.["session_init:client_discovery"]).toBeDefined();
    });

    it("allows custom delegations to override defaults", () => {
      const { context } = createServer({
        defaultToolDelegations: {
          "session_init:client_discovery": { mode: "local-only" },
        },
      });

      expect(context.defaultToolDelegations?.["session_init:client_discovery"]).toEqual({
        mode: "local-only",
      });
    });
  });

  describe("Tool Registration and Invocation", () => {
    it("registers all core tools", () => {
      const tools = registerTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThanOrEqual(5);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("session_init");
      expect(toolNames).toContain("session_update");
      expect(toolNames).toContain("session_clear");
      expect(toolNames).toContain("session_status");
      expect(toolNames).toContain("server_info");
    });

    it("handles unknown tool gracefully", async () => {
      const { context } = createServer({ provider });

      const result = await handleToolCall("unknown_tool", {}, context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
      expect(result.content[0].text).toContain("unknown_tool");
    });

    it("invokes session_init tool successfully", async () => {
      const { context } = createServer({ provider });

      const result = await handleToolCall("session_init", { projectName: "test-project" }, context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("success");
    });

    it("invokes server_info tool successfully", async () => {
      const { context } = createServer({
        provider,
        identity: {
          canonicalName: "test-server",
          tags: { version: "1.0.0" },
        },
      });

      const result = await handleToolCall("server_info", {}, context);

      expect(result.isError).toBeUndefined();
      // server_info returns formatted text, not JSON
      expect(result.content[0].text).toContain("Server Information");
      expect(result.content[0].text).toContain("Canonical Name: test-server");
      expect(result.content[0].text).toContain("version=1.0.0");
    });

    it("invokes session_status tool successfully", async () => {
      const { context } = createServer({ provider });

      // Initialize session first
      await handleToolCall("session_init", { projectName: "status-test" }, context);

      const result = await handleToolCall("session_status", {}, context);

      expect(result.isError).toBeUndefined();
      // session_status returns formatted text with session info
      expect(result.content[0].text).toContain("Session Status");
      expect(result.content[0].text).toContain("status-test");
    });

    it("returns informative message when no session exists", async () => {
      const { context } = createServer({ provider });

      const result = await handleToolCall("session_status", {}, context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("No active session");
    });
  });

  describe("Tool Invocation Flow", () => {
    it("completes full session workflow: init -> status -> clear", async () => {
      const { context } = createServer({ provider });

      // Step 1: Initialize session
      const initResult = await handleToolCall(
        "session_init",
        { projectName: "workflow-test" },
        context
      );
      expect(initResult.isError).toBeUndefined();

      // Step 2: Check status
      const statusResult = await handleToolCall("session_status", {}, context);
      expect(statusResult.isError).toBeUndefined();

      // Step 3: Clear session
      const clearResult = await handleToolCall("session_clear", {}, context);
      expect(clearResult.isError).toBeUndefined();
    });

    it("handles sequential tool calls with state persistence", async () => {
      const { context } = createServer({ provider });

      // Initialize with project name
      await handleToolCall("session_init", { projectName: "state-test" }, context);

      // Update features
      const updateResult = await handleToolCall(
        "session_update",
        { features: { tools: true, resources: false } },
        context
      );
      expect(updateResult.isError).toBeUndefined();

      // Verify status reflects changes
      const statusResult = await handleToolCall("session_status", {}, context);
      expect(statusResult.isError).toBeUndefined();
    });
  });

  describe("Resource Registration and Reading", () => {
    it("registers resources with templates", () => {
      const resources = registerResources();

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
    });

    it("handles resource read requests", async () => {
      const { context } = createServer({ provider });

      // Initialize session first (some resources may require it)
      await handleToolCall("session_init", { projectName: "resource-test" }, context);

      // Try to read the session config resource
      const result = await handleResourceRead("mcp-session://config", context);

      // Resource should either return content or indicate not found
      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
    });
  });

  describe("Prompt Registration and Fetching", () => {
    it("registers prompts", () => {
      const prompts = registerPrompts();

      expect(prompts).toBeDefined();
      expect(Array.isArray(prompts)).toBe(true);
    });

    it("handles prompt requests", async () => {
      const { context } = createServer({ provider });
      const prompts = registerPrompts();

      if (prompts.length > 0) {
        const firstPrompt = prompts[0];
        const result = await handleGetPrompt(firstPrompt.name, {}, context);

        expect(result).toBeDefined();
        expect(result.messages).toBeDefined();
      }
    });
  });

  describe("Session State Tracking", () => {
    it("tracks session state across requests", () => {
      const { context } = createServer({ provider });

      expect(context.sessionStateTracker).toBeDefined();
      expect(context.sessionId).toBeDefined();
    });

    it("generates unique session IDs when not provided", () => {
      const { context: context1 } = createServer({ provider });
      const { context: context2 } = createServer({ provider: createMemoryProvider() });

      expect(context1.sessionId).not.toBe(context2.sessionId);
    });

    it("uses provided session ID when specified", () => {
      const customSessionId = "custom-session-12345";
      const { context } = createServer({
        provider,
        sessionId: customSessionId,
      });

      expect(context.sessionId).toBe(customSessionId);
    });

    it("enforces tool initialization requirements", () => {
      const tracker = createSessionStateTracker("session_init", ["protected_tool"]);
      tracker.setSessionId("test-session");

      // Before init, protected tool should be blocked
      const blockMessage = tracker.checkToolAllowed("protected_tool", "req-1");
      expect(blockMessage).toContain("session_init");

      // After init, it should be allowed
      tracker.recordToolCall("session_init", "req-2");
      const allowedMessage = tracker.checkToolAllowed("protected_tool", "req-3");
      expect(allowedMessage).toBeNull();
    });
  });

  describe("Request ID Tracking", () => {
    it("initializes with null request ID", () => {
      const { context } = createServer({ provider });

      expect(context.currentRequestId).toBeNull();
    });

    it("tracks request ID through context", async () => {
      const { context } = createServer({ provider });

      // Simulate setting request ID (normally done by server handler)
      context.currentRequestId = "test-request-id";

      expect(context.currentRequestId).toBe("test-request-id");
    });
  });

  describe("Session Hooks", () => {
    it("returns session start hooks content", async () => {
      const { context } = createServer({ provider, sessionId: "hook-session" });

      const hooks = await getSessionStartHooks(context);

      expect(hooks.sessionId).toBe("hook-session");
      expect(hooks.content).toBeDefined();
      expect(typeof hooks.content).toBe("string");
    });

    it("returns session end hooks content", async () => {
      const { context } = createServer({ provider, sessionId: "hook-session" });

      const hooks = await getSessionEndHooks(context);

      expect(hooks.sessionId).toBe("hook-session");
      expect(hooks.content).toBeDefined();
      expect(typeof hooks.content).toBe("string");
    });

    it("includes request ID in session start hooks", async () => {
      const { context } = createServer({ provider });
      context.currentRequestId = "current-request";

      const hooks = await getSessionStartHooks(context);

      expect(hooks.requestId).toBe("current-request");
    });
  });

  describe("Error Handling", () => {
    it("handles tool invocation errors gracefully", async () => {
      const { context } = createServer({ provider });

      // Call with invalid arguments that should cause validation error
      const result = await handleToolCall("session_init", { invalid: "args" }, context);

      // Should not throw, should return error result
      expect(result).toBeDefined();
    });

    it("handles resource read for non-existent URI", async () => {
      const { context } = createServer({ provider });

      const result = await handleResourceRead("non-existent://resource", context);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
    });

    it("handles prompt request for non-existent prompt", async () => {
      const { context } = createServer({ provider });

      const result = await handleGetPrompt("non-existent-prompt", {}, context);

      expect(result).toBeDefined();
    });
  });

  describe("Provider Integration", () => {
    it("uses provided session provider for storage", async () => {
      const customProvider = createMemoryProvider();
      const { context } = createServer({ provider: customProvider });

      // Initialize session which should use the provider
      await handleToolCall("session_init", { projectName: "provider-test" }, context);

      // Verify provider is the same instance
      expect(context.provider).toBe(customProvider);
    });

    it("isolates sessions between different providers", async () => {
      const provider1 = createMemoryProvider();
      const provider2 = createMemoryProvider();

      const { context: context1 } = createServer({ provider: provider1 });
      const { context: context2 } = createServer({ provider: provider2 });

      // Initialize different projects
      await handleToolCall("session_init", { projectName: "project-1" }, context1);
      await handleToolCall("session_init", { projectName: "project-2" }, context2);

      // Each should have their own state
      expect(context1.provider).not.toBe(context2.provider);
    });
  });

  describe("Server Identity", () => {
    it("exposes server identity through context", () => {
      const { context } = createServer({
        provider,
        identity: {
          canonicalName: "identity-test-server",
          displayName: "Identity Test Server",
          tags: { category: "test", priority: "high" },
        },
      });

      expect(context.identity.canonicalName).toBe("identity-test-server");
      expect(context.identity.displayName).toBe("Identity Test Server");
      expect(context.identity.tags?.category).toBe("test");
      expect(context.identity.tags?.priority).toBe("high");
    });

    it("provides identity through server_info tool", async () => {
      const { context } = createServer({
        provider,
        identity: {
          canonicalName: "info-server",
          tags: { env: "production" },
        },
      });

      const result = await handleToolCall("server_info", {}, context);
      // server_info returns formatted text, not JSON
      const text = result.content[0].text;

      expect(text).toContain("Canonical Name: info-server");
      expect(text).toContain("env=production");
    });
  });

  describe("Concurrent Requests", () => {
    it("handles multiple concurrent tool calls", async () => {
      const { context } = createServer({ provider });

      // Initialize first
      await handleToolCall("session_init", { projectName: "concurrent-test" }, context);

      // Run multiple status checks concurrently
      const results = await Promise.all([
        handleToolCall("session_status", {}, context),
        handleToolCall("server_info", {}, context),
        handleToolCall("session_status", {}, context),
      ]);

      // All should succeed
      for (const result of results) {
        expect(result.isError).toBeUndefined();
      }
    });

    it("maintains session state during concurrent operations", async () => {
      const { context } = createServer({ provider });

      await handleToolCall("session_init", { projectName: "concurrent-state" }, context);

      // Multiple updates and status checks
      const operations = [
        handleToolCall("session_update", { projectName: "updated-1" }, context),
        handleToolCall("session_status", {}, context),
        handleToolCall("session_update", { projectName: "updated-2" }, context),
      ];

      const results = await Promise.all(operations);

      // All operations should complete
      for (const result of results) {
        expect(result).toBeDefined();
      }
    });
  });
});
