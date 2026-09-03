/**
 * Stdio Transport (protocol revision 2026-07-28)
 *
 * Standard input/output transport for local development and MCP inspector.
 * Integrates with the hooks system for session lifecycle events.
 *
 * Unlike HTTP, stdio genuinely has one client for the life of the process, so
 * session start/end hooks still mean what they always did here.
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
 */

import type { Server } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { getSessionEndHooks, getSessionStartHooks, type ServerContext } from "../server.js";

/**
 * Builds a server instance and its context.
 */
export type ServerFactory = () => { server: Server; context: ServerContext };

/**
 * Stdio transport options
 */
export interface StdioTransportOptions {
  /**
   * Refuse 2025-era clients instead of serving them.
   *
   * Note the SDK spells the stdio enum `'serve' | 'reject'`, where HTTP uses
   * `'stateless' | 'reject'`; this flag hides that difference.
   */
  rejectLegacy?: boolean;
  /** Callback when session starts with hook content */
  onSessionStart?: (content: string, sessionId: string | null) => void;
  /** Callback when session ends with hook content */
  onSessionEnd?: (content: string, sessionId: string | null) => void;
}

/**
 * Create and connect a stdio transport to the server
 *
 * @param factory - Builds the server and context to serve this process
 * @param options - Transport options
 */
export async function createStdioTransport(
  factory: ServerFactory,
  options: StdioTransportOptions = {}
): Promise<void> {
  const { rejectLegacy = false, onSessionStart, onSessionEnd } = options;

  // One context for the life of the process - stdio serves a single client.
  const { context } = factory();

  const handle = serveStdio(() => factory().server, {
    legacy: rejectLegacy ? "reject" : "serve",
    onerror: (error) => {
      // stderr, never stdout: stdout carries the protocol.
      console.error(`[mcp-toolkit] handler error: ${error.message}`);
    },
  });

  const { content, sessionId } = await getSessionStartHooks(context);
  onSessionStart?.(content, sessionId);
  console.error(`[mcp-toolkit] Session started: ${sessionId ?? "(per-request handles)"}`);

  const shutdown = async (signal: string) => {
    const end = await getSessionEndHooks(context);
    onSessionEnd?.(end.content, end.sessionId);
    console.error(
      `[mcp-toolkit] Session ended: ${end.sessionId ?? "(per-request handles)"} (${signal})`
    );

    await handle.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
