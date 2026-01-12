/**
 * @mcp-toolkit/toolkit
 *
 * Guided onboarding workflow demonstrating MCP Specification features
 * and teaching developers how to customize their MCP Toolkit instance.
 *
 * This package is self-contained and can be removed without affecting
 * the core MCP Toolkit functionality.
 *
 * @module @mcp-toolkit/toolkit
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HookRegistry,
  HookContentLoader,
  HookComposer,
  type ResolvedHook,
  type ComposedHooksResult,
} from "@mcp-toolkit/core";
import { registerBlockingHook, type WorkflowStateTracker } from "@mcp-toolkit/mcp";

// Re-export all hook definitions
export * from "./hooks/index.js";

// Re-export hook types from core for convenience
export type {
  HookDefinition,
  HookDefinitionInput,
  ResolvedHook,
  ComposedHooksResult,
} from "@mcp-toolkit/core";

import { allToolkitHooks, toolkitBlockingHooks, CONFIG_HOOK_ID } from "./hooks/index.js";

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
