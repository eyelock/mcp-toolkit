import { createMemoryProvider } from "@mcp-toolkit/provider";
import { describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import { handleServerInfo, serverInfoTool } from "./server-info.js";

describe("Server Info Tool", () => {
  describe("serverInfoTool", () => {
    it("has correct name and description", () => {
      expect(serverInfoTool.name).toBe("server_info");
      expect(serverInfoTool.description).toBeDefined();
      expect(serverInfoTool.description).toContain("canonical name");
      expect(serverInfoTool.inputSchema).toBeDefined();
    });
  });

  describe("handleServerInfo", () => {
    it("returns server identity with no tags", async () => {
      const context: ServerContext = {
        provider: createMemoryProvider(),
        identity: {
          canonicalName: "my-toolkit",
          tags: {},
        },
        name: "my-toolkit",
        version: "1.0.0",
      };

      const result = await handleServerInfo({}, context);

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Server Information");
      expect(text).toContain("Canonical Name: my-toolkit");
      expect(text).toContain("Server Name: my-toolkit");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Tags: (none)");
    });

    it("returns server identity with single tag", async () => {
      const context: ServerContext = {
        provider: createMemoryProvider(),
        identity: {
          canonicalName: "my-toolkit",
          tags: { env: "development" },
        },
        name: "my-toolkit",
        version: "0.0.0",
      };

      const result = await handleServerInfo({}, context);

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Tags:");
      expect(text).toContain("env=development");
    });

    it("returns server identity with multiple tags", async () => {
      const context: ServerContext = {
        provider: createMemoryProvider(),
        identity: {
          canonicalName: "my-toolkit",
          tags: { env: "staging", team: "platform", region: "us-west-2" },
        },
        name: "my-toolkit",
        version: "0.0.0",
      };

      const result = await handleServerInfo({}, context);

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Tags:");
      expect(text).toContain("env=staging");
      expect(text).toContain("team=platform");
      expect(text).toContain("region=us-west-2");
    });

    it("ignores args parameter", async () => {
      const context: ServerContext = {
        provider: createMemoryProvider(),
        identity: {
          canonicalName: "test",
          tags: {},
        },
        name: "test",
        version: "1.0.0",
      };

      const result = await handleServerInfo({ anyArg: "ignored" }, context);

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain("Server Information");
    });
  });
});
