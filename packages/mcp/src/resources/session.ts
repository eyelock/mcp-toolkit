/**
 * Session Resource
 *
 * Exposes the current session configuration as an MCP resource.
 */

import type { ReadResourceResult, Resource } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";

export const SESSION_RESOURCE_URI = "session://current";

/**
 * Session resource definition
 */
export const sessionResource: Resource = {
  uri: SESSION_RESOURCE_URI,
  name: "Current Session",
  description: "The current session configuration including project name and enabled features",
  mimeType: "application/json",
};

/**
 * Read the session resource
 */
export async function readSessionResource(context: ServerContext): Promise<ReadResourceResult> {
  const result = await context.provider.getSession();

  if (!result.data) {
    return {
      contents: [
        {
          uri: SESSION_RESOURCE_URI,
          mimeType: "application/json",
          text: JSON.stringify({ error: "No active session" }, null, 2),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri: SESSION_RESOURCE_URI,
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
}
