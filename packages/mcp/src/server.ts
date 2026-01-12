/**
 * MCP Server Setup
 *
 * Creates and configures the MCP server with tools, resources, and prompts.
 * Supports the tool delegation pattern.
 *
 * Session and Request Tracking:
 * - Each server instance has a unique sessionId (generated at creation)
 * - Each request can have a requestId (from MCP _meta or auto-generated)
 * - Hooks are fired at session start/end and around tool execution
 */

import { randomUUID } from "node:crypto";
import type { SessionProvider } from "@mcp-toolkit/core";
import { createMemoryProvider } from "@mcp-toolkit/core";
import type { ServerIdentity, ToolDelegationConfig } from "@mcp-toolkit/model";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadCoreHooks } from "./hooks/index.js";
import { handleGetPrompt, registerPrompts } from "./prompts/index.js";
import { handleResourceRead, registerResources } from "./resources/index.js";
import { type SessionStateTracker, createSessionStateTracker } from "./spec/session-state.js";
import { handleToolCall, registerTools } from "./tools/index.js";

/**
 * Default tool delegations for out-of-the-box functionality
 *
 * Tools default to "local-only" (self-reliant), but certain tools
 * benefit from delegation when the LLM knows better.
 *
 * Client discovery is configured as "delegate-first" because only
 * the LLM knows what model it is - this is a perfect delegation case.
 */
const DEFAULT_TOOL_DELEGATIONS: ToolDelegationConfig = {
  // Client discovery: Only the LLM knows its own model identifier
  "session_init:client_discovery": {
    mode: "delegate-first",
    fallbackEnabled: true,
  },
};

export interface ServerConfig {
  name?: string;
  version?: string;
  provider?: SessionProvider;
  identity?: ServerIdentity;
  /** Default tool delegation configuration */
  defaultToolDelegations?: ToolDelegationConfig;
  /** Optional session ID (auto-generated if not provided) */
  sessionId?: string;
  /** Tools that require session initialization before use */
  requiresInitTools?: string[];
}

/**
 * Result of createServer - includes both the MCP Server and context
 */
export interface CreateServerResult {
  /** The MCP SDK Server instance */
  server: Server;
  /** Server context with session tracking and hooks */
  context: ServerContext;
}

export function createServer(config: ServerConfig = {}): CreateServerResult {
  const {
    name = "mcp-toolkit",
    version = "0.0.0",
    provider = createMemoryProvider(),
    identity = { canonicalName: name, tags: {} },
    defaultToolDelegations = {},
    sessionId = randomUUID(),
    requiresInitTools = [],
  } = config;

  // Merge user-provided delegations with defaults (user overrides take precedence)
  const mergedDelegations: ToolDelegationConfig = {
    ...DEFAULT_TOOL_DELEGATIONS,
    ...defaultToolDelegations,
  };

  // Create session state tracker for workflow enforcement
  const sessionStateTracker = createSessionStateTracker("session_init", requiresInitTools);
  sessionStateTracker.setSessionId(sessionId);

  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Store provider, identity, and server in context for handlers
  // Server instance is needed for sampling access in tool delegation
  const context: ServerContext = {
    server,
    provider,
    identity,
    name,
    version,
    defaultToolDelegations: mergedDelegations,
    sessionId,
    sessionStateTracker,
    // Request ID tracking - updated per request
    currentRequestId: null,
  };

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registerTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Extract or generate requestId for this call
    const requestId = (request.params._meta?.progressToken as string | undefined) ?? randomUUID();
    context.currentRequestId = requestId;

    // Check if tool is allowed given current session state
    const blockMessage = sessionStateTracker.checkToolAllowed(request.params.name, requestId);
    if (blockMessage) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: blockMessage }],
      };
    }

    // Execute the tool
    const result = await handleToolCall(
      request.params.name,
      request.params.arguments ?? {},
      context
    );

    // Record the tool call for state tracking
    sessionStateTracker.recordToolCall(request.params.name, requestId);

    return result;
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: registerResources(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return handleResourceRead(request.params.uri, context);
  });

  // Register prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: registerPrompts(),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return handleGetPrompt(request.params.name, request.params.arguments, context);
  });

  return { server, context };
}

export type ServerContext = {
  /** MCP Server instance for sampling access (optional for backward compatibility with tests) */
  server?: Server;
  /** Session provider for storage */
  provider: SessionProvider;
  /** Server identity with canonical name and tags */
  identity: ServerIdentity;
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Default tool delegation configuration */
  defaultToolDelegations?: ToolDelegationConfig;
  /** Unique session ID for this server instance */
  sessionId: string;
  /** Session state tracker for workflow enforcement */
  sessionStateTracker: SessionStateTracker;
  /** Current request ID (updated per request) */
  currentRequestId: string | null;
};

/**
 * Get session start hooks content
 *
 * Call this when the session begins to get guidance for the LLM.
 */
export async function getSessionStartHooks(
  context: ServerContext
): Promise<{ content: string; sessionId: string; requestId: string | null }> {
  const { content } = await loadCoreHooks("session", "start");
  return {
    content,
    sessionId: context.sessionId,
    requestId: context.currentRequestId,
  };
}

/**
 * Get session end hooks content
 *
 * Call this when the session ends to get cleanup guidance for the LLM.
 */
export async function getSessionEndHooks(
  context: ServerContext
): Promise<{ content: string; sessionId: string }> {
  const { content } = await loadCoreHooks("session", "end");
  return {
    content,
    sessionId: context.sessionId,
  };
}
