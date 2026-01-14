/**
 * Prompts Index Tests
 */

import { describe, expect, it } from "vitest";
import {
  handleToolkitPrompt,
  isToolkitPrompt,
  registerToolkitPrompts,
  toolkitPrompts,
} from "./index.js";

describe("toolkitPrompts", () => {
  it("exports all expected prompts", () => {
    const promptNames = toolkitPrompts.map((p) => p.name);

    expect(promptNames).toContain("toolkit-design-start");
    expect(promptNames).toContain("toolkit-design-entity");
    expect(promptNames).toContain("toolkit-setup-guide");
  });

  it("has 3 prompts", () => {
    expect(toolkitPrompts).toHaveLength(3);
  });
});

describe("registerToolkitPrompts", () => {
  it("returns all toolkit prompts", () => {
    const prompts = registerToolkitPrompts();
    expect(prompts).toEqual(toolkitPrompts);
  });
});

describe("isToolkitPrompt", () => {
  it("returns true for toolkit prompts", () => {
    expect(isToolkitPrompt("toolkit-design-start")).toBe(true);
    expect(isToolkitPrompt("toolkit-design-entity")).toBe(true);
    expect(isToolkitPrompt("toolkit-setup-guide")).toBe(true);
  });

  it("returns false for non-toolkit prompts", () => {
    expect(isToolkitPrompt("welcome")).toBe(false);
    expect(isToolkitPrompt("other-prompt")).toBe(false);
  });
});

describe("handleToolkitPrompt", () => {
  it("returns null for unknown prompts", async () => {
    const result = await handleToolkitPrompt("unknown-prompt", undefined);
    expect(result).toBeNull();
  });

  it("handles toolkit-design-start", async () => {
    const result = await handleToolkitPrompt("toolkit-design-start", undefined);

    expect(result).not.toBeNull();
    expect(result?.messages).toBeDefined();
    expect(result?.messages.length).toBeGreaterThan(0);
  });

  it("handles toolkit-design-start with domain arg", async () => {
    const result = await handleToolkitPrompt("toolkit-design-start", {
      domain: "e-commerce platform",
    });

    expect(result).not.toBeNull();
    expect(result?.messages[0].content).toMatchObject({
      type: "text",
      text: expect.stringContaining("e-commerce platform"),
    });
  });

  it("handles toolkit-design-entity", async () => {
    const result = await handleToolkitPrompt("toolkit-design-entity", {
      entityName: "Product",
    });

    expect(result).not.toBeNull();
    expect(result?.messages).toBeDefined();
  });

  it("handles toolkit-design-entity with default entityName when not provided", async () => {
    const result = await handleToolkitPrompt("toolkit-design-entity", undefined);

    expect(result).not.toBeNull();
    expect(result?.description).toContain("Entity");
  });

  it("handles toolkit-design-entity with context", async () => {
    const result = await handleToolkitPrompt("toolkit-design-entity", {
      entityName: "Order",
      context: "For an e-commerce application",
    });

    expect(result).not.toBeNull();
    expect(result?.messages[0].content).toMatchObject({
      type: "text",
      text: expect.stringContaining("For an e-commerce application"),
    });
  });

  it("handles toolkit-design-entity without context", async () => {
    const result = await handleToolkitPrompt("toolkit-design-entity", {
      entityName: "Order",
    });

    expect(result).not.toBeNull();
    // Should not have the context suffix
    const textContent = (result?.messages[0].content as { text: string }).text;
    expect(textContent).not.toContain("Context:");
  });

  it("handles toolkit-setup-guide", async () => {
    const result = await handleToolkitPrompt("toolkit-setup-guide", undefined);

    expect(result).not.toBeNull();
    expect(result?.messages).toBeDefined();
  });

  it("handles toolkit-setup-guide with cursor client", async () => {
    const result = await handleToolkitPrompt("toolkit-setup-guide", {
      client: "cursor",
    });

    expect(result).not.toBeNull();
    expect(result?.description).toBe("Cursor Setup");
  });

  it("handles toolkit-setup-guide with claude-desktop client", async () => {
    const result = await handleToolkitPrompt("toolkit-setup-guide", {
      client: "claude-desktop",
    });

    expect(result).not.toBeNull();
    expect(result?.description).toBe("Claude Desktop Setup");
  });

  it("handles toolkit-setup-guide with vscode client", async () => {
    const result = await handleToolkitPrompt("toolkit-setup-guide", {
      client: "vscode",
    });

    expect(result).not.toBeNull();
    expect(result?.description).toBe("VS Code Setup");
  });

  it("handles toolkit-setup-guide with cli client", async () => {
    const result = await handleToolkitPrompt("toolkit-setup-guide", {
      client: "cli",
    });

    expect(result).not.toBeNull();
    expect(result?.description).toBe("CLI Setup");
  });

  it("handles toolkit-setup-guide with unknown client", async () => {
    const result = await handleToolkitPrompt("toolkit-setup-guide", {
      client: "unknown",
    });

    expect(result).not.toBeNull();
    expect(result?.description).toBe("Unknown client");
  });
});
