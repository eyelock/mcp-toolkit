/**
 * Toolkit Tools Registration
 *
 * Central registry for all toolkit MCP tools.
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleModelDesign, modelDesignTool } from "./model-design.js";
import { handleModelImport, modelImportTool } from "./model-import.js";
import { generateTool, handleGenerate } from "./generate.js";
import {
  handleSetupClient,
  handleSetupVerify,
  setupClientTool,
  setupVerifyTool,
} from "./setup-client.js";

// Re-export individual tools
export * from "./model-design.js";
export * from "./model-import.js";
export * from "./generate.js";
export * from "./setup-client.js";

/**
 * All toolkit tools
 */
export const toolkitTools: Tool[] = [
  modelDesignTool,
  modelImportTool,
  generateTool,
  setupClientTool,
  setupVerifyTool,
];

/**
 * Tool name to handler mapping
 */
const handlers: Record<string, (args: unknown, context: unknown) => Promise<CallToolResult>> = {
  "toolkit:model:design": handleModelDesign,
  "toolkit:model:import": handleModelImport,
  "toolkit:generate": handleGenerate,
  "toolkit:setup:client": handleSetupClient,
  "toolkit:setup:verify": handleSetupVerify,
};

/**
 * Get all toolkit tools for registration
 */
export function registerToolkitTools(): Tool[] {
  return toolkitTools;
}

/**
 * Handle a toolkit tool call
 */
export async function handleToolkitToolCall(
  name: string,
  args: unknown,
  context: unknown
): Promise<CallToolResult | null> {
  const handler = handlers[name];

  if (!handler) {
    return null; // Not a toolkit tool
  }

  return handler(args, context);
}

/**
 * Check if a tool name is a toolkit tool
 */
export function isToolkitTool(name: string): boolean {
  return name.startsWith("toolkit:");
}
