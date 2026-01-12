import { createMemoryProvider } from "@mcp-toolkit/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import { handleGetPrompt, registerPrompts } from "./index.js";

describe("Prompts Registry", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = { provider: createMemoryProvider() };
  });

  describe("registerPrompts", () => {
    it("returns array of prompts", () => {
      const prompts = registerPrompts();

      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBe(2);
    });

    it("includes all prompts", () => {
      const prompts = registerPrompts();
      const promptNames = prompts.map((p) => p.name);

      expect(promptNames).toContain("welcome");
      expect(promptNames).toContain("session_setup");
    });

    it("all prompts have required properties", () => {
      const prompts = registerPrompts();

      for (const prompt of prompts) {
        expect(prompt.name).toBeDefined();
        expect(prompt.description).toBeDefined();
      }
    });
  });

  describe("handleGetPrompt", () => {
    it("handles welcome prompt", async () => {
      const result = await handleGetPrompt("welcome", undefined, context);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
    });

    it("handles session_setup prompt", async () => {
      const result = await handleGetPrompt("session_setup", undefined, context);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
    });

    it("handles welcome prompt with args", async () => {
      const result = await handleGetPrompt("welcome", { include_examples: "true" }, context);

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("Examples");
    });

    it("returns error message for unknown prompt", async () => {
      const result = await handleGetPrompt("unknown_prompt", undefined, context);

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("Unknown prompt");
    });
  });
});
