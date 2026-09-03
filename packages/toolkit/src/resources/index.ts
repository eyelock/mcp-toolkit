/**
 * Toolkit Resources Registration
 *
 * Central registry for all toolkit MCP resources.
 */

import type {
  ReadResourceResult,
  Resource,
  ResourceTemplateType,
} from "@modelcontextprotocol/server";
import { clientsResourceTemplate, getClientNames, readClientConfigResource } from "./clients.js";
import { MODEL_RESOURCE_URI, modelResource, readModelResource } from "./model.js";
import { getTemplateTypes, readTemplateResource, templatesResourceTemplate } from "./templates.js";

export * from "./clients.js";
// Re-export individual resources
export * from "./model.js";
export * from "./templates.js";

/**
 * All toolkit static resources
 */
export const toolkitResources: Resource[] = [modelResource];

/**
 * All toolkit resource templates
 */
export const toolkitResourceTemplates: ResourceTemplateType[] = [
  templatesResourceTemplate,
  clientsResourceTemplate,
];

/**
 * Get all toolkit resources for registration
 */
export function registerToolkitResources(): Resource[] {
  return toolkitResources;
}

/**
 * Get all toolkit resource templates for registration
 */
export function registerToolkitResourceTemplates(): ResourceTemplateType[] {
  return toolkitResourceTemplates;
}

/**
 * Handle a toolkit resource read
 */
export async function handleToolkitResourceRead(uri: string): Promise<ReadResourceResult | null> {
  // Check static resources
  if (uri === MODEL_RESOURCE_URI) {
    return readModelResource();
  }

  // Check templated resources
  const templatesMatch = uri.match(/^toolkit:\/\/templates\/(.+)$/);
  if (templatesMatch?.[1]) {
    const type = templatesMatch[1];
    const result = await readTemplateResource(type);
    if (result) return result;

    // Return available types if not found
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              error: `Unknown template type: ${type}`,
              available: getTemplateTypes(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const clientsMatch = uri.match(/^toolkit:\/\/clients\/(.+)\/config$/);
  if (clientsMatch?.[1]) {
    const clientName = clientsMatch[1];
    const result = await readClientConfigResource(clientName);
    if (result) return result;

    // Return available clients if not found
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              error: `Unknown client: ${clientName}`,
              available: getClientNames(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return null; // Not a toolkit resource
}

/**
 * Check if a URI is a toolkit resource
 */
export function isToolkitResource(uri: string): boolean {
  return uri.startsWith("toolkit://");
}
