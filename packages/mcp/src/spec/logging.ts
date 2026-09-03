/**
 * Unified Logging Module
 *
 * MCP Specification compliant logging with RFC 5424 log levels.
 * Supports multiple transports: stderr (always) and MCP protocol (when connected).
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging
 * @see https://datatracker.ietf.org/doc/html/rfc5424
 */

import type { Server } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * RFC 5424 log levels per MCP specification
 */
export const LogLevel = z.enum([
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
]);
export type LogLevel = z.infer<typeof LogLevel>;

/**
 * Priority ordering for log levels (lower = less severe)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  notice: 2,
  warning: 3,
  error: 4,
  critical: 5,
  alert: 6,
  emergency: 7,
};

/**
 * Structured log data payload
 */
export interface LogData {
  message: string;
  timestamp?: string;
  tool?: string;
  resource?: string;
  durationMs?: number;
  sessionId?: string;
  error?: {
    message: string;
    name?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * MCP-compliant log message structure
 */
export interface LogMessage {
  level: LogLevel;
  logger?: string;
  data: LogData;
}

/**
 * Transport interface for log message delivery
 */
export interface LogTransport {
  readonly name: string;
  readonly minLevel: LogLevel;
  write(message: LogMessage): void | Promise<void>;
  setMinLevel(level: LogLevel): void;
}

/**
 * RFC 5424 levels mapped to OpenTelemetry SeverityNumber.
 *
 * The spec replaces protocol logging with "OpenTelemetry for structured
 * observability", so emitting the numeric severity means a collector can read
 * these directly.
 *
 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
 */
export const OTEL_SEVERITY_NUMBER: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  notice: 10,
  warning: 13,
  error: 17,
  critical: 19,
  alert: 21,
  emergency: 23,
};

/**
 * Check if a level meets the minimum threshold
 */
function meetsMinLevel(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

// ============================================================================
// Transports
// ============================================================================

/**
 * Stderr transport - writes structured JSON to stderr.
 *
 * The transport MCP `2026-07-28` points to: it works identically on stdio and
 * HTTP, survives having no client attached, and is what container and
 * serverless platforms already collect.
 *
 * Output carries OpenTelemetry-compatible fields (`SeverityNumber`,
 * `SeverityText`, `Timestamp`) alongside the human-readable ones, so a
 * collector can ingest it without a translation step.
 *
 * Always synchronous, and writes to stderr only - stdout carries the protocol.
 */
export class StderrTransport implements LogTransport {
  readonly name = "stderr";
  private _minLevel: LogLevel;
  private _enabled: boolean;

  constructor(config: { minLevel?: LogLevel; enabled?: boolean } = {}) {
    this._minLevel = config.minLevel ?? "info";
    this._enabled = config.enabled ?? true;
  }

  get minLevel(): LogLevel {
    return this._minLevel;
  }

  setMinLevel(level: LogLevel): void {
    this._minLevel = level;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  write(message: LogMessage): void {
    if (!this._enabled) return;

    const output = {
      timestamp: message.data.timestamp ?? new Date().toISOString(),
      level: message.level,
      logger: message.logger,
      // OpenTelemetry log-data model, so a collector needs no translation.
      SeverityNumber: OTEL_SEVERITY_NUMBER[message.level],
      SeverityText: message.level.toUpperCase(),
      ...message.data,
    };

    try {
      console.error(JSON.stringify(output));
    } catch {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "Failed to serialize log entry",
        })
      );
    }
  }
}

/**
 * MCP protocol transport - sends `notifications/message` to the client.
 *
 * @deprecated MCP `2026-07-28` deprecates protocol logging (SEP-2577) in favour
 * of stderr for stdio and OpenTelemetry for structured observability. It keeps
 * working for at least twelve months, but new code should use
 * {@link StderrTransport}.
 *
 * ## Where this actually delivers
 *
 * Measured, because the failure is silent rather than loud:
 *
 * | Transport | Era    | `sendLoggingMessage` | Client receives it |
 * |-----------|--------|----------------------|--------------------|
 * | stdio     | modern | resolves             | yes                |
 * | stdio     | legacy | resolves             | yes                |
 * | HTTP      | modern | resolves             | **no - dropped**   |
 * | HTTP      | legacy | resolves             | **no - dropped**   |
 *
 * Over HTTP the call succeeds and the message goes nowhere: stateless
 * per-request serving has no open stream to deliver a notification on. Nothing
 * throws, so an operator would reasonably believe logging is working.
 *
 * This transport therefore warns once, to stderr, the first time a message is
 * dropped - a silent hole in your logs is worse than a noisy one.
 */
export class McpProtocolTransport implements LogTransport {
  readonly name = "mcp";
  private _minLevel: LogLevel;
  private server: Server;
  private warnedUndeliverable = false;

  constructor(server: Server, minLevel: LogLevel = "info") {
    this.server = server;
    this._minLevel = minLevel;
  }

  get minLevel(): LogLevel {
    return this._minLevel;
  }

  setMinLevel(level: LogLevel): void {
    this._minLevel = level;
  }

  async write(message: LogMessage): Promise<void> {
    try {
      await this.server.sendLoggingMessage({
        level: message.level,
        logger: message.logger,
        data: message.data,
      });
    } catch (error) {
      this.warnUndeliverable(String(error));
    }
  }

  /**
   * Say once, on stderr, that protocol logging is not reaching anyone.
   */
  private warnUndeliverable(reason: string): void {
    if (this.warnedUndeliverable) {
      return;
    }
    this.warnedUndeliverable = true;
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warning",
        logger: "mcp-toolkit",
        message:
          "Protocol log messages are not being delivered; add a StderrTransport so logs are not lost. " +
          "Note that over HTTP they are dropped without error, so this warning may not appear at all.",
        metadata: { transport: "mcp", reason },
      })
    );
  }
}

// ============================================================================
// Logger Class
// ============================================================================

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Default logger name */
  defaultLogger?: string;
  /** Initial transports */
  transports?: LogTransport[];
}

/**
 * Unified logger with multiple transports
 */
export class Logger {
  private transports: LogTransport[] = [];
  private defaultLogger: string;

  constructor(config: LoggerConfig = {}) {
    this.defaultLogger = config.defaultLogger ?? "mcp-toolkit";
    if (config.transports) {
      this.transports = config.transports;
    }
  }

  /** Add a transport to the logger */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /** Remove a transport by name */
  removeTransport(name: string): void {
    this.transports = this.transports.filter((t) => t.name !== name);
  }

  /** Get a transport by name */
  getTransport(name: string): LogTransport | undefined {
    return this.transports.find((t) => t.name === name);
  }

  /** Core log method - dispatches to all transports */
  log(level: LogLevel, data: LogData, logger?: string): void {
    const message: LogMessage = {
      level,
      logger: logger ?? this.defaultLogger,
      data: {
        ...data,
        timestamp: data.timestamp ?? new Date().toISOString(),
      },
    };

    for (const transport of this.transports) {
      if (meetsMinLevel(level, transport.minLevel)) {
        void transport.write(message);
      }
    }
  }

  // RFC 5424 level convenience methods
  debug(message: string, data?: Partial<Omit<LogData, "message">>): void {
    this.log("debug", { message, ...data });
  }

  info(message: string, data?: Partial<Omit<LogData, "message">>): void {
    this.log("info", { message, ...data });
  }

  notice(message: string, data?: Partial<Omit<LogData, "message">>): void {
    this.log("notice", { message, ...data });
  }

  warning(message: string, data?: Partial<Omit<LogData, "message">>): void {
    this.log("warning", { message, ...data });
  }

  error(message: string, error?: Error, data?: Partial<Omit<LogData, "message" | "error">>): void {
    this.log("error", {
      message,
      ...data,
      error: error ? { message: error.message, name: error.name, stack: error.stack } : undefined,
    });
  }

  critical(
    message: string,
    error?: Error,
    data?: Partial<Omit<LogData, "message" | "error">>
  ): void {
    this.log("critical", {
      message,
      ...data,
      error: error ? { message: error.message, name: error.name, stack: error.stack } : undefined,
    });
  }

  alert(message: string, error?: Error, data?: Partial<Omit<LogData, "message" | "error">>): void {
    this.log("alert", {
      message,
      ...data,
      error: error ? { message: error.message, name: error.name, stack: error.stack } : undefined,
    });
  }

  emergency(
    message: string,
    error?: Error,
    data?: Partial<Omit<LogData, "message" | "error">>
  ): void {
    this.log("emergency", {
      message,
      ...data,
      error: error ? { message: error.message, name: error.name, stack: error.stack } : undefined,
    });
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

/**
 * Global logger instance with stderr transport by default
 */
const globalLogger = new Logger();

// Initialize with stderr transport based on environment
const stderrTransport = new StderrTransport({
  minLevel: process.env.MCP_DEBUG === "true" ? "debug" : "info",
  enabled: true,
});
globalLogger.addTransport(stderrTransport);

/** Get the global logger instance */
export function getLogger(): Logger {
  return globalLogger;
}

/** Configure the global stderr transport */
export function configureLogger(config: { minLevel?: LogLevel; enabled?: boolean }): void {
  const transport = globalLogger.getTransport("stderr") as StderrTransport | undefined;
  if (transport) {
    if (config.minLevel !== undefined) {
      transport.setMinLevel(config.minLevel);
    }
    if (config.enabled !== undefined) {
      transport.setEnabled(config.enabled);
    }
  }
}

/** Add MCP protocol transport to the global logger */
export function addMcpTransport(server: Server, minLevel: LogLevel = "info"): void {
  globalLogger.addTransport(new McpProtocolTransport(server, minLevel));
}

/** Remove MCP protocol transport from the global logger */
export function removeMcpTransport(): void {
  globalLogger.removeTransport("mcp");
}

// ============================================================================
// Convenience Functions
// ============================================================================

/** Log a debug message */
export function logDebug(message: string, data?: Partial<Omit<LogData, "message">>): void {
  globalLogger.debug(message, data);
}

/** Log an info message */
export function logInfo(message: string, data?: Partial<Omit<LogData, "message">>): void {
  globalLogger.info(message, data);
}

/** Log a notice message */
export function logNotice(message: string, data?: Partial<Omit<LogData, "message">>): void {
  globalLogger.notice(message, data);
}

/** Log a warning message */
export function logWarning(message: string, data?: Partial<Omit<LogData, "message">>): void {
  globalLogger.warning(message, data);
}

/** Log an error message */
export function logError(
  message: string,
  error?: Error,
  data?: Partial<Omit<LogData, "message" | "error">>
): void {
  globalLogger.error(message, error, data);
}

/** Log a critical message */
export function logCritical(
  message: string,
  error?: Error,
  data?: Partial<Omit<LogData, "message" | "error">>
): void {
  globalLogger.critical(message, error, data);
}

/** Log a tool request with timing */
export function logToolRequest(
  tool: string,
  success: boolean,
  durationMs: number,
  details?: {
    sessionId?: string;
    error?: Error;
    metadata?: Record<string, unknown>;
  }
): void {
  const message = success ? `Tool ${tool} completed successfully` : `Tool ${tool} failed`;

  globalLogger.log(
    success ? "info" : "error",
    {
      message,
      tool,
      durationMs,
      sessionId: details?.sessionId,
      error: details?.error
        ? {
            message: details.error.message,
            name: details.error.name,
            stack: details.error.stack,
          }
        : undefined,
      metadata: details?.metadata,
    },
    "tools"
  );
}

/** Log a resource access */
export function logResourceAccess(
  resource: string,
  success: boolean,
  durationMs: number,
  details?: {
    sessionId?: string;
    error?: Error;
    metadata?: Record<string, unknown>;
  }
): void {
  const message = success
    ? `Resource ${resource} accessed successfully`
    : `Resource ${resource} access failed`;

  globalLogger.log(
    success ? "info" : "error",
    {
      message,
      resource,
      durationMs,
      sessionId: details?.sessionId,
      error: details?.error
        ? {
            message: details.error.message,
            name: details.error.name,
            stack: details.error.stack,
          }
        : undefined,
      metadata: details?.metadata,
    },
    "resources"
  );
}

/** Log server lifecycle event */
export function logServerEvent(
  event: "startup" | "shutdown" | "error",
  message: string,
  details?: {
    error?: Error;
    metadata?: Record<string, unknown>;
  }
): void {
  const level: LogLevel = event === "error" ? "error" : "info";

  globalLogger.log(
    level,
    {
      message,
      error: details?.error
        ? {
            message: details.error.message,
            name: details.error.name,
            stack: details.error.stack,
          }
        : undefined,
      metadata: { ...details?.metadata, event },
    },
    "server"
  );
}

// ============================================================================
// Schema Exports
// ============================================================================

/** Schema for log data payload */
export const LogDataSchema = z.object({
  message: z.string().describe("Human-readable log message"),
  timestamp: z.string().optional().describe("ISO 8601 timestamp"),
  tool: z.string().optional().describe("MCP tool name if applicable"),
  resource: z.string().optional().describe("MCP resource URI if applicable"),
  durationMs: z.number().optional().describe("Request duration in milliseconds"),
  sessionId: z.string().optional().describe("Session identifier"),
  error: z
    .object({
      message: z.string().describe("Error message"),
      name: z.string().optional().describe("Error name/type"),
      stack: z.string().optional().describe("Error stack trace"),
    })
    .optional()
    .describe("Error details if applicable"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional context-specific data"),
});

/** Schema for complete log message (MCP format) */
export const LogMessageSchema = z.object({
  level: LogLevel.describe("RFC 5424 log level"),
  logger: z.string().optional().describe("Logger name for categorization"),
  data: LogDataSchema.describe("Structured log data"),
});
