/**
 * Workflow State Management
 *
 * Tracks completed blocking hooks and enforces workflow dependencies.
 * This extends the basic session state with hook-aware workflow enforcement.
 *
 * Key concepts:
 * - Blocking hooks must complete before dependent hooks/tools can run
 * - Tool namespaces are matched to hooks via prefix (e.g., "toolkit:*" tools blocked by "toolkit:config")
 * - Completed hooks are tracked per-session
 */

/**
 * Hook completion status
 */
export interface HookCompletionStatus {
  /** Hook ID that completed */
  hookId: string;
  /** When the hook completed */
  completedAt: string;
  /** Optional completion data */
  data?: Record<string, unknown>;
}

/**
 * Blocking hook definition for enforcement
 */
export interface BlockingHookDef {
  /** Hook ID (e.g., "toolkit:config:start:config") */
  hookId: string;
  /** Tool prefix this hook blocks (e.g., "toolkit:" blocks all toolkit:* tools) */
  toolPrefix: string;
  /** Human-readable name for error messages */
  name: string;
  /** Message to show when blocked */
  blockMessage: string;
}

/**
 * Result of a workflow check
 */
export interface WorkflowCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Blocking hook ID if not allowed */
  blockedBy?: string;
  /** Error message if blocked */
  message?: string;
  /** Hint for resolving the block */
  hint?: string;
}

/**
 * Workflow state tracker for hook-based blocking
 */
export class WorkflowStateTracker {
  private completedHooks: Map<string, HookCompletionStatus> = new Map();
  private blockingHooks: Map<string, BlockingHookDef> = new Map();

  /**
   * Register a blocking hook that must complete before certain tools can run
   *
   * @param def - Blocking hook definition
   */
  registerBlockingHook(def: BlockingHookDef): void {
    this.blockingHooks.set(def.hookId, def);
  }

  /**
   * Register multiple blocking hooks
   */
  registerBlockingHooks(defs: BlockingHookDef[]): void {
    for (const def of defs) {
      this.registerBlockingHook(def);
    }
  }

  /**
   * Mark a blocking hook as completed
   *
   * @param hookId - The hook ID that completed
   * @param data - Optional completion data
   */
  markHookCompleted(hookId: string, data?: Record<string, unknown>): void {
    this.completedHooks.set(hookId, {
      hookId,
      completedAt: new Date().toISOString(),
      data,
    });
  }

  /**
   * Check if a hook has been completed
   */
  isHookCompleted(hookId: string): boolean {
    return this.completedHooks.has(hookId);
  }

  /**
   * Get completion status for a hook
   */
  getHookCompletion(hookId: string): HookCompletionStatus | undefined {
    return this.completedHooks.get(hookId);
  }

  /**
   * Check if a tool is allowed to run based on blocking hooks
   *
   * @param toolName - The tool being called
   * @returns Check result with allowed status and blocking info
   */
  checkToolAllowed(toolName: string): WorkflowCheckResult {
    for (const [hookId, def] of this.blockingHooks) {
      // Check if tool matches the blocking prefix
      if (toolName.startsWith(def.toolPrefix)) {
        // Check if this blocking hook has completed
        if (!this.completedHooks.has(hookId)) {
          return {
            allowed: false,
            blockedBy: hookId,
            message: def.blockMessage,
            hint: `Complete the "${def.name}" workflow first.`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Create a blocking error response for MCP
   */
  createBlockingResponse(result: WorkflowCheckResult): {
    isError: true;
    content: Array<{ type: "text"; text: string }>;
  } {
    const response = {
      success: false,
      error: result.message ?? "Workflow requirement not met",
      workflowViolation: true,
      blockedBy: result.blockedBy,
      hint: result.hint,
    };

    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    };
  }

  /**
   * Get all completed hooks
   */
  getCompletedHooks(): HookCompletionStatus[] {
    return Array.from(this.completedHooks.values());
  }

  /**
   * Get all registered blocking hooks
   */
  getBlockingHooks(): BlockingHookDef[] {
    return Array.from(this.blockingHooks.values());
  }

  /**
   * Reset workflow state (for testing or new sessions)
   */
  reset(): void {
    this.completedHooks.clear();
  }

  /**
   * Clear blocking hooks (for testing)
   */
  clearBlockingHooks(): void {
    this.blockingHooks.clear();
  }
}

/**
 * Create a workflow state tracker
 */
export function createWorkflowStateTracker(): WorkflowStateTracker {
  return new WorkflowStateTracker();
}

/**
 * Default singleton instance for simple use cases
 */
let defaultTracker: WorkflowStateTracker | null = null;

/**
 * Get the default workflow state tracker (singleton)
 */
export function getDefaultWorkflowTracker(): WorkflowStateTracker {
  if (!defaultTracker) {
    defaultTracker = new WorkflowStateTracker();
  }
  return defaultTracker;
}

/**
 * Reset the default workflow tracker (for testing)
 */
export function resetDefaultWorkflowTracker(): void {
  if (defaultTracker) {
    defaultTracker.reset();
    defaultTracker.clearBlockingHooks();
  }
  defaultTracker = null;
}

/**
 * Convenience function to check if a tool is allowed
 */
export function checkWorkflowAllowed(toolName: string): WorkflowCheckResult {
  return getDefaultWorkflowTracker().checkToolAllowed(toolName);
}

/**
 * Convenience function to register a blocking hook
 */
export function registerBlockingHook(def: BlockingHookDef): void {
  getDefaultWorkflowTracker().registerBlockingHook(def);
}

/**
 * Convenience function to mark a hook as completed
 */
export function markWorkflowHookCompleted(hookId: string, data?: Record<string, unknown>): void {
  getDefaultWorkflowTracker().markHookCompleted(hookId, data);
}
