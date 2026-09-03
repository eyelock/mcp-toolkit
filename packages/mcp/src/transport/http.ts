/**
 * HTTP Transport (Streamable HTTP, protocol revision 2026-07-28)
 *
 * Serves both protocol eras from one server definition:
 *
 * - **Modern (`2026-07-28`)** - stateless. Every request carries its own `_meta`
 *   envelope, so any instance can serve any request and a plain round-robin
 *   load balancer is enough. No sticky routing, no session store.
 * - **Legacy (2025-era)** - handled by the SDK's `legacy: "stateless"` fallback,
 *   which translates modern-style handler returns down for older clients. One
 *   server definition backs both, so the eras cannot drift apart.
 *
 * This replaces the previous HTTP+SSE wiring (`/sse` + `/message/:sessionId`),
 * which was the 2024-11-05 transport: deprecated by Streamable HTTP in
 * 2025-03-26 and superseded again here. There is no long-lived stream and no
 * per-connection session, which is the entire point of the revision.
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
 */

import { createServer as createHttpServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
  type Server,
} from "@modelcontextprotocol/server";
import { getSessionEndHooks, getSessionStartHooks, type ServerContext } from "../server.js";

/** Convert Node's header bag into Web Headers, dropping undefined entries. */
function toHeaders(raw: NodeJS.Dict<string | string[]>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

/**
 * Builds a server instance to serve a request.
 *
 * A factory rather than a single instance: under the stateless protocol the SDK
 * may build a server per request, which is what allows requests to be spread
 * across instances freely.
 */
export type ServerFactory = () => { server: Server; context: ServerContext };

export interface HttpTransportConfig {
  port?: number;
  host?: string;
  authToken?: string;
  /**
   * Origins permitted by CORS and by origin validation.
   *
   * Defaults to localhost only. A wildcard is deliberately not the default:
   * combined with bearer auth it would let any page a user visits drive an
   * authenticated server, and without origin validation a local server is open
   * to DNS rebinding.
   */
  allowedOrigins?: string[];
  /** Hostnames permitted in the Host header (defaults to localhost) */
  allowedHosts?: string[];
  /**
   * Refuse 2025-era clients instead of serving them through the legacy
   * fallback. Modern-only deployments should set this.
   */
  rejectLegacy?: boolean;
  /** Callback fired once when the HTTP server starts */
  onSessionStart?: (content: string, sessionId: string | null) => void;
  /** Callback fired once when the HTTP server shuts down */
  onSessionEnd?: (content: string, sessionId: string | null) => void;
}

/**
 * Create and start a Streamable HTTP transport.
 *
 * @param factory - Builds a server (and its context) to serve a request
 * @param config - Transport configuration
 */
export async function createHttpTransport(
  factory: ServerFactory,
  config: HttpTransportConfig = {}
): Promise<void> {
  const {
    port = 3000,
    host = "localhost",
    authToken,
    allowedOrigins,
    allowedHosts,
    rejectLegacy = false,
    onSessionStart,
    onSessionEnd,
  } = config;

  // Keep one context for lifecycle hooks. Per-request contexts come from the
  // factory; this one exists only so start/stop hooks have something to report.
  const lifecycle = factory();

  const origins = allowedOrigins ?? localhostAllowedOrigins();
  const hosts = allowedHosts ?? localhostAllowedHostnames();

  const handler = createMcpHandler(() => factory().server, {
    legacy: rejectLegacy ? "reject" : "stateless",
    onerror: (error) => {
      console.error(`[mcp-toolkit] handler error: ${error.message}`);
    },
  });

  const mcp = toNodeHandler(handler);

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? host}`);

    // Health check stays outside the MCP handler so probes need no auth.
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // CORS, scoped to the configured origins rather than "*"
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Host and Origin validation, using the SDK's own validators so the rules
    // track the spec. A headers-only Request is enough - the validators never
    // read the body, and consuming it here would starve the MCP handler.
    const rejected = validateRequestHeaders(
      new Request(url, { method: req.method, headers: toHeaders(req.headers) }),
      origins,
      hosts
    );
    if (rejected) {
      res.writeHead(rejected.status, { "Content-Type": "application/json" });
      res.end(await rejected.text());
      return;
    }

    // Bearer auth, if configured
    if (authToken && req.headers.authorization !== `Bearer ${authToken}`) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="mcp"',
      });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    await mcp(req, res);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      console.error(`MCP HTTP server listening on http://${host}:${port}`);
      console.error(
        `  Protocol:     2026-07-28${rejectLegacy ? " (modern only)" : " + 2025 legacy"}`
      );
      console.error(`  Health check: http://${host}:${port}/health`);
      resolve();
    });
  });

  // Stateless HTTP has no per-connection session, so these fire once for the
  // process rather than once per client.
  const { content, sessionId } = await getSessionStartHooks(lifecycle.context);
  onSessionStart?.(content, sessionId);

  const shutdown = async () => {
    console.error("Shutting down HTTP server...");
    const end = await getSessionEndHooks(lifecycle.context);
    onSessionEnd?.(end.content, end.sessionId);
    await handler.close();
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Reject a request whose Origin or Host header is not allowed.
 *
 * Exported for wirings that compose their own routing. The SDK's validators are
 * used directly so the rules track the spec rather than a local reimplementation.
 */
export function validateRequestHeaders(
  request: Request,
  origins: string[],
  hosts: string[]
): Response | undefined {
  return hostHeaderValidationResponse(request, hosts) ?? originValidationResponse(request, origins);
}

export { bearerAuthChallengeResponse };
