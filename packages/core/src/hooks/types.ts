/**
 * Hook System Types
 *
 * Defines the core types for MCP Toolkit's composable hook system.
 * Hooks allow providers, workflows, and session lifecycle to contribute
 * guidance at the right time during LLM interactions.
 */

import { z } from "zod";

// ============================================================================
// Hook Type and Lifecycle
// ============================================================================

/**
 * The category of hook - determines when and how it's composed
 */
export const HookTypeSchema = z
  .enum(["session", "action", "provider"])
  .describe(
    "Hook category: session (lifecycle), action (during operations), provider (backend-specific)"
  );

export type HookType = z.infer<typeof HookTypeSchema>;

/**
 * The lifecycle phase when the hook should be invoked
 */
export const HookLifecycleSchema = z
  .enum(["start", "config", "action", "end"])
  .describe(
    "Lifecycle phase: start (session begin), config (configuration), action (during operation), end (session close)"
  );

export type HookLifecycle = z.infer<typeof HookLifecycleSchema>;

// ============================================================================
// Hook Definition
// ============================================================================

/**
 * Complete hook definition with metadata and content resolution
 */
export const HookDefinitionSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("Unique identifier for this hook (e.g., 'mcp-toolkit:session:start')"),

  type: HookTypeSchema,

  lifecycle: HookLifecycleSchema,

  name: z.string().min(1).describe("Human-readable name for this hook"),

  description: z.string().optional().describe("Brief description of what this hook provides"),

  priority: z
    .number()
    .int()
    .default(100)
    .describe("Execution priority (lower = earlier). Default 100. Core hooks use 0-50."),

  contentFile: z
    .string()
    .optional()
    .describe(
      "Explicit path to .md content file. If omitted, resolves to adjacent .md with same basename."
    ),

  dependencies: z
    .array(z.string())
    .default([])
    .describe("Hook IDs that must be composed before this one"),

  blocking: z
    .boolean()
    .default(false)
    .describe("If true, this hook blocks further processing until resolved (e.g., approval)"),

  conditions: z
    .object({
      requiresProvider: z.string().optional().describe("Only include if this provider is active"),
      requiresFeature: z.string().optional().describe("Only include if this feature is enabled"),
      requiresConfig: z
        .record(z.unknown())
        .optional()
        .describe("Only include if config matches these values"),
    })
    .optional()
    .describe("Conditions that must be met for this hook to be included"),

  tags: z.array(z.string()).default([]).describe("Tags for categorization and filtering"),
});

export type HookDefinition = z.infer<typeof HookDefinitionSchema>;

/**
 * Input schema for registering hooks (without requiring all defaults)
 */
export const HookDefinitionInputSchema = HookDefinitionSchema.partial({
  priority: true,
  dependencies: true,
  blocking: true,
  tags: true,
});

export type HookDefinitionInput = z.infer<typeof HookDefinitionInputSchema>;

// ============================================================================
// Resolved Hook (with content loaded)
// ============================================================================

/**
 * A hook with its content resolved and ready for composition
 */
export const ResolvedHookSchema = HookDefinitionSchema.extend({
  content: z.string().describe("The resolved markdown content for this hook"),

  contentPath: z.string().optional().describe("The path from which content was loaded"),

  resolvedAt: z.string().datetime().describe("ISO 8601 timestamp when content was resolved"),
});

export type ResolvedHook = z.infer<typeof ResolvedHookSchema>;

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

  provider: z.string().optional().describe("Current provider ID (for condition evaluation)"),

  feature: z.string().optional().describe("Current feature (for condition evaluation)"),

  config: z.record(z.unknown()).optional().describe("Current config (for condition evaluation)"),
});

export type HookQueryOptions = z.infer<typeof HookQueryOptionsSchema>;

// ============================================================================
// Composed Hook Result
// ============================================================================

/**
 * Result of composing multiple hooks together
 */
export const ComposedHooksResultSchema = z.object({
  content: z.string().describe("The combined content from all composed hooks"),

  hooks: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        priority: z.number(),
      })
    )
    .describe("The hooks that were composed, in order"),

  composedAt: z.string().datetime().describe("ISO 8601 timestamp when composition occurred"),

  blockingHooks: z.array(z.string()).describe("IDs of any blocking hooks that were included"),
});

export type ComposedHooksResult = z.infer<typeof ComposedHooksResultSchema>;
