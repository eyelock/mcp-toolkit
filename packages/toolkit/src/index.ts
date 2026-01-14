/**
 * @mcp-toolkit/toolkit
 *
 * Guided onboarding workflow demonstrating MCP Specification features
 * and teaching developers how to customize their MCP Toolkit instance.
 *
 * This package is self-contained and can be removed without affecting
 * the core MCP Toolkit functionality.
 *
 * ## Features
 *
 * - **Model Design**: Conversational domain model design
 * - **Code Generation**: Three-tier code generation (definitions, stubs, full)
 * - **Client Setup**: Automated configuration for Claude Desktop, Cursor, VS Code, CLI
 * - **Resources**: Access to model, templates, and client configs
 * - **Prompts**: Guided workflows for design and setup
 *
 * @module @mcp-toolkit/toolkit
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ComposedHooksResult,
  HookComposer,
  HookContentLoader,
  HookRegistry,
  type ResolvedHook,
} from "@mcp-toolkit/core";
import { type WorkflowStateTracker, registerBlockingHook } from "@mcp-toolkit/mcp";
import type {
  CallToolResult,
  GetPromptResult,
  Prompt,
  ReadResourceResult,
  Resource,
  ResourceTemplate,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ===========================================================================
// Re-exports
// ===========================================================================

// Hook definitions
export * from "./hooks/index.js";

// Model schemas and storage (explicit exports to avoid conflicts with hooks)
export {
  // Schemas
  PropertyTypeSchema,
  PropertyDefinitionSchema,
  RelationshipTypeSchema,
  RelationshipDefinitionSchema,
  EntityDefinitionSchema,
  DomainModelSchema,
  GenerationTierSchema,
  ClientTargetSchema,
  ToolkitStateSchema,
  EntityInputSchema,
  ModelDesignInputSchema,
  ModelImportInputSchema,
  GenerateInputSchema,
  SetupClientInputSchema,
  SetupVerifyInputSchema,
  // Types
  type PropertyType,
  type PropertyDefinition,
  type RelationshipType,
  type RelationshipDefinition,
  type EntityDefinition as ToolkitEntityDefinition,
  type DomainModel as ToolkitDomainModel,
  type GenerationTier,
  type ClientTarget,
  type ToolkitState,
  type EntityInput,
  type ModelDesignInput,
  type ModelImportInput,
  type GenerateInput,
  type SetupClientInput,
  type SetupVerifyInput,
  // Storage
  MODEL_FILENAME,
  STATE_FILENAME,
  type StorageOptions,
  type StorageResult,
  ToolkitStorage,
  createToolkitStorage,
} from "./model/index.js";

// MCP Tools
export * from "./tools/index.js";

// MCP Resources
export * from "./resources/index.js";

// MCP Prompts
export * from "./prompts/index.js";

// Re-export hook types from core for convenience
export type {
  HookDefinition,
  HookDefinitionInput,
  ResolvedHook,
  ComposedHooksResult,
} from "@mcp-toolkit/core";

// ===========================================================================
// Imports for internal use
// ===========================================================================

import { CONFIG_HOOK_ID, allToolkitHooks, toolkitBlockingHooks } from "./hooks/index.js";
import { handleToolkitPrompt, isToolkitPrompt, toolkitPrompts } from "./prompts/index.js";
import {
  handleToolkitResourceRead,
  isToolkitResource,
  toolkitResourceTemplates,
  toolkitResources,
} from "./resources/index.js";
import { handleToolkitToolCall, isToolkitTool, toolkitTools } from "./tools/index.js";

// ===========================================================================
// Hook Management
// ===========================================================================

/**
 * Get the path to the hooks directory (where .md content files live)
 */
export function getContentPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Content files are co-located with hook definitions in src/hooks/
  return join(__dirname, "hooks");
}

/**
 * Create a hook registry pre-populated with all toolkit hooks
 */
export function createToolkitRegistry(): HookRegistry {
  const registry = new HookRegistry();
  registry.registerAll(allToolkitHooks);
  return registry;
}

/**
 * Register toolkit hooks with an existing registry
 */
export function registerToolkitHooks(registry: HookRegistry): void {
  registry.registerAll(allToolkitHooks);
}

/**
 * Register toolkit blocking hooks with a workflow tracker
 *
 * This enables the blocking enforcement for toolkit tools.
 */
export function registerToolkitBlocking(tracker?: WorkflowStateTracker): void {
  if (tracker) {
    tracker.registerBlockingHooks(toolkitBlockingHooks);
  } else {
    // Use default tracker
    for (const def of toolkitBlockingHooks) {
      registerBlockingHook(def);
    }
  }
}

/**
 * Resolve all toolkit hooks with their markdown content
 *
 * @returns Array of resolved hooks with content loaded
 */
export async function resolveToolkitHooks(): Promise<ResolvedHook[]> {
  const registry = createToolkitRegistry();
  const loader = new HookContentLoader({
    basePath: getContentPath(),
  });

  const hooks = registry.all();
  const { resolved, failed } = await loader.loadAll(hooks);

  if (failed.length > 0) {
    console.warn(
      `Failed to load ${failed.length} hook(s):`,
      failed.map((f) => `${f.hook.id}: ${f.error}`)
    );
  }

  return resolved;
}

/**
 * Compose all toolkit hooks into a single output
 *
 * @returns Composed hooks result with content and metadata
 */
export async function composeToolkitHooks(): Promise<ComposedHooksResult> {
  const resolved = await resolveToolkitHooks();
  const composer = new HookComposer();
  return composer.compose(resolved);
}

/**
 * Check if the toolkit config hook has been completed
 *
 * @param tracker - Workflow state tracker to check
 * @returns true if config has been completed
 */
export function isToolkitConfigured(tracker: WorkflowStateTracker): boolean {
  return tracker.isHookCompleted(CONFIG_HOOK_ID);
}

/**
 * Mark the toolkit config hook as completed
 *
 * @param tracker - Workflow state tracker
 * @param config - Configuration data from the config phase
 */
export function markToolkitConfigured(
  tracker: WorkflowStateTracker,
  config: Record<string, unknown>
): void {
  tracker.markHookCompleted(CONFIG_HOOK_ID, config);
}

// ===========================================================================
// MCP Component Registration
// ===========================================================================

/**
 * Toolkit MCP components for registration with a server
 */
export interface ToolkitComponents {
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
}

/**
 * Get all toolkit MCP components
 */
export function getToolkitComponents(): ToolkitComponents {
  return {
    tools: toolkitTools,
    resources: toolkitResources,
    resourceTemplates: toolkitResourceTemplates,
    prompts: toolkitPrompts,
  };
}

/**
 * Toolkit handler context
 */
export interface ToolkitContext {
  [key: string]: unknown;
}

/**
 * Toolkit handlers for MCP requests
 */
export interface ToolkitHandlers {
  /** Check if a tool name belongs to the toolkit */
  isToolkitTool: (name: string) => boolean;
  /** Handle a toolkit tool call */
  handleToolCall: (
    name: string,
    args: unknown,
    context: ToolkitContext
  ) => Promise<CallToolResult | null>;
  /** Check if a resource URI belongs to the toolkit */
  isToolkitResource: (uri: string) => boolean;
  /** Handle a toolkit resource read */
  handleResourceRead: (uri: string) => Promise<ReadResourceResult | null>;
  /** Check if a prompt name belongs to the toolkit */
  isToolkitPrompt: (name: string) => boolean;
  /** Handle a toolkit prompt request */
  handlePrompt: (
    name: string,
    args: Record<string, string> | undefined
  ) => Promise<GetPromptResult | null>;
}

/**
 * Get toolkit handlers for integration with a server
 */
export function getToolkitHandlers(): ToolkitHandlers {
  return {
    isToolkitTool,
    handleToolCall: handleToolkitToolCall,
    isToolkitResource,
    handleResourceRead: handleToolkitResourceRead,
    isToolkitPrompt,
    handlePrompt: handleToolkitPrompt,
  };
}

// ===========================================================================
// Convenience Exports
// ===========================================================================

/**
 * Register all toolkit components and return handlers
 *
 * Use this for quick integration:
 * ```typescript
 * const toolkit = registerToolkit();
 * // Add toolkit.components to your server registration
 * // Use toolkit.handlers in your request handlers
 * ```
 */
export function registerToolkit(): {
  components: ToolkitComponents;
  handlers: ToolkitHandlers;
} {
  return {
    components: getToolkitComponents(),
    handlers: getToolkitHandlers(),
  };
}
