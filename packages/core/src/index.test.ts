/**
 * Main module entry point tests
 *
 * Verifies all exports are accessible from the root package entry.
 */

import { describe, expect, it } from "vitest";
import * as core from "./index.js";

describe("@mcp-toolkit/core exports", () => {
  it("exports all hook types and schemas", () => {
    // Schemas
    expect(core.HookTypeSchema).toBeDefined();
    expect(core.HookLifecycleSchema).toBeDefined();
    expect(core.HookDefinitionSchema).toBeDefined();
    expect(core.HookDefinitionInputSchema).toBeDefined();
    expect(core.RequirementLevelSchema).toBeDefined();
    expect(core.McpFeatureSchema).toBeDefined();
    expect(core.HookQueryOptionsSchema).toBeDefined();
  });

  it("exports registry classes and factories", () => {
    expect(core.HookRegistry).toBeDefined();
    expect(core.createHookRegistry).toBeDefined();
    expect(typeof core.createHookRegistry).toBe("function");
  });

  it("exports loader classes and utilities", () => {
    expect(core.HookContentLoader).toBeDefined();
    expect(core.createContentLoader).toBeDefined();
  });

  it("exports composer classes and utilities", () => {
    expect(core.HookComposer).toBeDefined();
    expect(core.createComposer).toBeDefined();
    expect(core.composeHooks).toBeDefined();
    expect(typeof core.composeHooks).toBe("function");
  });
});
