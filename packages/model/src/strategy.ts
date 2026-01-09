/**
 * @mcp-toolkit/model - Tool Delegation Schemas
 *
 * Defines the delegation hierarchy for MCP tools:
 * 1. "I can do it" - Local implementation (DEFAULT - self-reliant)
 * 2. "Someone else is better" - Delegate to host LLM via sampling (opt-in)
 * 3. "Emergency" - Neither works, escalate/error
 *
 * Philosophy: Tools are self-reliant by default. Delegation is an explicit
 * choice when the tool knows the host LLM can do it better.
 */

import { z } from "zod";

// =============================================================================
// Delegation Mode
// =============================================================================

/**
 * Tool delegation mode options
 *
 * - local-only: Self-reliant, never delegate (DEFAULT)
 * - delegate-first: Try delegation, fallback to local
 * - delegate-only: Must delegate, error if unavailable
 */
export const DelegationModeSchema = z
  .enum(["local-only", "delegate-first", "delegate-only"])
  .default("local-only")
  .describe(
    "Delegation mode: local-only (self-reliant, never delegate), " +
      "delegate-first (try sampling, fallback local), " +
      "delegate-only (must delegate, error if unavailable)"
  );

/** @deprecated Use DelegationModeSchema instead */
export const ExecutionStrategySchema = DelegationModeSchema;

/**
 * Execution outcome for tracking what path was taken
 */
export const ExecutionOutcomeSchema = z
  .enum(["delegated", "local", "fallback-local", "error"])
  .describe(
    "Outcome of strategy execution: delegated (LLM handled), local (handled locally), " +
      "fallback-local (delegation failed, fell back), error (both failed)"
  );

// =============================================================================
// Client Metadata
// =============================================================================

/**
 * Client capability flags
 */
export const ClientCapabilitiesSchema = z
  .object({
    supportsStreaming: z
      .boolean()
      .optional()
      .describe("Whether the client supports streaming responses"),
    supportsImages: z.boolean().optional().describe("Whether the client supports image content"),
    supportsFunctionCalling: z
      .boolean()
      .optional()
      .describe("Whether the client supports function/tool calling"),
    maxContextTokens: z
      .number()
      .positive()
      .optional()
      .describe("Maximum context window size in tokens"),
  })
  .describe("Client capability flags");

/**
 * Client metadata for understanding the LLM/client environment
 *
 * This can be provided directly by the client or discovered via sampling.
 */
export const ClientMetadataSchema = z
  .object({
    clientName: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe("Client application name (e.g., 'claude-desktop', 'cursor', 'vscode')"),
    clientVersion: z.string().max(50).optional().describe("Client application version"),
    model: z
      .string()
      .max(100)
      .optional()
      .describe("LLM model identifier (e.g., 'claude-opus-4-5-20251101')"),
    modelProvider: z
      .string()
      .max(100)
      .optional()
      .describe("Model provider (e.g., 'anthropic', 'openai')"),
    capabilities: ClientCapabilitiesSchema.optional().describe("Client capability flags"),
  })
  .describe("Metadata about the connected client/LLM environment");

// =============================================================================
// Tool Delegation Configuration
// =============================================================================

/**
 * Per-tool delegation configuration
 */
export const ToolDelegationEntrySchema = z
  .object({
    mode: DelegationModeSchema.describe("Delegation mode for this tool"),
    delegationTimeout: z
      .number()
      .positive()
      .max(300000) // 5 minutes max
      .optional()
      .describe("Timeout for delegation attempts in milliseconds"),
    fallbackEnabled: z
      .boolean()
      .default(true)
      .describe("Whether to fall back to local on delegation failure"),
  })
  .describe("Delegation configuration for a single tool");

/** @deprecated Use ToolDelegationEntrySchema instead */
export const ToolStrategyEntrySchema = ToolDelegationEntrySchema;

/**
 * Per-tool delegation configuration map
 *
 * Allows configuring delegation mode on a per-tool basis.
 */
export const ToolDelegationConfigSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(100), // Tool name
    ToolDelegationEntrySchema
  )
  .default({})
  .describe("Per-tool delegation configuration");

/** @deprecated Use ToolDelegationConfigSchema instead */
export const ToolStrategyConfigSchema = ToolDelegationConfigSchema;

// =============================================================================
// Delegation Execution Result
// =============================================================================

/**
 * Result of delegation-based execution
 *
 * Provides observability into which path was taken and timing information.
 */
export const DelegationResultSchema = z
  .object({
    outcome: ExecutionOutcomeSchema.describe("Which execution path was taken"),
    result: z.unknown().describe("The actual execution result"),
    delegationAttempted: z.boolean().describe("Whether delegation was attempted"),
    delegationError: z.string().optional().describe("Error message if delegation failed"),
    executionTimeMs: z.number().nonnegative().describe("Total execution time in milliseconds"),
  })
  .describe("Result of delegation-based tool execution");

/** @deprecated Use DelegationResultSchema instead */
export const StrategyExecutionResultSchema = DelegationResultSchema;

// =============================================================================
// Type Exports
// =============================================================================

// New types (preferred)
export type DelegationMode = z.infer<typeof DelegationModeSchema>;
export type ExecutionOutcome = z.infer<typeof ExecutionOutcomeSchema>;
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>;
export type ClientMetadata = z.infer<typeof ClientMetadataSchema>;
export type ToolDelegationEntry = z.infer<typeof ToolDelegationEntrySchema>;
export type ToolDelegationConfig = z.infer<typeof ToolDelegationConfigSchema>;
export type DelegationResult = z.infer<typeof DelegationResultSchema>;

// Deprecated aliases for backward compatibility
/** @deprecated Use DelegationMode instead */
export type ExecutionStrategy = DelegationMode;
/** @deprecated Use ToolDelegationEntry instead */
export type ToolStrategyEntry = ToolDelegationEntry;
/** @deprecated Use ToolDelegationConfig instead */
export type ToolStrategyConfig = ToolDelegationConfig;
/** @deprecated Use DelegationResult instead */
export type StrategyExecutionResult = DelegationResult;
