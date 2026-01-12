/**
 * Hook System Types
 *
 * Defines the core types for MCP Toolkit's composable hook system.
 * Hooks are directive `role=assistant` prompts that guide the Host LLM's
 * next action at the right time during interactions.
 *
 * @see /docs/hooks.md for full documentation
 */

import { z } from "zod";

// ============================================================================
// Hook Type and Lifecycle
// ============================================================================

/**
 * The category of hook - determines what the hook is about
 */
export const HookTypeSchema = z
  .enum(["session", "action", "storage", "config"])
  .describe(
    "Hook category: session (lifecycle), action (tool execution), storage (backend-specific), config (configuration guidance)"
  );

export type HookType = z.infer<typeof HookTypeSchema>;

/**
 * The lifecycle phase when the hook should be invoked
 *
 * - start: Beginning of process
 * - running: During execution (tied to requestId)
 * - progress: Progress updates (MCP progress)
 * - cancel: Cancellation requested (MCP cancellation)
 * - end: Process complete
 */
export const HookLifecycleSchema = z
  .enum(["start", "running", "progress", "cancel", "end"])
  .describe("Lifecycle phase aligned with MCP spec: start, running, progress, cancel, end");

export type HookLifecycle = z.infer<typeof HookLifecycleSchema>;

/**
 * RFC 2119 requirement levels for hook importance
 *
 * @see https://www.rfc-editor.org/rfc/rfc2119
 */
export const RequirementLevelSchema = z
  .enum(["MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY"])
  .describe("RFC 2119 requirement level indicating hook importance");

export type RequirementLevel = z.infer<typeof RequirementLevelSchema>;

/**
 * MCP features that hooks can depend on
 */
export const McpFeatureSchema = z
  .enum(["tools", "resources", "prompts", "sampling", "elicitation"])
  .describe("MCP feature capabilities");

export type McpFeature = z.infer<typeof McpFeatureSchema>;

// ============================================================================
// Hook Definition
// ============================================================================

/**
 * Complete hook definition with metadata
 *
 * ID is computed as: `${app}:${type}:${lifecycle}:${tag}`
 */
export const HookDefinitionSchema = z
  .object({
    // Identity
    app: z
      .string()
      .optional()
      .default("mcp-toolkit")
      .describe("App prefix (e.g., 'mcp-toolkit'). Defaults to 'mcp-toolkit'."),

    tag: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "Tag must be kebab-case (lowercase letters, numbers, hyphens)")
      .describe(
        "Required. Machine-friendly ID, filesystem-safe (e.g., 'welcome', 'init-required')"
      ),

    type: HookTypeSchema,

    lifecycle: HookLifecycleSchema,

    // Metadata
    name: z.string().min(1).describe("Human-readable name for this hook"),

    description: z.string().optional().describe("Brief description of what this hook provides"),

    // Requirement Level (RFC 2119)
    requirementLevel: RequirementLevelSchema.describe(
      "RFC 2119 requirement level: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY"
    ),

    // Ordering within requirement level
    priority: z
      .number()
      .int()
      .default(50)
      .describe("Order within requirement level (higher = more important, default: 50)"),

    // Content
    contentFile: z
      .string()
      .optional()
      .describe(
        "Optional explicit path to .md content file. Default: adjacent .md with same name as tag"
      ),

    // Conditions
    conditions: z
      .object({
        requiresStorage: z
          .array(z.string())
          .optional()
          .describe("Only include if one of these storage backends is active"),
        requiresFeatures: z
          .array(McpFeatureSchema)
          .optional()
          .describe("Only include if these MCP features are available"),
        requiresConfig: z
          .record(z.unknown())
          .optional()
          .describe("Only include if config matches these values"),
      })
      .optional()
      .describe("Conditions that must be met for this hook to be included"),

    // Request context (for running/progress/cancel lifecycle)
    sessionId: z
      .string()
      .optional()
      .describe("Session ID this hook is tied to (for request-scoped hooks)"),

    requestId: z
      .string()
      .optional()
      .describe("MCP request ID this hook is tied to (for running/progress/cancel lifecycle)"),

    // Tags for categorization
    tags: z.array(z.string()).default([]).describe("Tags for categorization and filtering"),

    // Workflow control
    blocking: z
      .boolean()
      .default(false)
      .describe(
        "If true, this hook blocks further tool execution until its workflow completes (e.g., config gathering)"
      ),

    dependencies: z
      .array(z.string())
      .default([])
      .describe("Hook IDs that must complete before this hook can be active"),
  })
  .transform((data) => ({
    ...data,
    // Computed ID property
    id: `${data.app}:${data.type}:${data.lifecycle}:${data.tag}` as const,
  }));

export type HookDefinition = z.infer<typeof HookDefinitionSchema>;

/**
 * Input schema for registering hooks (without requiring all defaults)
 */
export const HookDefinitionInputSchema = HookDefinitionSchema.innerType().partial({
  app: true,
  priority: true,
  tags: true,
  blocking: true,
  dependencies: true,
});

export type HookDefinitionInput = z.input<typeof HookDefinitionInputSchema>;

// ============================================================================
// Resolved Hook (with content loaded)
// ============================================================================

/**
 * A hook with its content resolved and ready for composition
 */
export interface ResolvedHook extends HookDefinition {
  /** The resolved markdown content for this hook */
  content: string;
  /** The path from which content was loaded (if from file) */
  contentPath?: string;
  /** ISO 8601 timestamp when content was resolved */
  resolvedAt: string;
}

// ============================================================================
// Hook Query Options
// ============================================================================

/**
 * Options for querying hooks from the registry
 */
export const HookQueryOptionsSchema = z.object({
  type: HookTypeSchema.optional().describe("Filter by hook type"),

  lifecycle: HookLifecycleSchema.optional().describe("Filter by lifecycle phase"),

  tags: z.array(z.string()).optional().describe("Filter to hooks with any of these tags"),

  storage: z.string().optional().describe("Current storage backend ID (for condition evaluation)"),

  feature: McpFeatureSchema.optional().describe("Current feature (for condition evaluation)"),

  config: z.record(z.unknown()).optional().describe("Current config (for condition evaluation)"),

  sessionId: z.string().optional().describe("Filter to hooks for this session"),

  requestId: z.string().optional().describe("Filter to hooks for this request"),
});

export type HookQueryOptions = z.infer<typeof HookQueryOptionsSchema>;

// ============================================================================
// Hook Summary (for composition results)
// ============================================================================

/**
 * Summary of a hook for composition results
 */
export interface HookSummary {
  /** Hook ID */
  id: string;
  /** Hook name */
  name: string;
  /** Requirement level */
  requirementLevel: RequirementLevel;
  /** Priority within level */
  priority: number;
  /** Reason for skipping (if skipped) */
  skipReason?: string;
  /** Error message (if failed to load) */
  error?: string;
}

// ============================================================================
// Composed Hook Result
// ============================================================================

/**
 * Result of composing multiple hooks together
 */
export interface ComposedHooksResult {
  /** The combined content from all composed hooks */
  content: string;

  /** Hooks that were included in composition */
  includedHooks: HookSummary[];

  /** Hooks that were skipped (conditions not met) */
  skippedHooks: HookSummary[];

  /** Hooks that failed to load */
  failedHooks: HookSummary[];

  /** Transparency notices about what was omitted */
  notices: string[];

  /** ISO 8601 timestamp when composition occurred */
  composedAt: string;
}
