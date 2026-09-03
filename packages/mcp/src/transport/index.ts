/**
 * Transport Abstraction
 *
 * Provides a unified interface for different MCP transport modes:
 * - stdio: Local development, MCP inspector
 * - Streamable HTTP: Remote deployment, web clients (protocol 2026-07-28)
 */

export {
  createHttpTransport,
  type HttpTransportConfig,
  type ServerFactory,
  validateRequestHeaders,
} from "./http.js";
export { createStdioTransport, type StdioTransportOptions } from "./stdio.js";

export type TransportMode = "stdio" | "http";

export interface TransportOptions {
  mode: TransportMode;
  /** Refuse 2025-era clients (applies to both transports) */
  rejectLegacy?: boolean;
  httpConfig?: {
    port?: number;
    host?: string;
    authToken?: string;
    allowedOrigins?: string[];
  };
}

/**
 * Parse transport mode from CLI arguments
 */
export function parseTransportArgs(args: string[]): TransportOptions {
  const hasHttp = args.includes("--http");
  const rejectLegacy = args.includes("--modern-only");

  if (hasHttp) {
    const portIndex = args.indexOf("--port");
    const port = portIndex !== -1 ? Number.parseInt(args[portIndex + 1] ?? "3000", 10) : 3000;

    const hostIndex = args.indexOf("--host");
    const host = hostIndex !== -1 ? args[hostIndex + 1] : "localhost";

    const tokenIndex = args.indexOf("--token");
    const authToken = tokenIndex !== -1 ? args[tokenIndex + 1] : undefined;

    const originIndex = args.indexOf("--allow-origin");
    const originArg = originIndex !== -1 ? args[originIndex + 1] : undefined;
    const allowedOrigins = originArg?.split(",").map((o) => o.trim());

    return {
      mode: "http",
      rejectLegacy,
      httpConfig: { port, host, authToken, allowedOrigins },
    };
  }

  // Default to stdio
  return { mode: "stdio", rejectLegacy };
}
