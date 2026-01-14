/**
 * Resources Registration
 *
 * Central registry for all MCP resources and resource templates, including toolkit resources.
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

import { getToolkitComponents, getToolkitHandlers } from "@mcp-toolkit/toolkit";
import type {
  ReadResourceResult,
  Resource,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";
import { SESSION_RESOURCE_URI, readSessionResource, sessionResource } from "./session.js";
import { handleTemplatedResourceRead, registerResourceTemplates } from "./templates.js";

// Re-export templates module
export * from "./templates.js";

// Get toolkit components and handlers
const toolkitComponents = getToolkitComponents();
const toolkitHandlers = getToolkitHandlers();

/**
 * All core static resources
 */
const coreResources: Resource[] = [sessionResource];

/**
 * Resource readers mapped by URI (core resources only)
 */
const coreReaders: Record<string, (context: ServerContext) => Promise<ReadResourceResult>> = {
  [SESSION_RESOURCE_URI]: readSessionResource,
};

/**
 * Register all static resources (core + toolkit)
 */
export function registerResources(): Resource[] {
  return [...coreResources, ...toolkitComponents.resources];
}

/**
 * Register all resource templates (core + toolkit)
 */
export function getResourceTemplates(): ResourceTemplate[] {
  return [...registerResourceTemplates(), ...toolkitComponents.resourceTemplates];
}

/**
 * Handle a resource read (static or templated)
 *
 * This function checks toolkit resources first, then core static resources,
 * then tries template matching.
 */
export async function handleResourceRead(
  uri: string,
  context: ServerContext
): Promise<ReadResourceResult> {
  // First check if it's a toolkit resource
  if (toolkitHandlers.isToolkitResource(uri)) {
    const result = await toolkitHandlers.handleResourceRead(uri);
    if (result) {
      return result;
    }
  }

  // Then check core static resources
  const reader = coreReaders[uri];
  if (reader) {
    return reader(context);
  }

  // Then try templated resources
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
