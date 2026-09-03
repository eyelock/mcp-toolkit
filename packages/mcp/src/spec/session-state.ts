/**
 * Session State Management
 *
 * Enforces workflow requirements - "you must call session_init before using
 * this tool" - under the stateless protocol.
 *
 * ## Why this holds no state
 *
 * The previous version kept `state`, `initAt` and `sessionId` as private fields
 * and asked *"do I remember this caller running session_init?"*. That answer
 * lives in one process's heap, so it silently fails open the moment a second
 * replica serves a request, and it is exactly what MCP `2026-07-28` removed.
 *
 * The question is now *"does the handle on this request resolve to an
 * initialized session?"*, answered by reading shared storage. That is not
 * weaker - it is enforced across restarts and across instances, which the
 * in-memory version never was.
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28
 */

import type { SessionConsumer } from "@mcp-toolkit/core";

/**
 * Session states, derived from storage rather than remembered.
 */
export type SessionState =
  | "uninitialized" // No handle, or the handle resolves to nothing
  | "initialized"; // The handle resolves to a stored session

/**
 * Tool allowance configuration
 */
export interface ToolAllowanceConfig {
  /** Tools that can be called before initialization */
  initTools: Set<string>;
  /** Tools that require initialization first */
  requiresInit: Set<string>;
}

/**
 * Error thrown when a tool is blocked due to workflow violation
 */
export class WorkflowViolationError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly currentState: SessionState,
    public readonly requiredAction: string
  ) {
    super(message);
    this.name = "WorkflowViolationError";
  }
}

/**
 * Session state policy.
 *
 * Holds the rules, never the state. Safe to share across concurrent requests
 * precisely because it has nothing per-request to corrupt.
 *
 * @example
 * ```typescript
 * const tracker = createSessionStateTracker("session_init", ["my_tool"]);
 *
 * const blocked = await tracker.checkToolAllowed("my_tool", sessionId, provider);
 * if (blocked) {
 *   return { isError: true, content: [{ type: "text", text: blocked }] };
 * }
 * ```
 */
export class SessionStateTracker {
  private readonly config: ToolAllowanceConfig;

  constructor(config: ToolAllowanceConfig) {
    this.config = config;
  }

  /** Whether this tool may be called before a session exists */
  isInitTool(toolName: string): boolean {
    return this.config.initTools.has(toolName);
  }

  /** Whether this tool demands an initialized session */
  requiresInit(toolName: string): boolean {
    return this.config.requiresInit.has(toolName);
  }

  /**
   * Derive the state of a session from storage.
   */
  async getState(sessionId: string | null, consumer: SessionConsumer): Promise<SessionState> {
    if (!sessionId) {
      return "uninitialized";
    }
    return (await consumer.hasSession(sessionId)) ? "initialized" : "uninitialized";
  }

  /**
   * Check whether a tool call is allowed.
   *
   * @param toolName - Tool being called
   * @param sessionId - Handle from the request, or null when none was supplied
   * @param consumer - Storage to resolve the handle against
   * @returns null if allowed, or a message explaining what to do instead
   */
  async checkToolAllowed(
    toolName: string,
    sessionId: string | null,
    consumer: SessionConsumer
  ): Promise<string | null> {
    // Init tools are always allowed - they are how a session comes to exist.
    if (this.isInitTool(toolName)) {
      return null;
    }

    if (!this.requiresInit(toolName)) {
      return null;
    }

    const initToolNames = Array.from(this.config.initTools).join(" or ");

    if (!sessionId) {
      return (
        `Tool "${toolName}" requires an initialized session, but no session_id was supplied. ` +
        `Call ${initToolNames} first, then pass the returned session_id to this tool.`
      );
    }

    if (!(await consumer.hasSession(sessionId))) {
      return (
        `Tool "${toolName}" requires an initialized session, but session_id "${sessionId}" ` +
        `is unknown or has expired. Call ${initToolNames} to start a new session.`
      );
    }

    return null;
  }
}

/**
 * Create a session state tracker with default configuration
 *
 * @param initTool - The tool name that initializes the session (default: "session_init")
 * @param requiresInitTools - Tools that require initialization
 */
export function createSessionStateTracker(
  initTool = "session_init",
  requiresInitTools: string[] = []
): SessionStateTracker {
  return new SessionStateTracker({
    initTools: new Set([initTool, "server_info"]),
    requiresInit: new Set(requiresInitTools),
  });
}

/**
 * Create a blocking response for workflow violations
 *
 * Helper for creating properly formatted error responses.
 */
export function createBlockingResponse(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
