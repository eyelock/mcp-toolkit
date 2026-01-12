/**
 * Tools Index Tests
 */

import { describe, expect, it } from "vitest";
import {
  toolkitTools,
  registerToolkitTools,
  isToolkitTool,
  handleToolkitToolCall,
} from "./index.js";

describe("toolkitTools", () => {
  it("exports all expected tools", () => {
    const toolNames = toolkitTools.map((t) => t.name);

    expect(toolNames).toContain("toolkit:model:design");
    expect(toolNames).toContain("toolkit:model:import");
    expect(toolNames).toContain("toolkit:generate");
    expect(toolNames).toContain("toolkit:setup:client");
    expect(toolNames).toContain("toolkit:setup:verify");
  });

  it("has 5 tools", () => {
    expect(toolkitTools).toHaveLength(5);
  });
});

describe("registerToolkitTools", () => {
  it("returns all toolkit tools", () => {
    const tools = registerToolkitTools();
    expect(tools).toEqual(toolkitTools);
  });
});

describe("isToolkitTool", () => {
  it("returns true for toolkit tools", () => {
    expect(isToolkitTool("toolkit:model:design")).toBe(true);
    expect(isToolkitTool("toolkit:generate")).toBe(true);
    expect(isToolkitTool("toolkit:setup:client")).toBe(true);
  });

  it("returns false for non-toolkit tools", () => {
    expect(isToolkitTool("other:tool")).toBe(false);
    expect(isToolkitTool("session_init")).toBe(false);
  });
});

describe("handleToolkitToolCall", () => {
  it("returns null for unknown tools", async () => {
    const result = await handleToolkitToolCall("unknown:tool", {}, {});
    expect(result).toBeNull();
  });

  it("handles toolkit:model:design", async () => {
    const result = await handleToolkitToolCall("toolkit:model:design", { action: "show" }, {});

    expect(result).not.toBeNull();
    expect(result?.content).toBeDefined();
  });
});
