/**
 * MCP Specification Implementations
 *
 * This module provides implementations for various parts of the MCP specification:
 *
 * - **Cancellation** - Abort signal handling for long-running operations
 *   @see https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/cancellation
 *
 * - **Progress** - Progress notifications during long-running operations
 *   @see https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress
 *
 * - **Pagination** - Cursor-based pagination for large result sets
 *   @see https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination
 *
 * - **Ping** - Liveness check for server health
 *   @see https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/ping
 *
 * - **Logging** - RFC 5424 compliant logging with MCP protocol transport
 *   @see https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging
 *
 * - **Session State** - Session state management and workflow enforcement
 *
 * @module @mcp-toolkit/mcp/spec
 */

// Workflow State (Hook-based blocking)
// Re-exported from @mcp-toolkit/core for backwards compatibility
export {
  type BlockingHookDef,
  checkWorkflowAllowed,
  createWorkflowStateTracker,
  getDefaultWorkflowTracker,
  type HookCompletionStatus,
  markWorkflowHookCompleted,
  registerBlockingHook,
  resetDefaultWorkflowTracker,
  type WorkflowCheckResult,
  WorkflowStateTracker,
} from "@mcp-toolkit/core";
// Cancellation
export {
  CancellationError,
  checkCancelled,
  createLinkedAbortController,
  isCancelled,
  withCancellation,
} from "./cancellation.js";
// Logging
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
} from "./logging.js";
// Pagination
export {
  createPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  type PaginatedResult,
  type PaginateOptions,
  paginateResults,
} from "./pagination.js";
// Ping
export {
  createServerStatus,
  formatPingResponse,
  getServerUptimeMs,
  handlePing,
  initializeServerStartTime,
  type PingResult,
  type ServerStatus,
} from "./ping.js";
// Progress
export {
  createProgressReporter,
  ProgressError,
  type ProgressParams,
  ProgressReporter,
  processWithProgress,
  type ToolHandlerExtra,
} from "./progress.js";
// Session State
export {
  createBlockingResponse,
  createSessionStateTracker,
  type SessionState,
  SessionStateTracker,
  type ToolAllowanceConfig,
  WorkflowViolationError,
} from "./session-state.js";
