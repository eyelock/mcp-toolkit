/**
 * Ping Utilities
 *
 * Implements the MCP ping specification for health checks.
 * The ping request is a simple liveness check that clients or servers
 * can use to verify the other party is responsive.
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/ping
 */

/**
 * Ping request result
 */
export interface PingResult {
  /** Whether the server is healthy */
  healthy: boolean;
  /** Response timestamp */
  timestamp: string;
  /** Optional latency in milliseconds (if measurable) */
  latencyMs?: number;
}

/**
 * Server status information
 *
 * Extended status beyond simple ping for health endpoints.
 */
export interface ServerStatus {
  /** Server name/identifier */
  name: string;
  /** Server version */
  version: string;
  /** Whether the server is healthy */
  healthy: boolean;
  /** Uptime in milliseconds */
  uptimeMs: number;
  /** Current timestamp */
  timestamp: string;
  /** Optional status message */
  message?: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Track server start time for uptime calculation
 */
let serverStartTime: number | null = null;

/**
 * Initialize server start time
 *
 * Call this when your MCP server starts.
 */
export function initializeServerStartTime(): void {
  serverStartTime = Date.now();
}

/**
 * Get server uptime in milliseconds
 */
export function getServerUptimeMs(): number {
  if (!serverStartTime) {
    return 0;
  }
  return Date.now() - serverStartTime;
}

/**
 * Handle a ping request
 *
 * Returns a simple ping response indicating server health.
 *
 * @param startTime - Optional request start time for latency calculation
 * @returns Ping result
 *
 * @example
 * ```typescript
 * // In tool handler
 * server.tool("ping", {}, async () => {
 *   const result = handlePing();
 *   return {
 *     content: [{ type: "text", text: JSON.stringify(result) }]
 *   };
 * });
 * ```
 */
export function handlePing(startTime?: number): PingResult {
  const now = Date.now();
  return {
    healthy: true,
    timestamp: new Date(now).toISOString(),
    latencyMs: startTime ? now - startTime : undefined,
  };
}

/**
 * Create a server status response
 *
 * Returns extended status information beyond simple ping.
 *
 * @param name - Server name
 * @param version - Server version
 * @param options - Additional options
 * @returns Server status
 *
 * @example
 * ```typescript
 * const status = createServerStatus("my-mcp-server", "1.0.0", {
 *   message: "All systems operational",
 *   metadata: { features: ["tools", "resources"] }
 * });
 * ```
 */
export function createServerStatus(
  name: string,
  version: string,
  options?: {
    message?: string;
    metadata?: Record<string, unknown>;
    healthy?: boolean;
  }
): ServerStatus {
  return {
    name,
    version,
    healthy: options?.healthy ?? true,
    uptimeMs: getServerUptimeMs(),
    timestamp: new Date().toISOString(),
    message: options?.message,
    metadata: options?.metadata,
  };
}

/**
 * Format a ping/status response for MCP tool output
 *
 * @param result - Ping result or server status
 * @returns Formatted MCP tool response
 */
export function formatPingResponse(result: PingResult | ServerStatus): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
