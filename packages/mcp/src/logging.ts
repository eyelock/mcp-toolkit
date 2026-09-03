/**
 * Unified Logging Module
 *
 * @deprecated Import from "@mcp-toolkit/mcp/spec" instead.
 * This re-exports for backward compatibility.
 */

export {
  addMcpTransport,
  configureLogger,
  getLogger,
  type LogData,
  LogDataSchema,
  Logger,
  type LoggerConfig,
  LogLevel,
  type LogMessage,
  LogMessageSchema,
  type LogTransport,
  logCritical,
  logDebug,
  logError,
  logInfo,
  logNotice,
  logResourceAccess,
  logServerEvent,
  logToolRequest,
  logWarning,
  McpProtocolTransport,
  OTEL_SEVERITY_NUMBER,
  removeMcpTransport,
  StderrTransport,
} from "./spec/logging.js";
