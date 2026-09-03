/**
 * Client Identity Discovery via Sampling
 *
 * Uses the composite strategy pattern to discover client metadata.
 * This is a perfect use case for delegation - only the LLM knows what model it is.
 */

import type { ClientMetadata } from "@mcp-toolkit/model";
import { ClientMetadataSchema } from "@mcp-toolkit/model";
import type { CreateMessageResult } from "@modelcontextprotocol/server";
import { logInfo, logWarning } from "../logging.js";
import { type DelegationSpec, extractTextFromSamplingResponse } from "./index.js";

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
 * The delegation spec for client discovery.
 *
 * Split into `build` (ask) and `parse` (read the answer) because delegation is
 * a round trip under `2026-07-28` - the handler cannot await a reply mid-call.
 *
 * This remains the archetypal delegation case: only the LLM knows what model it
 * is, so there is no local implementation that could ever be as good.
 *
 * @example
 * ```typescript
 * const outcome = await executeWithDelegation(
 *   context,
 *   undefined,
 *   clientDiscoverySpec,
 *   async () => null,
 *   { mode: "delegate-first", toolName: "session_init:client_discovery" }
 * );
 * if (outcome.outcome === "pending") return outcome.request as CallToolResult;
 * ```
 */
export const clientDiscoverySpec: DelegationSpec<unknown, ClientMetadata> = {
  key: "client_discovery",

  build: () => ({
    messages: [
      {
        role: "user" as const,
        content: { type: "text" as const, text: CLIENT_DISCOVERY_PROMPT },
      },
    ],
    maxTokens: 500,
  }),

  parse: (result) => {
    try {
      const text = extractTextFromSamplingResponse(result as CreateMessageResult);

      // Handle ```json ... ``` or ``` ... ``` code blocks
      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch?.[1]) {
        jsonStr = jsonMatch[1].trim();
      }

      const validated = ClientMetadataSchema.safeParse(JSON.parse(jsonStr));
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
      return undefined;
    } catch (error) {
      logWarning("Client discovery response could not be parsed", {
        metadata: { error: String(error) },
      });
      return undefined;
    }
  },
};

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
