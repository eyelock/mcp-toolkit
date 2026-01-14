/**
 * Tools Registration
 *
 * Central registry for all MCP tools, including toolkit tools.
 */

import { getToolkitComponents, getToolkitHandlers } from "@mcp-toolkit/toolkit";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";
import { handleServerInfo, serverInfoTool } from "./server-info.js";
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

// Get toolkit components and handlers
const toolkitComponents = getToolkitComponents();
const toolkitHandlers = getToolkitHandlers();

/**
 * All available tools (core + toolkit)
 */
const coreTools: Tool[] = [
  sessionInitTool,
  sessionUpdateTool,
  sessionClearTool,
  sessionStatusTool,
  serverInfoTool,
];

/**
 * Tool handlers mapped by name (core tools only)
 */
const coreHandlers: Record<
  string,
  (args: unknown, context: ServerContext) => Promise<CallToolResult>
> = {
  session_init: handleSessionInit,
  session_update: handleSessionUpdate,
  session_clear: handleSessionClear,
  session_status: handleSessionStatus,
  server_info: handleServerInfo,
};

/**
 * Register all tools (core + toolkit)
 */
export function registerTools(): Tool[] {
  return [...coreTools, ...toolkitComponents.tools];
}

/**
 * Handle a tool call (core or toolkit)
 */
export async function handleToolCall(
  name: string,
  args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  // First check if it's a toolkit tool
  if (toolkitHandlers.isToolkitTool(name)) {
    const result = await toolkitHandlers.handleToolCall(name, args, context);
    if (result) {
      return result;
    }
  }

  // Then check core handlers
  const handler = coreHandlers[name];

  if (!handler) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  }

  return handler(args, context);
}
