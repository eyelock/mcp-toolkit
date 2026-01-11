/**
 * MCP Server Setup
 *
 * Creates and configures the MCP server with tools, resources, and prompts.
 * Supports the tool delegation pattern.
 */

import type { ServerIdentity, ToolDelegationConfig } from "@mcp-toolkit/model";
import type { SessionProvider } from "@mcp-toolkit/storage";
import { createMemoryProvider } from "@mcp-toolkit/storage";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleGetPrompt, registerPrompts } from "./prompts/index.js";
import { handleResourceRead, registerResources } from "./resources/index.js";
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
}

export function createServer(config: ServerConfig = {}): Server {
  const {
    name = "mcp-toolkit",
    version = "0.0.0",
    provider = createMemoryProvider(),
    identity = { canonicalName: name, tags: {} },
    defaultToolDelegations = {},
  } = config;

  // Merge user-provided delegations with defaults (user overrides take precedence)
  const mergedDelegations: ToolDelegationConfig = {
    ...DEFAULT_TOOL_DELEGATIONS,
    ...defaultToolDelegations,
  };

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
  };

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registerTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments ?? {}, context);
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

  return server;
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
};
