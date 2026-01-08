/**
 * Client Identity Discovery via Sampling
 *
 * Uses the composite strategy pattern to discover client metadata.
 * This is a perfect use case for delegation - only the LLM knows what model it is.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ClientMetadata } from "@mcp-toolkit/model";
import { ClientMetadataSchema } from "@mcp-toolkit/model";
import { logDebug, logWarning, logInfo } from "../logging.js";
import { clientSupportsSampling, extractTextFromSamplingResponse } from "./index.js";

// =============================================================================
// Constants
// =============================================================================

/**
 * Prompt for client discovery via sampling
 *
 * This asks the LLM to identify itself. Only the LLM knows what model it is,
 * making this a perfect use case for delegation.
 */
const CLIENT_DISCOVERY_PROMPT = `You are helping an MCP server identify the client environment.
Please respond with a JSON object containing information about yourself:

{
  "clientName": "name of your client application (e.g., 'claude-desktop', 'cursor', 'vscode')",
  "clientVersion": "your version if known",
  "model": "your model identifier (e.g., 'claude-opus-4-5-20251101', 'gpt-4-turbo')",
  "modelProvider": "your provider (e.g., 'anthropic', 'openai')",
  "capabilities": {
    "supportsStreaming": true,
    "supportsImages": true,
    "supportsFunctionCalling": true
  }
}

IMPORTANT: Only respond with the JSON object, no other text. Use null for unknown fields.`;

/** Default timeout for client discovery */
export const CLIENT_DISCOVERY_TIMEOUT_MS = 30_000;

// =============================================================================
// Client Discovery
// =============================================================================

/**
 * Attempt to discover client metadata via sampling
 *
 * This function uses sampling to ask the host LLM about itself.
 * It's a demonstration of the "someone else is better" pattern -
 * only the LLM knows its own model identifier.
 *
 * @param server - MCP Server instance with sampling access
 * @param timeout - Timeout for the sampling request in milliseconds
 * @returns Discovered client metadata or null if discovery failed/unavailable
 *
 * @example
 * ```typescript
 * const metadata = await discoverClientMetadata(server);
 * if (metadata) {
 *   console.log(`Connected to ${metadata.model} via ${metadata.clientName}`);
 * }
 * ```
 */
export async function discoverClientMetadata(
  server: Server,
  timeout: number = CLIENT_DISCOVERY_TIMEOUT_MS
): Promise<ClientMetadata | null> {
  // Check if sampling is available
  if (!clientSupportsSampling(server)) {
    logDebug("Client discovery skipped: sampling not available");
    return null;
  }

  try {
    logDebug("Attempting client discovery via sampling");

    // Use sampling to ask the LLM about itself
    const response = await server.createMessage(
      {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: CLIENT_DISCOVERY_PROMPT,
            },
          },
        ],
        maxTokens: 500,
      },
      { timeout }
    );

    const text = extractTextFromSamplingResponse(response);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text.trim();

    // Handle ```json ... ``` or ``` ... ``` code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    // Parse and validate
    const parsed = JSON.parse(jsonStr);
    const validated = ClientMetadataSchema.safeParse(parsed);

    if (validated.success) {
      logInfo("Client discovery successful", {
        metadata: {
          clientName: validated.data.clientName,
          model: validated.data.model,
          modelProvider: validated.data.modelProvider,
        },
      });
      return validated.data;
    }

    logWarning("Client discovery response failed validation", {
      metadata: { error: validated.error.message },
    });
    return null;
  } catch (error) {
    logWarning("Client discovery failed", {
      metadata: { error: String(error) },
    });
    return null;
  }
}

/**
 * Create a sampling request for client discovery
 *
 * This is useful if you want to construct the request manually
 * or integrate with custom sampling flows.
 *
 * @returns CreateMessageRequest params for client discovery
 */
export function createClientDiscoveryRequest(): {
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
  maxTokens: number;
} {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: CLIENT_DISCOVERY_PROMPT,
        },
      },
    ],
    maxTokens: 500,
  };
}

/**
 * Parse a client discovery response
 *
 * @param responseText - Raw text response from sampling
 * @returns Validated ClientMetadata or null if parsing failed
 */
export function parseClientDiscoveryResponse(responseText: string): ClientMetadata | null {
  try {
    let jsonStr = responseText.trim();

    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const validated = ClientMetadataSchema.safeParse(parsed);

    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}
