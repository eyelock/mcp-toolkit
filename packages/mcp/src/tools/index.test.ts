import { createMemoryProvider } from "@mcp-toolkit/provider";
import { beforeEach, describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import { handleToolCall, registerTools } from "./index.js";

// Default identity for testing
const defaultIdentity = {
  canonicalName: "test-toolkit",
  tags: {},
};

describe("Tools Registry", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = {
      provider: createMemoryProvider(),
      identity: defaultIdentity,
      name: "test-toolkit",
      version: "0.0.0",
    };
  });

  describe("registerTools", () => {
    it("returns array of tools", () => {
      const tools = registerTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(5);
    });

    it("includes all session tools", () => {
      const tools = registerTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("session_init");
      expect(toolNames).toContain("session_update");
      expect(toolNames).toContain("session_clear");
      expect(toolNames).toContain("session_status");
      expect(toolNames).toContain("server_info");
    });

    it("all tools have required properties", () => {
      const tools = registerTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });
  });

  describe("handleToolCall", () => {
    it("handles session_init tool", async () => {
      const result = await handleToolCall("session_init", { projectName: "test-project" }, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("Session initialized");
    });

    it("handles session_status tool", async () => {
      const result = await handleToolCall("session_status", {}, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("No active session");
    });

    it("handles session_update tool", async () => {
      await context.provider.initSession({ projectName: "old-name" });

      const result = await handleToolCall("session_update", { projectName: "new-name" }, context);

      expect(result.isError).toBeUndefined();
    });

    it("handles session_clear tool", async () => {
      await context.provider.initSession({ projectName: "test" });

      const result = await handleToolCall("session_clear", {}, context);

      expect(result.isError).toBeUndefined();
      expect(await context.provider.hasSession()).toBe(false);
    });

    it("handles server_info tool", async () => {
      const result = await handleToolCall("server_info", {}, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("Server Information");
      expect((result.content[0] as { text: string }).text).toContain("test-toolkit");
    });

    it("returns error for unknown tool", async () => {
      const result = await handleToolCall("unknown_tool", {}, context);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Unknown tool");
    });
  });
});
