/**
 * Resources Registration
 *
 * Central registry for all MCP resources and resource templates.
 *
 * ## Resources vs Resource Templates
 *
 * - **Resources**: Static URIs that always point to the same data
 *   Example: `session://current` - always returns current session
 *
 * - **Resource Templates**: Parameterized URIs using RFC 6570 templates
 *   Example: `log:///{date}` - returns logs for a specific date
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/server/resources
 */

import type {
  ReadResourceResult,
  Resource,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";
import { SESSION_RESOURCE_URI, readSessionResource, sessionResource } from "./session.js";
import { registerResourceTemplates, handleTemplatedResourceRead } from "./templates.js";

// Re-export templates module
export * from "./templates.js";

/**
 * All available static resources
 */
const resources: Resource[] = [sessionResource];

/**
 * Resource readers mapped by URI
 */
const readers: Record<string, (context: ServerContext) => Promise<ReadResourceResult>> = {
  [SESSION_RESOURCE_URI]: readSessionResource,
};

/**
 * Register all static resources
 */
export function registerResources(): Resource[] {
  return resources;
}

/**
 * Register all resource templates
 */
export function getResourceTemplates(): ResourceTemplate[] {
  return registerResourceTemplates();
}

/**
 * Handle a resource read (static or templated)
 *
 * This function first checks static resources, then tries template matching.
 */
export async function handleResourceRead(
  uri: string,
  context: ServerContext
): Promise<ReadResourceResult> {
  // First, check static resources
  const reader = readers[uri];
  if (reader) {
    return reader(context);
  }

  // Then, try templated resources
  const templatedResult = await handleTemplatedResourceRead(uri, context);
  if (templatedResult) {
    return templatedResult;
  }

  // Unknown resource
  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
        text: `Unknown resource: ${uri}`,
      },
    ],
  };
}
