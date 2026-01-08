/**
 * MCP Server Setup
 *
 * Creates and configures the MCP server with tools, resources, and prompts.
 * Supports the composite execution strategy pattern for tool delegation.
 */

import type { ServerIdentity, ToolStrategyConfig } from "@mcp-toolkit/model";
import type { SessionProvider } from "@mcp-toolkit/provider";
import { createMemoryProvider } from "@mcp-toolkit/provider";
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
 * Default tool strategies for out-of-the-box functionality
 *
 * Tools default to "local-only" (self-reliant), but certain tools
 * benefit from delegation when the LLM knows better.
 *
 * Client discovery is configured as "delegate-first" because only
 * the LLM knows what model it is - this is a perfect delegation case.
 */
const DEFAULT_TOOL_STRATEGIES: ToolStrategyConfig = {
  // Client discovery: Only the LLM knows its own model identifier
  "session_init:client_discovery": {
    strategy: "delegate-first",
    fallbackEnabled: true,
  },
};

export interface ServerConfig {
  name?: string;
  version?: string;
  provider?: SessionProvider;
  identity?: ServerIdentity;
  /** Default tool execution strategies */
  defaultToolStrategies?: ToolStrategyConfig;
}

export function createServer(config: ServerConfig = {}): Server {
  const {
    name = "mcp-toolkit",
    version = "0.0.0",
    provider = createMemoryProvider(),
    identity = { canonicalName: name, tags: {} },
    defaultToolStrategies = {},
  } = config;

  // Merge user-provided strategies with defaults (user overrides take precedence)
  const mergedStrategies: ToolStrategyConfig = {
    ...DEFAULT_TOOL_STRATEGIES,
    ...defaultToolStrategies,
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
  // Server instance is needed for sampling access in composite strategy execution
  const context: ServerContext = {
    server,
    provider,
    identity,
    name,
    version,
    defaultToolStrategies: mergedStrategies,
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
  /** Default tool execution strategies */
  defaultToolStrategies?: ToolStrategyConfig;
};
