/**
 * MCP Server Setup
 *
 * Creates and configures the MCP server with tools, resources, and prompts.
 */

import type { ServerIdentity } from "@mcp-toolkit/model";
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

export interface ServerConfig {
  name?: string;
  version?: string;
  provider?: SessionProvider;
  identity?: ServerIdentity;
}

export function createServer(config: ServerConfig = {}): Server {
  const {
    name = "mcp-toolkit",
    version = "0.0.0",
    provider = createMemoryProvider(),
    identity = { canonicalName: name, tags: {} },
  } = config;

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

  // Store provider and identity in server context for handlers
  const context: ServerContext = { provider, identity, name, version };

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
  provider: SessionProvider;
  identity: ServerIdentity;
  name: string;
  version: string;
};
