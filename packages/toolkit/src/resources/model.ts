/**
 * Model Resource
 *
 * Provides access to the current domain model via MCP resource.
 */

import type { ReadResourceResult, Resource } from "@modelcontextprotocol/sdk/types.js";
import { createToolkitStorage } from "../model/index.js";

/**
 * Resource URI for the domain model
 */
export const MODEL_RESOURCE_URI = "toolkit://model";

/**
 * Resource definition for the domain model
 */
export const modelResource: Resource = {
  uri: MODEL_RESOURCE_URI,
  name: "Domain Model",
  description: "The current domain model being designed with the toolkit",
  mimeType: "application/json",
};

/**
 * Read the domain model resource
 */
export async function readModelResource(): Promise<ReadResourceResult> {
  const storage = createToolkitStorage();
  const result = storage.loadModel();

  if (!result.success || !result.data) {
    return {
      contents: [
        {
          uri: MODEL_RESOURCE_URI,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              error: "No model found",
              hint: "Use toolkit:model:design with action 'start' to create a model",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri: MODEL_RESOURCE_URI,
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
}
