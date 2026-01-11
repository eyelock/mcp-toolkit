/**
 * Tool Delegation
 *
 * Implements the tri-state delegation hierarchy:
 * 1. "I can do it" - Local implementation (DEFAULT - self-reliant)
 * 2. "Someone else is better" - Delegate to host LLM via sampling (opt-in)
 * 3. "Emergency" - Neither works, escalate/error
 *
 * Philosophy: Tools are self-reliant by default. Delegation is an explicit
 * choice when the tool knows the host LLM can do it better.
 */

import type {
  DelegationMode,
  DelegationResult,
  ExecutionOutcome,
  ToolDelegationConfig,
  ToolDelegationEntry,
} from "@mcp-toolkit/model";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";
import { logDebug, logWarning } from "../logging.js";

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for delegation attempts (30 seconds) */
export const DEFAULT_DELEGATION_TIMEOUT_MS = 30_000;

/** Default delegation entry when no config is provided */
const DEFAULT_DELEGATION_ENTRY: ToolDelegationEntry = {
  mode: "local-only",
  fallbackEnabled: true,
};

// =============================================================================
// Delegation Resolution
// =============================================================================

/**
 * Resolve the delegation configuration for a tool
 *
 * Looks up the tool in the config, falling back to defaults if not found.
 * This is the primary way tools should get their delegation configuration.
 *
 * @param toolName - Name of the tool to resolve delegation for
 * @param config - Tool delegation configuration (from ServerContext.defaultToolDelegations)
 * @returns Resolved delegation entry with all defaults applied
 *
 * @example
 * ```typescript
 * const delegation = resolveToolDelegation(
 *   "session_init:client_discovery",
 *   context.defaultToolDelegations
 * );
 * // Use in executeWithDelegation
 * await executeWithDelegation(server, args, delegateFn, localFn, {
 *   mode: delegation.mode,
 *   delegationTimeout: delegation.delegationTimeout,
 *   fallbackEnabled: delegation.fallbackEnabled,
 *   toolName: "session_init:client_discovery",
 * });
 * ```
 */
export function resolveToolDelegation(
  toolName: string,
  config?: ToolDelegationConfig
): ToolDelegationEntry {
  if (!config) {
    return DEFAULT_DELEGATION_ENTRY;
  }

  const entry = config[toolName];
  if (!entry) {
    return DEFAULT_DELEGATION_ENTRY;
  }

  // Merge with defaults (entry may have partial fields)
  return {
    mode: entry.mode ?? DEFAULT_DELEGATION_ENTRY.mode,
    delegationTimeout: entry.delegationTimeout,
    fallbackEnabled: entry.fallbackEnabled ?? DEFAULT_DELEGATION_ENTRY.fallbackEnabled,
  };
}

/** @deprecated Use resolveToolDelegation instead */
export const resolveToolStrategy = resolveToolDelegation;

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
// Delegation Executor Types
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
  /** Delegation mode to use */
  mode: DelegationMode;
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
 *   { mode: "delegate-first", toolName: "client_discovery" }
 * );
 * ```
 */
export async function executeWithDelegation<TArgs, TResult>(
  server: Server | undefined,
  args: TArgs,
  delegateFn: DelegationFn<TArgs, TResult>,
  localFn: LocalExecutionFn<TArgs, TResult>,
  options: DelegationOptions
): Promise<DelegationResult> {
  const {
    mode,
    delegationTimeout = DEFAULT_DELEGATION_TIMEOUT_MS,
    fallbackEnabled = true,
    toolName = "unknown",
  } = options;

  const startTime = Date.now();
  let delegationAttempted = false;
  let delegationError: string | undefined;

  // Helper to build result
  const buildResult = (outcome: ExecutionOutcome, result: unknown): DelegationResult => ({
    outcome,
    result,
    delegationAttempted,
    delegationError,
    executionTimeMs: Date.now() - startTime,
  });

  // Check sampling availability
  const samplingAvailable = clientSupportsSampling(server);

  logDebug(`Delegation execution: ${toolName}`, {
    metadata: {
      mode,
      samplingAvailable,
      delegationTimeout,
    },
  });

  // ==========================================================================
  // Mode: local-only (DEFAULT)
  // "I can do it" - never delegate
  // ==========================================================================
  if (mode === "local-only") {
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
  // Mode: delegate-only
  // "Someone else MUST do it" - error if unavailable
  // ==========================================================================
  if (mode === "delegate-only") {
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
  // Mode: delegate-first
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
// Tool Classification
// =============================================================================

/**
 * Tool classification based on delegation behavior
 *
 * This classification is inferred from the delegation configuration at runtime:
 * - SamplingTool: Requires or benefits from LLM sampling (delegate-first, delegate-only)
 * - ImplementationTool: Fully implemented locally (local-only)
 *
 * Use this to categorize tools for documentation, UI, or capability discovery.
 */
export type ToolClassification = "sampling" | "implementation";

/**
 * Classify a tool based on its delegation mode
 *
 * @param mode - The delegation mode of the tool
 * @returns "sampling" if the tool uses or requires LLM delegation, "implementation" otherwise
 *
 * @example
 * ```typescript
 * const delegation = resolveToolDelegation("my_tool:subtask", config);
 * const classification = classifyTool(delegation.mode);
 * // classification: "sampling" or "implementation"
 * ```
 */
export function classifyTool(mode: DelegationMode): ToolClassification {
  return mode === "local-only" ? "implementation" : "sampling";
}

/**
 * Classify a tool by name from the delegation configuration
 *
 * @param toolName - The tool name to classify
 * @param config - Tool delegation configuration
 * @returns Tool classification based on its configured delegation mode
 *
 * @example
 * ```typescript
 * const classification = classifyToolByName(
 *   "session_init:client_discovery",
 *   context.defaultToolDelegations
 * );
 * // classification: "sampling" (if configured as delegate-first)
 * ```
 */
export function classifyToolByName(
  toolName: string,
  config?: ToolDelegationConfig
): ToolClassification {
  const delegation = resolveToolDelegation(toolName, config);
  return classifyTool(delegation.mode);
}

/**
 * Get all tools of a specific classification from the configuration
 *
 * @param classification - The classification to filter by
 * @param config - Tool delegation configuration
 * @returns Array of tool names matching the classification
 *
 * @example
 * ```typescript
 * // Get all sampling tools
 * const samplingTools = getToolsByClassification("sampling", config);
 * // ["session_init:client_discovery", "code_review:analyze", ...]
 *
 * // Get all local implementation tools
 * const implTools = getToolsByClassification("implementation", config);
 * // ["server_info", "session_status", ...]
 * ```
 */
export function getToolsByClassification(
  classification: ToolClassification,
  config?: ToolDelegationConfig
): string[] {
  if (!config) return [];

  return Object.entries(config)
    .filter(([_, entry]) => {
      const mode = entry.mode ?? "local-only";
      return classifyTool(mode) === classification;
    })
    .map(([toolName]) => toolName);
}

/**
 * Check if a tool requires sampling to function
 *
 * Returns true only if the tool is configured as "delegate-only".
 *
 * @param toolName - The tool name to check
 * @param config - Tool delegation configuration
 * @returns true if the tool requires sampling (delegate-only mode)
 */
export function toolRequiresSampling(toolName: string, config?: ToolDelegationConfig): boolean {
  const delegation = resolveToolDelegation(toolName, config);
  return delegation.mode === "delegate-only";
}

/**
 * Check if a tool can benefit from sampling but doesn't require it
 *
 * Returns true if the tool is configured as "delegate-first".
 *
 * @param toolName - The tool name to check
 * @param config - Tool delegation configuration
 * @returns true if the tool benefits from sampling (delegate-first mode)
 */
export function toolBenefitsFromSampling(toolName: string, config?: ToolDelegationConfig): boolean {
  const delegation = resolveToolDelegation(toolName, config);
  return delegation.mode === "delegate-first";
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type {
  DelegationMode,
  ExecutionOutcome,
  DelegationResult,
  ToolDelegationConfig,
  ToolDelegationEntry,
  // Deprecated aliases
  ExecutionStrategy,
  StrategyExecutionResult,
  ToolStrategyConfig,
  ToolStrategyEntry,
} from "@mcp-toolkit/model";
