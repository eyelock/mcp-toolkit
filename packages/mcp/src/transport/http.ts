/**
 * HTTP/SSE Transport
 *
 * HTTP transport with Server-Sent Events for remote deployment.
 * Supports bearer token authentication.
 */

import {
  type IncomingMessage,
  type ServerResponse,
  createServer as createHttpServer,
} from "node:http";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export interface HttpTransportConfig {
  port?: number;
  host?: string;
  authToken?: string;
}

/**
 * Create and start an HTTP/SSE transport server
 */
export async function createHttpTransport(
  server: Server,
  config: HttpTransportConfig = {}
): Promise<void> {
  const { port = 3000, host = "localhost", authToken } = config;

  // Track active transports for cleanup
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers for browser clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check if token configured
    if (authToken) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${authToken}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    const url = new URL(req.url ?? "/", `http://${host}:${port}`);

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // SSE endpoint for MCP communication
    if (url.pathname === "/sse" && req.method === "GET") {
      const sessionId = crypto.randomUUID();
      const transport = new SSEServerTransport(`/message/${sessionId}`, res);
      transports.set(sessionId, transport);

      res.on("close", () => {
        transports.delete(sessionId);
      });

      await server.connect(transport);
      return;
    }

    // Message endpoint for client-to-server communication
    if (url.pathname.startsWith("/message/") && req.method === "POST") {
      const sessionId = url.pathname.split("/")[2];
      const transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          await transport.handlePostMessage(req, res, body);
        } catch (_error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  // Start server
  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      console.error(`MCP HTTP server listening on http://${host}:${port}`);
      console.error(`  SSE endpoint: http://${host}:${port}/sse`);
      console.error(`  Health check: http://${host}:${port}/health`);
      resolve();
    });
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error("Shutting down HTTP server...");
    for (const transport of transports.values()) {
      await transport.close?.();
    }
    await server.close();
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
