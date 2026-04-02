/**
 * Stdio Transport
 *
 * Standard input/output transport for local development and MCP inspector.
 * Integrates with the hooks system for session lifecycle events.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getSessionEndHooks, getSessionStartHooks, type ServerContext } from "../server.js";

/**
 * Stdio transport options
 */
export interface StdioTransportOptions {
  /** Server context for hooks (optional for backwards compatibility) */
  context?: ServerContext;
  /** Callback when session starts with hook content */
  onSessionStart?: (content: string, sessionId: string) => void;
  /** Callback when session ends with hook content */
  onSessionEnd?: (content: string, sessionId: string) => void;
}

/**
 * Create and connect a stdio transport to the server
 *
 * @param server - MCP Server instance
 * @param options - Transport options including context for hooks
 */
export async function createStdioTransport(
  server: Server,
  options: StdioTransportOptions = {}
): Promise<void> {
  const { context, onSessionStart, onSessionEnd } = options;

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Fire session start hooks if context is available
  if (context) {
    const { content, sessionId } = await getSessionStartHooks(context);
    if (onSessionStart) {
      onSessionStart(content, sessionId);
    }
    // Log session start for debugging (stderr so it doesn't interfere with stdio protocol)
    console.error(`[mcp-toolkit] Session started: ${sessionId}`);
  }

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    // Fire session end hooks if context is available
    if (context) {
      const { content, sessionId } = await getSessionEndHooks(context);
      if (onSessionEnd) {
        onSessionEnd(content, sessionId);
      }
      console.error(`[mcp-toolkit] Session ended: ${sessionId} (${signal})`);
    }

    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
