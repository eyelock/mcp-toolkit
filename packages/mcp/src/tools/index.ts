/**
 * Tools Registration
 *
 * Central registry for all MCP tools.
 */

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

/**
 * All available tools
 */
const tools: Tool[] = [
  sessionInitTool,
  sessionUpdateTool,
  sessionClearTool,
  sessionStatusTool,
  serverInfoTool,
];

/**
 * Tool handlers mapped by name
 */
const handlers: Record<string, (args: unknown, context: ServerContext) => Promise<CallToolResult>> =
  {
    session_init: handleSessionInit,
    session_update: handleSessionUpdate,
    session_clear: handleSessionClear,
    session_status: handleSessionStatus,
    server_info: handleServerInfo,
  };

/**
 * Register all tools
 */
export function registerTools(): Tool[] {
  return tools;
}

/**
 * Handle a tool call
 */
export async function handleToolCall(
  name: string,
  args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  const handler = handlers[name];

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
