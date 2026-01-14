/**
 * Session Init Tool
 *
 * Primary example demonstrating MCP tool patterns:
 * - Zod schema integration
 * - Provider usage
 * - Input validation
 * - Composite execution strategy (client discovery via delegation)
 */

import {
  type ClientMetadata,
  type SessionConfig,
  SessionFeaturesSchema,
  SessionInitInputSchema,
} from "@mcp-toolkit/model";
import { getToolkitComponents } from "@mcp-toolkit/toolkit";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { logDebug, logInfo } from "../logging.js";
import type { ServerContext } from "../server.js";
import { discoverClientMetadata } from "../strategy/client-discovery.js";
import { executeWithDelegation, resolveToolDelegation } from "../strategy/index.js";

/** Tool name for client discovery sub-task */
const CLIENT_DISCOVERY_TOOL = "session_init:client_discovery";

/**
 * Tool definition for session-init
 *
 * Demonstrates the composite execution strategy pattern:
 * - Accepts clientMetadata directly if provided
 * - Uses sampling to discover client identity if not provided (delegate-first)
 * - Falls back gracefully if sampling is unavailable
 */
export const sessionInitTool: Tool = {
  name: "session_init",
  description:
    "Initialize a new session with project configuration. Sets up the project name, enables MCP features, " +
    "and optionally discovers client metadata via sampling.",
  inputSchema: zodToJsonSchema(SessionInitInputSchema) as Tool["inputSchema"],
};

/**
 * Handle session-init tool call
 *
 * Demonstrates the composite execution strategy pattern:
 * 1. If clientMetadata provided -> use directly (no need to delegate)
 * 2. If discoverClient=true -> use delegate-first strategy for discovery
 * 3. Proceed with or without metadata (non-blocking)
 */
export async function handleSessionInit(
  args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  // Validate input
  const parseResult = SessionInitInputSchema.safeParse(args);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid input: ${parseResult.error.message}`,
        },
      ],
      isError: true,
    };
  }

  const input = parseResult.data;
  const { projectName, features, clientMetadata, discoverClient = true } = input;

  // Check if session already exists
  const hasSession = await context.provider.hasSession();
  if (hasSession) {
    const existing = await context.provider.getSession();
    return {
      content: [
        {
          type: "text",
          text: `Session already exists for project "${existing.data?.projectName}". Use session_update to modify or session_clear to reset.`,
        },
      ],
      isError: true,
    };
  }

  // ==========================================================================
  // Composite Strategy: Client Metadata Resolution
  //
  // This demonstrates the "delegate-first" pattern:
  // - Only the LLM knows what model it is
  // - If metadata not provided and discovery enabled, ask the LLM via sampling
  // - Fall back gracefully if sampling unavailable
  // ==========================================================================
  let resolvedMetadata: ClientMetadata | undefined = clientMetadata;
  let metadataSource: "provided" | "discovered" | "unavailable" = "unavailable";

  if (clientMetadata) {
    // Case 1: Client metadata was provided directly - no delegation needed
    metadataSource = "provided";
    logDebug("Using provided client metadata", {
      metadata: { clientName: clientMetadata.clientName, model: clientMetadata.model },
    });
  } else if (discoverClient) {
    // Case 2: Attempt to discover via sampling using configured delegation
    // This is a perfect use case - only the LLM knows its own model identifier
    //
    // Delegation is resolved from context.defaultToolDelegations configuration.
    // Default is "local-only" (self-reliant), but can be configured to:
    // - "delegate-first": Try sampling, fallback to local
    // - "delegate-only": Must delegate, error if unavailable
    const delegation = resolveToolDelegation(CLIENT_DISCOVERY_TOOL, context.defaultToolDelegations);

    logDebug("Attempting client discovery", {
      metadata: {
        mode: delegation.mode,
        fallbackEnabled: delegation.fallbackEnabled,
      },
    });

    const delegationResult = await executeWithDelegation(
      context.server,
      { timeout: delegation.delegationTimeout ?? 30_000 },
      // Delegation function - ask the LLM about itself
      async (server, delegateArgs) => {
        return discoverClientMetadata(server, delegateArgs.timeout);
      },
      // Local function - we don't know locally, return null
      async () => null,
      {
        mode: delegation.mode,
        toolName: CLIENT_DISCOVERY_TOOL,
        delegationTimeout: delegation.delegationTimeout,
        fallbackEnabled: delegation.fallbackEnabled,
      }
    );

    if (delegationResult.outcome === "delegated" && delegationResult.result) {
      resolvedMetadata = delegationResult.result as ClientMetadata;
      metadataSource = "discovered";
      logInfo("Client metadata discovered via sampling", {
        metadata: {
          clientName: resolvedMetadata.clientName,
          model: resolvedMetadata.model,
          outcome: delegationResult.outcome,
        },
      });
    } else {
      logDebug("Client discovery not available or failed", {
        metadata: {
          outcome: delegationResult.outcome,
          delegationAttempted: delegationResult.delegationAttempted,
        },
      });
    }
  }

  // Initialize session with resolved data
  // Note: discoverClient is only used by the tool, not stored in session
  const sessionInput = {
    projectName,
    features,
    clientMetadata: resolvedMetadata,
    discoverClient: false, // Not relevant for storage, already processed above
  };

  const result = await context.provider.initSession(sessionInput);

  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to initialize session: ${result.error}`,
        },
      ],
      isError: true,
    };
  }

  const session = result.data as SessionConfig;
  const enabledFeatures = Object.entries(session.features)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);

  const { identity } = context;
  const tagEntries = Object.entries(identity.tags);
  const tagsDisplay =
    tagEntries.length > 0 ? tagEntries.map(([k, v]) => `${k}=${v}`).join(", ") : "(none)";

  // Build client info display
  let clientInfoDisplay = "(not available)";
  if (resolvedMetadata) {
    const parts: string[] = [];
    if (resolvedMetadata.clientName) parts.push(resolvedMetadata.clientName);
    if (resolvedMetadata.model) parts.push(`model: ${resolvedMetadata.model}`);
    if (parts.length > 0) {
      clientInfoDisplay = `${parts.join(", ")} [${metadataSource}]`;
    }
  }

  // Get toolkit guidance for next steps
  const toolkitComponents = getToolkitComponents();
  const toolkitPromptNames = toolkitComponents.prompts.map((p) => p.name);
  const toolkitToolCount = toolkitComponents.tools.length;
  const toolkitResourceCount =
    toolkitComponents.resources.length + toolkitComponents.resourceTemplates.length;

  return {
    content: [
      {
        type: "text",
        text: [
          "Session initialized successfully!",
          "",
          `Server: ${identity.canonicalName}`,
          `Tags: ${tagsDisplay}`,
          `Project: ${session.projectName}`,
          `Features: ${enabledFeatures.join(", ") || "none"}`,
          `Client: ${clientInfoDisplay}`,
          `Created: ${session.createdAt}`,
          "",
          "─────────────────────────────────────────────",
          "Toolkit Onboarding",
          "─────────────────────────────────────────────",
          "",
          "Ready to customize your MCP server! Available guided workflows:",
          "",
          "Prompts (use prompts/get or prompts/list):",
          ...toolkitPromptNames.map((name) => `  • ${name}`),
          "",
          `Also available: ${toolkitToolCount} toolkit tools, ${toolkitResourceCount} resources`,
          "",
          "Start with: prompts/get toolkit-setup-guide",
        ].join("\n"),
      },
    ],
  };
}

/**
 * Session Update Tool
 */
export const sessionUpdateTool: Tool = {
  name: "session_update",
  description: "Update the current session configuration.",
  inputSchema: zodToJsonSchema(
    z.object({
      projectName: z.string().optional().describe("New project name"),
      features: SessionFeaturesSchema.partial().optional().describe("Features to update"),
    })
  ) as Tool["inputSchema"],
};

export async function handleSessionUpdate(
  args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  const hasSession = await context.provider.hasSession();
  if (!hasSession) {
    return {
      content: [
        {
          type: "text",
          text: "No active session. Use session_init to create one first.",
        },
      ],
      isError: true,
    };
  }

  const result = await context.provider.updateSession(args as Record<string, unknown>);

  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to update session: ${result.error}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Session updated successfully. Project: ${result.data?.projectName}`,
      },
    ],
  };
}

/**
 * Session Clear Tool
 */
export const sessionClearTool: Tool = {
  name: "session_clear",
  description: "Clear the current session.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleSessionClear(
  _args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  await context.provider.clearSession();
  return {
    content: [
      {
        type: "text",
        text: "Session cleared.",
      },
    ],
  };
}

/**
 * Session Status Tool
 */
export const sessionStatusTool: Tool = {
  name: "session_status",
  description: "Get the current session status and configuration.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleSessionStatus(
  _args: unknown,
  context: ServerContext
): Promise<CallToolResult> {
  const result = await context.provider.getSession();

  if (!result.data) {
    return {
      content: [
        {
          type: "text",
          text: "No active session. Use session_init to create one.",
        },
      ],
    };
  }

  const session = result.data;
  const enabledFeatures = Object.entries(session.features)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);

  const { identity } = context;
  const tagEntries = Object.entries(identity.tags);
  const tagsDisplay =
    tagEntries.length > 0 ? tagEntries.map(([k, v]) => `${k}=${v}`).join(", ") : "(none)";

  // Build client info display
  let clientInfoDisplay = "(not available)";
  if (session.clientMetadata) {
    const parts: string[] = [];
    if (session.clientMetadata.clientName) parts.push(session.clientMetadata.clientName);
    if (session.clientMetadata.model) parts.push(`model: ${session.clientMetadata.model}`);
    if (parts.length > 0) {
      clientInfoDisplay = parts.join(", ");
    }
  }

  return {
    content: [
      {
        type: "text",
        text: [
          "Session Status",
          "─────────────",
          `Server: ${identity.canonicalName}`,
          `Tags: ${tagsDisplay}`,
          `Project: ${session.projectName}`,
          `Features: ${enabledFeatures.join(", ") || "none"}`,
          `Client: ${clientInfoDisplay}`,
          `Created: ${session.createdAt}`,
          `Updated: ${session.updatedAt}`,
        ].join("\n"),
      },
    ],
  };
}
