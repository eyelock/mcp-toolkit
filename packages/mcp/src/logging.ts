/**
 * Unified Logging Module
 *
 * @deprecated Import from "@mcp-toolkit/mcp/spec" instead.
 * This re-exports for backward compatibility.
 */

export {
  LogLevel,
  type LogData,
  type LogMessage,
  type LogTransport,
  StderrTransport,
  McpProtocolTransport,
  type LoggerConfig,
  Logger,
  getLogger,
  configureLogger,
  addMcpTransport,
  removeMcpTransport,
  logDebug,
  logInfo,
  logNotice,
  logWarning,
  logError,
  logCritical,
  logToolRequest,
  logResourceAccess,
  logServerEvent,
  LogDataSchema,
  LogMessageSchema,
} from "./spec/logging.js";
