/**
 * Server Info Tool
 *
 * Exposes server identity information to help clients distinguish
 * between different installations of the same canonical server.
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";

/**
 * Tool definition for server_info
 */
export const serverInfoTool: Tool = {
  name: "server_info",
  description:
    "Get server identity information including canonical name, version, and metadata tags. " +
    "Use this to identify the server and distinguish between different installations.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

/**
 * Handle server_info tool call
 */
export async function handleServerInfo(
  _args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  const { identity, name, version } = context;
  const tagEntries = Object.entries(identity.tags);

  const lines = [
    "Server Information",
    "─────────────────",
    `Canonical Name: ${identity.canonicalName}`,
    `Server Name: ${name}`,
    `Version: ${version}`,
  ];

  if (tagEntries.length > 0) {
    lines.push("Tags:");
    for (const [key, value] of tagEntries) {
      lines.push(`  ${key}=${value}`);
    }
  } else {
    lines.push("Tags: (none)");
  }

  return {
    content: [
      {
        type: "text",
        text: lines.join("\n"),
      },
    ],
  };
}
