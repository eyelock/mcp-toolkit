import { createMemoryProvider } from "@mcp-toolkit/provider";
import { beforeEach, describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import {
  getSessionSetupPrompt,
  getWelcomePrompt,
  sessionSetupPrompt,
  welcomePrompt,
} from "./welcome.js";

describe("Welcome Prompts", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = { provider: createMemoryProvider() };
  });

  describe("welcomePrompt", () => {
    it("has correct name and description", () => {
      expect(welcomePrompt.name).toBe("welcome");
      expect(welcomePrompt.description).toBeDefined();
      expect(welcomePrompt.arguments).toHaveLength(1);
    });
  });

  describe("getWelcomePrompt", () => {
    it("returns getting started message when no session", async () => {
      const result = await getWelcomePrompt(undefined, context);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("Getting Started");
      expect(text).toContain("session_init");
    });

    it("returns session info when session exists", async () => {
      await context.provider.initSession({ projectName: "test-project" });

      const result = await getWelcomePrompt(undefined, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("Current Session");
      expect(text).toContain("test-project");
    });

    it("shows features list when session has enabled features", async () => {
      await context.provider.initSession({
        projectName: "test-project",
        features: { tools: true, resources: true, prompts: false, sampling: false },
      });

      const result = await getWelcomePrompt(undefined, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("tools");
      expect(text).toContain("resources");
    });

    it("shows 'none enabled' when no features are enabled", async () => {
      await context.provider.initSession({
        projectName: "test-project",
        features: { tools: false, resources: false, prompts: false, sampling: false },
      });

      const result = await getWelcomePrompt(undefined, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("none enabled");
    });

    it("includes examples when requested", async () => {
      const result = await getWelcomePrompt({ include_examples: "true" }, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("Examples");
      expect(text).toContain("my-api-server");
    });

    it("excludes examples when not requested", async () => {
      const result = await getWelcomePrompt({ include_examples: "false" }, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).not.toContain("## Examples");
    });
  });

  describe("sessionSetupPrompt", () => {
    it("has correct name and description", () => {
      expect(sessionSetupPrompt.name).toBe("session_setup");
      expect(sessionSetupPrompt.description).toBeDefined();
    });
  });

  describe("getSessionSetupPrompt", () => {
    it("returns setup guide when no session exists", async () => {
      const result = await getSessionSetupPrompt(undefined, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("set up your MCP Toolkit session");
      expect(text).toContain("Project Name");
    });

    it("asks about existing session when one exists", async () => {
      await context.provider.initSession({ projectName: "existing-project" });

      const result = await getSessionSetupPrompt(undefined, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("already exists");
      expect(text).toContain("existing-project");
    });
  });
});
