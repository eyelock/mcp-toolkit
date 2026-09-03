/**
 * Tool Delegation
 *
 * Implements the tri-state delegation hierarchy:
 * 1. "I can do it" - Local implementation (DEFAULT - self-reliant)
 * 2. "Someone else is better" - Delegate to the host LLM (opt-in)
 * 3. "Emergency" - Neither works, escalate/error
 *
 * Philosophy: Tools are self-reliant by default. Delegation is an explicit
 * choice when the tool knows the host LLM can do it better.
 *
 * ## Delegation is a round trip, not a call
 *
 * `2026-07-28` removed server-to-client requests, so a handler can no longer
 * `await server.createMessage(...)` mid-call - that throws on a modern
 * connection. Delegation is expressed as a *pull*: the handler returns a
 * request for the host LLM to answer, and is called again with the answer.
 *
 * ```typescript
 * const result = await executeWithDelegation(context, args, spec, localFn, options);
 * if (result.outcome === "pending") {
 *   return result.request as CallToolResult; // client answers, then calls us again
 * }
 * ```
 *
 * Because the handler re-runs from the top, put the delegation point *before*
 * any writes - anything done before it happens on every round.
 *
 * | Transport | Era    | Delegation |
 * |-----------|--------|------------|
 * | stdio     | modern | yes (pull) |
 * | stdio     | legacy | yes - the SDK shim turns the return into a 2025 push |
 * | HTTP      | modern | yes (pull) |
 * | HTTP      | legacy | local fallback - no channel to reach the client on |
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28
 */

import type {
  DelegationMode,
  DelegationResult,
  ExecutionOutcome,
  ToolDelegationConfig,
  ToolDelegationEntry,
} from "@mcp-toolkit/model";
import {
  type CreateMessageRequestParams,
  type CreateMessageResult,
  type InputRequiredResult,
  type InputResponseView,
  inputRequired,
  inputResponse,
} from "@modelcontextprotocol/server";
import { logDebug, logWarning } from "../logging.js";
import type { ServerContext } from "../server.js";

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
export function clientSupportsSampling(
  context: Pick<ServerContext, "clientCapabilities"> | undefined
): boolean {
  return Boolean(context?.clientCapabilities?.sampling);
}

/**
 * Get client capabilities for inspection
 */
export function getClientCapabilities(
  context: Pick<ServerContext, "clientCapabilities"> | undefined
): Record<string, unknown> | undefined {
  return context?.clientCapabilities as Record<string, unknown> | undefined;
}

// =============================================================================
// Delegation Executor Types
// =============================================================================

/**
 * Describes work to hand to the host LLM.
 *
 * Split in two because delegation is a round trip: `build` produces the
 * question, and `parse` reads the answer when the handler is called again.
 * `parse` returns undefined if the answer is unusable, which is treated as a
 * failed delegation (and so falls back to local, when allowed).
 */
export type SamplingAnswer = Extract<InputResponseView, { kind: "sampling" }>["result"];

export interface DelegationSpec<TArgs, TResult> {
  /** Build the sampling request to send to the host LLM */
  build: (args: TArgs) => CreateMessageRequestParams;
  /** Interpret the LLM's answer; undefined means it could not be used */
  parse: (result: SamplingAnswer, args: TArgs) => TResult | undefined;
  /**
   * Names this request among any others in flight. Defaults to the tool name,
   * which is unique enough for a single delegating tool.
   */
  key?: string;
}

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
 * Execute a tool step, optionally delegating it to the host LLM.
 *
 * Implements the tri-state hierarchy:
 * - `local-only` (DEFAULT): execute locally, never delegate
 * - `delegate-first`: ask the LLM; fall back to local if it cannot answer
 * - `delegate-only`: must delegate; error if the LLM is unreachable
 *
 * Delegation is a round trip. On the first call this returns
 * `outcome: "pending"` with a `request` the handler must return; the client
 * answers it and calls the tool again, and this returns `outcome: "delegated"`
 * with the parsed answer.
 *
 * @param context - Handler context (carries client capabilities and any answer)
 * @param args - Arguments for the step
 * @param spec - How to ask the LLM, and how to read its answer
 * @param localFn - Local implementation ("I can do it")
 * @param options - Delegation options
 *
 * @example
 * ```typescript
 * const outcome = await executeWithDelegation(
 *   context,
 *   { timeout: 30_000 },
 *   {
 *     build: () => ({
 *       messages: [{ role: "user", content: { type: "text", text: "What model are you?" } }],
 *       maxTokens: 100,
 *     }),
 *     parse: (result) => extractTextFromSamplingResponse(result),
 *   },
 *   async () => "unknown",
 *   { mode: "delegate-first", toolName: "client_discovery" }
 * );
 *
 * if (outcome.outcome === "pending") {
 *   return outcome.request as CallToolResult;
 * }
 * ```
 */
export async function executeWithDelegation<TArgs, TResult>(
  context: Pick<ServerContext, "clientCapabilities" | "inputResponses"> | undefined,
  args: TArgs,
  spec: DelegationSpec<TArgs, TResult>,
  localFn: LocalExecutionFn<TArgs, TResult>,
  options: DelegationOptions
): Promise<DelegationResult> {
  const { mode, fallbackEnabled = true, toolName = "unknown" } = options;

  const startTime = Date.now();
  let delegationAttempted = false;
  let delegationError: string | undefined;

  const buildResult = (
    outcome: ExecutionOutcome,
    result: unknown,
    request?: InputRequiredResult
  ): DelegationResult => ({
    outcome,
    result,
    ...(request === undefined ? {} : { request }),
    delegationAttempted,
    delegationError,
    executionTimeMs: Date.now() - startTime,
  });

  const runLocal = async (outcome: ExecutionOutcome): Promise<DelegationResult> => {
    try {
      return buildResult(outcome, await localFn(args));
    } catch (error) {
      throw new ExecutionStrategyError(
        `Local execution failed for ${toolName}: ${String(error)}`,
        delegationError,
        String(error)
      );
    }
  };

  // ==========================================================================
  // Mode: local-only (DEFAULT)
  // "I can do it" - never delegate
  // ==========================================================================
  if (mode === "local-only") {
    return runLocal("local");
  }

  const key = spec.key ?? toolName;

  // Has the host LLM already answered? If so this is the resumed round.
  const view = inputResponse(context?.inputResponses, key);
  if (view?.kind === "sampling") {
    delegationAttempted = true;
    const parsed = spec.parse(view.result, args);
    if (parsed !== undefined) {
      return buildResult("delegated", parsed);
    }

    delegationError = "The host LLM's answer could not be used";
    logWarning(`Delegation answer unusable for ${toolName}`, {
      metadata: { key },
    });

    if (mode === "delegate-only" || !fallbackEnabled) {
      throw new ExecutionStrategyError(
        `Delegation failed for ${toolName} and no fallback allowed`,
        delegationError
      );
    }
    return runLocal("fallback-local");
  }

  // Not answered yet. Can this connection reach the host LLM at all?
  const samplingAvailable = clientSupportsSampling(context);

  logDebug(`Delegation execution: ${toolName}`, {
    metadata: { mode, samplingAvailable, key },
  });

  if (!samplingAvailable) {
    if (mode === "delegate-only") {
      throw new DelegationUnavailableError(
        `Tool ${toolName} requires delegation but the client does not support sampling`
      );
    }
    // No channel to the LLM (legacy HTTP, or a client without the capability).
    return runLocal("local");
  }

  // Ask. The handler returns this, and we are called again with the answer.
  delegationAttempted = true;
  return buildResult(
    "pending",
    undefined,
    inputRequired({
      inputRequests: { [key]: inputRequired.createMessage(spec.build(args)) },
    })
  );
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
  DelegationResult,
  ExecutionOutcome,
  // Deprecated aliases
  ExecutionStrategy,
  StrategyExecutionResult,
  ToolDelegationConfig,
  ToolDelegationEntry,
  ToolStrategyConfig,
  ToolStrategyEntry,
} from "@mcp-toolkit/model";
