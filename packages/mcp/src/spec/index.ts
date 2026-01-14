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

// Cancellation
export {
  CancellationError,
  checkCancelled,
  isCancelled,
  createLinkedAbortController,
  withCancellation,
} from "./cancellation.js";

// Progress
export {
  type ProgressParams,
  ProgressError,
  ProgressReporter,
  type ToolHandlerExtra,
  createProgressReporter,
  processWithProgress,
} from "./progress.js";

// Pagination
export {
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  decodeCursor,
  type PaginatedResult,
  type PaginateOptions,
  paginateResults,
  createPaginatedResponse,
  InvalidCursorError,
} from "./pagination.js";

// Ping
export {
  type PingResult,
  type ServerStatus,
  initializeServerStartTime,
  getServerUptimeMs,
  handlePing,
  createServerStatus,
  formatPingResponse,
} from "./ping.js";

// Session State
export {
  type SessionState,
  type ToolAllowanceConfig,
  type StateTransitionResult,
  type SessionTimingInfo,
  WorkflowViolationError,
  SessionStateTracker,
  createSessionStateTracker,
  createBlockingResponse,
} from "./session-state.js";

// Workflow State (Hook-based blocking)
export {
  type HookCompletionStatus,
  type BlockingHookDef,
  type WorkflowCheckResult,
  WorkflowStateTracker,
  createWorkflowStateTracker,
  getDefaultWorkflowTracker,
  resetDefaultWorkflowTracker,
  checkWorkflowAllowed,
  registerBlockingHook,
  markWorkflowHookCompleted,
} from "./workflow-state.js";

// Logging
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
} from "./logging.js";
