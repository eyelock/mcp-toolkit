/**
 * Session State Management
 *
 * Generic session state tracking for MCP servers. Provides a pattern for
 * enforcing workflow requirements (e.g., mandatory initialization) through
 * server-side state management.
 *
 * This complements prompt-based guidance with actual enforcement.
 */

/**
 * Base session states
 *
 * Servers can extend this with custom states if needed.
 */
export type SessionState =
  | "uninitialized" // No init tool called yet
  | "initialized" // Init tool called, ready for work
  | "ready" // Optional intermediate state
  | "working"; // Normal operation

/**
 * Tool allowance configuration
 */
export interface ToolAllowanceConfig {
  /** Tools that can be called before initialization */
  initTools: Set<string>;
  /** Tools that require initialization first */
  requiresInit: Set<string>;
  /** Tools that trigger state transitions */
  transitionTriggers: Map<string, SessionState>;
}

/**
 * Result of a state transition
 */
export interface StateTransitionResult {
  /** State before the transition */
  previousState: SessionState;
  /** State after the transition */
  newState: SessionState;
  /** Whether a transition occurred */
  transitioned: boolean;
  /** Optional guidance message for the LLM */
  guidance?: string;
}

/**
 * Session timing information
 */
export interface SessionTimingInfo {
  /** Current session state */
  state: SessionState;
  /** When initialization occurred */
  initAt: number | null;
  /** Session ID (from MCP or generated) */
  sessionId: string | null;
  /** Current request ID */
  requestId: string | null;
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
 * Session state tracker class
 *
 * Provides state management for enforcing workflow requirements.
 * Create one instance per session (or use the singleton pattern).
 *
 * @example
 * ```typescript
 * const tracker = new SessionStateTracker({
 *   initTools: new Set(["session_init", "server_info"]),
 *   requiresInit: new Set(["my_tool", "other_tool"]),
 *   transitionTriggers: new Map([["session_init", "initialized"]]),
 * });
 *
 * // Before tool execution
 * const error = tracker.checkToolAllowed("my_tool", requestId);
 * if (error) {
 *   return { isError: true, content: [{ type: "text", text: error }] };
 * }
 *
 * // After tool execution
 * const result = tracker.recordToolCall("session_init");
 * if (result.guidance) {
 *   // Include in response
 * }
 * ```
 */
export class SessionStateTracker {
  private state: SessionState = "uninitialized";
  private initAt: number | null = null;
  private sessionId: string | null = null;
  private currentRequestId: string | null = null;
  private config: ToolAllowanceConfig;

  constructor(config: ToolAllowanceConfig) {
    this.config = config;
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Set the session ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if a tool call is allowed given current state
   *
   * @param toolName - Name of the tool being called
   * @param requestId - Optional request identifier
   * @returns null if allowed, or an error message if blocked
   */
  checkToolAllowed(toolName: string, requestId?: string): string | null {
    // Track request
    if (requestId) {
      this.currentRequestId = requestId;
    }

    // Init tools are always allowed
    if (this.config.initTools.has(toolName)) {
      return null;
    }

    // Check if tool requires initialization
    if (this.config.requiresInit.has(toolName) && this.state === "uninitialized") {
      const initToolNames = Array.from(this.config.initTools).join(" or ");
      return `Tool "${toolName}" requires session initialization. You MUST call ${initToolNames} first before using this tool.`;
    }

    return null;
  }

  /**
   * Record that a tool was called, updating state as needed
   *
   * @param toolName - Name of the tool being called
   * @param requestId - Optional request identifier
   * @returns State transition result with guidance
   */
  recordToolCall(toolName: string, requestId?: string): StateTransitionResult {
    // Track request
    if (requestId) {
      this.currentRequestId = requestId;
    }

    const previousState = this.state;

    // Check for state transitions
    const newState = this.config.transitionTriggers.get(toolName);
    if (newState && this.state !== newState) {
      this.state = newState;

      if (newState === "initialized" && previousState === "uninitialized") {
        this.initAt = Date.now();
        return {
          previousState,
          newState: this.state,
          transitioned: true,
          guidance: "Session initialized. Ready to work.",
        };
      }

      return {
        previousState,
        newState: this.state,
        transitioned: true,
      };
    }

    // Transition to working state on first real work
    if (
      (this.state === "ready" || this.state === "initialized") &&
      !this.config.initTools.has(toolName)
    ) {
      this.state = "working";
      return {
        previousState,
        newState: this.state,
        transitioned: previousState !== this.state,
      };
    }

    return {
      previousState,
      newState: this.state,
      transitioned: false,
    };
  }

  /**
   * Reset session state (for testing or new sessions)
   */
  reset(): void {
    this.state = "uninitialized";
    this.initAt = null;
    this.sessionId = null;
    this.currentRequestId = null;
  }

  /**
   * Get session timing info
   */
  getTimingInfo(): SessionTimingInfo {
    return {
      state: this.state,
      initAt: this.initAt,
      sessionId: this.sessionId,
      requestId: this.currentRequestId,
    };
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return this.state !== "uninitialized";
  }
}

/**
 * Create a session state tracker with default configuration
 *
 * @param initTool - The tool name that initializes the session (default: "session_init")
 * @param requiresInitTools - Tools that require initialization
 * @returns Configured SessionStateTracker
 */
export function createSessionStateTracker(
  initTool = "session_init",
  requiresInitTools: string[] = []
): SessionStateTracker {
  return new SessionStateTracker({
    initTools: new Set([initTool, "server_info"]),
    requiresInit: new Set(requiresInitTools),
    transitionTriggers: new Map([[initTool, "initialized"]]),
  });
}

/**
 * Create a blocking response for workflow violations
 *
 * Helper for creating properly formatted error responses.
 *
 * @param message - Error message
 * @returns MCP-formatted error response
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
