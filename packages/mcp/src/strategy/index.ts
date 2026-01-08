/**
 * Composite Tool Execution Strategy
 *
 * Implements the tri-state execution hierarchy:
 * 1. "I can do it" - Local implementation (DEFAULT - self-reliant)
 * 2. "Someone else is better" - Delegate to host LLM via sampling (opt-in)
 * 3. "Emergency" - Neither works, escalate/error
 *
 * Philosophy: Tools are self-reliant by default. Delegation is an explicit
 * choice when the tool knows the host LLM can do it better.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  ExecutionStrategy,
  ExecutionOutcome,
  StrategyExecutionResult,
  ToolStrategyConfig,
  ToolStrategyEntry,
} from "@mcp-toolkit/model";
import { logDebug, logWarning } from "../logging.js";

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for delegation attempts (30 seconds) */
export const DEFAULT_DELEGATION_TIMEOUT_MS = 30_000;

/** Default strategy entry when no config is provided */
const DEFAULT_STRATEGY_ENTRY: ToolStrategyEntry = {
  strategy: "local-only",
  fallbackEnabled: true,
};

// =============================================================================
// Strategy Resolution
// =============================================================================

/**
 * Resolve the execution strategy for a tool from configuration
 *
 * Looks up the tool in the config, falling back to defaults if not found.
 * This is the primary way tools should get their strategy configuration.
 *
 * @param toolName - Name of the tool to resolve strategy for
 * @param config - Tool strategy configuration (from ServerContext.defaultToolStrategies)
 * @returns Resolved strategy entry with all defaults applied
 *
 * @example
 * ```typescript
 * const strategyEntry = resolveToolStrategy(
 *   "session_init:client_discovery",
 *   context.defaultToolStrategies
 * );
 * // Use in executeWithStrategy
 * await executeWithStrategy(server, args, delegateFn, localFn, {
 *   strategy: strategyEntry.strategy,
 *   delegationTimeout: strategyEntry.delegationTimeout,
 *   fallbackEnabled: strategyEntry.fallbackEnabled,
 *   toolName: "session_init:client_discovery",
 * });
 * ```
 */
export function resolveToolStrategy(
  toolName: string,
  config?: ToolStrategyConfig
): ToolStrategyEntry {
  if (!config) {
    return DEFAULT_STRATEGY_ENTRY;
  }

  const entry = config[toolName];
  if (!entry) {
    return DEFAULT_STRATEGY_ENTRY;
  }

  // Merge with defaults (entry may have partial fields)
  return {
    strategy: entry.strategy ?? DEFAULT_STRATEGY_ENTRY.strategy,
    delegationTimeout: entry.delegationTimeout,
    fallbackEnabled: entry.fallbackEnabled ?? DEFAULT_STRATEGY_ENTRY.fallbackEnabled,
  };
}

// =============================================================================
// Capability Checking
// =============================================================================

/**
 * Check if the connected client supports sampling
 *
 * This examines the client capabilities negotiated during MCP handshake.
 * Returns false if server is undefined (e.g., in tests without a real server).
 */
export function clientSupportsSampling(server: Server | undefined): boolean {
  if (!server) {
    return false;
  }
  const capabilities = (
    server as unknown as {
      _clientCapabilities?: { sampling?: object };
    }
  )._clientCapabilities;
  return Boolean(capabilities?.sampling);
}

/**
 * Get client capabilities for inspection
 */
export function getClientCapabilities(
  server: Server | undefined
): Record<string, unknown> | undefined {
  if (!server) {
    return undefined;
  }
  return (
    server as unknown as {
      _clientCapabilities?: Record<string, unknown>;
    }
  )._clientCapabilities;
}

// =============================================================================
// Strategy Executor Types
// =============================================================================

/**
 * Delegation function type - attempts to delegate work to LLM via sampling
 *
 * @param server - MCP Server instance for sampling access
 * @param args - Arguments for the delegation
 * @param timeout - Optional timeout in milliseconds
 * @returns Promise resolving to the delegation result
 */
export type DelegationFn<TArgs, TResult> = (
  server: Server, // Server is always defined when delegation is attempted
  args: TArgs,
  timeout?: number
) => Promise<TResult>;

/**
 * Local execution function type - executes locally without delegation
 *
 * @param args - Arguments for local execution
 * @returns Promise resolving to the local execution result
 */
export type LocalExecutionFn<TArgs, TResult> = (args: TArgs) => Promise<TResult>;

/**
 * Delegation executor options
 */
export interface DelegationOptions {
  /** Execution strategy to use */
  strategy: ExecutionStrategy;
  /** Timeout for delegation attempts in milliseconds */
  delegationTimeout?: number;
  /** Whether to fall back to local on delegation failure (default: true) */
  fallbackEnabled?: boolean;
  /** Tool name for logging and debugging */
  toolName?: string;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when delegation is required but not available
 *
 * This occurs when strategy is "delegate-only" but the client
 * does not support sampling.
 */
export class DelegationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelegationUnavailableError";
  }
}

/**
 * Error thrown when both delegation and local execution fail
 */
export class ExecutionStrategyError extends Error {
  public readonly outcome: ExecutionOutcome = "error";
  public readonly delegationError?: string;
  public readonly localError?: string;

  constructor(message: string, delegationError?: string, localError?: string) {
    super(message);
    this.name = "ExecutionStrategyError";
    this.delegationError = delegationError;
    this.localError = localError;
  }
}

// =============================================================================
// Delegation Executor
// =============================================================================

/**
 * Execute a tool with optional delegation to the host LLM
 *
 * This function implements the tri-state execution hierarchy:
 * - local-only (DEFAULT): Execute locally, never attempt delegation
 * - delegate-first: Try delegation, fallback to local if it fails
 * - delegate-only: Must delegate, error if sampling unavailable
 *
 * @param server - MCP Server instance (for sampling access), can be undefined in tests
 * @param args - Arguments for the tool
 * @param delegateFn - Function to delegate to LLM ("someone else is better")
 * @param localFn - Function to execute locally ("I can do it")
 * @param options - Delegation options
 * @returns Delegation result with outcome and result
 *
 * @example
 * ```typescript
 * const result = await executeWithDelegation(
 *   server,
 *   { query: "What model are you?" },
 *   async (server, args) => {
 *     // Delegate to LLM - they know better
 *     const response = await server.createMessage({
 *       messages: [{ role: "user", content: { type: "text", text: args.query } }],
 *       maxTokens: 100,
 *     });
 *     return extractTextFromSamplingResponse(response);
 *   },
 *   async (args) => {
 *     // Local fallback - we don't know
 *     return "unknown";
 *   },
 *   { strategy: "delegate-first", toolName: "client_discovery" }
 * );
 * ```
 */
export async function executeWithDelegation<TArgs, TResult>(
  server: Server | undefined,
  args: TArgs,
  delegateFn: DelegationFn<TArgs, TResult>,
  localFn: LocalExecutionFn<TArgs, TResult>,
  options: DelegationOptions
): Promise<StrategyExecutionResult> {
  const {
    strategy,
    delegationTimeout = DEFAULT_DELEGATION_TIMEOUT_MS,
    fallbackEnabled = true,
    toolName = "unknown",
  } = options;

  const startTime = Date.now();
  let delegationAttempted = false;
  let delegationError: string | undefined;

  // Helper to build result
  const buildResult = (outcome: ExecutionOutcome, result: unknown): StrategyExecutionResult => ({
    outcome,
    result,
    delegationAttempted,
    delegationError,
    executionTimeMs: Date.now() - startTime,
  });

  // Check sampling availability
  const samplingAvailable = clientSupportsSampling(server);

  logDebug(`Strategy execution: ${toolName}`, {
    metadata: {
      strategy,
      samplingAvailable,
      delegationTimeout,
    },
  });

  // ==========================================================================
  // Strategy: local-only (DEFAULT)
  // "I can do it" - never delegate
  // ==========================================================================
  if (strategy === "local-only") {
    try {
      const result = await localFn(args);
      return buildResult("local", result);
    } catch (error) {
      throw new ExecutionStrategyError(
        `Local execution failed for ${toolName}: ${String(error)}`,
        undefined,
        String(error)
      );
    }
  }

  // ==========================================================================
  // Strategy: delegate-only
  // "Someone else MUST do it" - error if unavailable
  // ==========================================================================
  if (strategy === "delegate-only") {
    if (!samplingAvailable || !server) {
      throw new DelegationUnavailableError(
        `Tool ${toolName} requires delegation but client does not support sampling`
      );
    }

    delegationAttempted = true;
    try {
      const result = await delegateFn(server, args, delegationTimeout);
      return buildResult("delegated", result);
    } catch (error) {
      throw new ExecutionStrategyError(
        `Delegation failed for ${toolName} and no fallback allowed: ${String(error)}`,
        String(error)
      );
    }
  }

  // ==========================================================================
  // Strategy: delegate-first
  // "Someone else is better" - try delegation, fallback to local
  // ==========================================================================
  if (samplingAvailable && server) {
    delegationAttempted = true;
    try {
      const result = await delegateFn(server, args, delegationTimeout);
      return buildResult("delegated", result);
    } catch (error) {
      delegationError = String(error);
      logWarning(`Delegation failed for ${toolName}, attempting local fallback`, {
        metadata: { error: delegationError },
      });

      if (!fallbackEnabled) {
        throw new ExecutionStrategyError(
          `Delegation failed for ${toolName} and fallback disabled`,
          delegationError
        );
      }
    }
  }

  // Fallback to local execution
  try {
    const result = await localFn(args);
    const outcome: ExecutionOutcome = delegationAttempted ? "fallback-local" : "local";
    return buildResult(outcome, result);
  } catch (error) {
    throw new ExecutionStrategyError(
      `Both delegation and local execution failed for ${toolName}`,
      delegationError,
      String(error)
    );
  }
}

// =============================================================================
// Utility: Extract Text from Sampling Response
// =============================================================================

/**
 * Extract text content from a sampling response
 *
 * Handles various response formats from different LLM clients.
 */
export function extractTextFromSamplingResponse(result: CreateMessageResult): string {
  const content = result.content;

  // String content
  if (typeof content === "string") {
    return content;
  }

  // Single content block with text
  if (content && typeof content === "object" && "text" in content) {
    return (content as { text: string }).text;
  }

  // Array of content blocks
  if (Array.isArray(content)) {
    return content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  // Fallback
  return String(content);
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type {
  ExecutionStrategy,
  ExecutionOutcome,
  StrategyExecutionResult,
} from "@mcp-toolkit/model";
