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
  removeMcpTransport,
  StderrTransport,
} from "./spec/logging.js";
