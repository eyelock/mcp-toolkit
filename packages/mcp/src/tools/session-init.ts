/**
 * Session Init Tool
 *
 * Primary example demonstrating MCP tool patterns:
 * - Zod schema integration
 * - Provider usage
 * - Input validation
 */

import {
  type SessionConfig,
  SessionFeaturesSchema,
  SessionInitInputSchema,
} from "@mcp-toolkit/model";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ServerContext } from "../server.js";

/**
 * Tool definition for session-init
 */
export const sessionInitTool: Tool = {
  name: "session_init",
  description:
    "Initialize a new session with project configuration. Sets up the project name and enables MCP features (tools, resources, prompts, sampling).",
  inputSchema: zodToJsonSchema(SessionInitInputSchema) as Tool["inputSchema"],
};

/**
 * Handle session-init tool call
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

  // Initialize session
  const result = await context.provider.initSession(input);

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
          `Created: ${session.createdAt}`,
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
          `Created: ${session.createdAt}`,
          `Updated: ${session.updatedAt}`,
        ].join("\n"),
      },
    ],
  };
}
