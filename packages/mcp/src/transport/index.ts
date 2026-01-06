/**
 * Transport Abstraction
 *
 * Provides a unified interface for different MCP transport modes:
 * - stdio: Local development, MCP inspector
 * - HTTP/SSE: Remote deployment, web clients
 */

export { createStdioTransport } from "./stdio.js";
export { createHttpTransport, type HttpTransportConfig } from "./http.js";

export type TransportMode = "stdio" | "http";

export interface TransportOptions {
  mode: TransportMode;
  httpConfig?: {
    port?: number;
    host?: string;
    authToken?: string;
  };
}

/**
 * Parse transport mode from CLI arguments
 */
export function parseTransportArgs(args: string[]): TransportOptions {
  const hasHttp = args.includes("--http");

  if (hasHttp) {
    const portIndex = args.indexOf("--port");
    const port = portIndex !== -1 ? Number.parseInt(args[portIndex + 1] ?? "3000", 10) : 3000;

    const hostIndex = args.indexOf("--host");
    const host = hostIndex !== -1 ? args[hostIndex + 1] : "localhost";

    const tokenIndex = args.indexOf("--token");
    const authToken = tokenIndex !== -1 ? args[tokenIndex + 1] : undefined;

    return {
      mode: "http",
      httpConfig: { port, host, authToken },
    };
  }

  // Default to stdio
  return { mode: "stdio" };
}
