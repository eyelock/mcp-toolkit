/**
 * MCP Toolkit Hooks Module
 *
 * Provides pre-configured hook definitions and utilities for the MCP Toolkit
 * session lifecycle.
 *
 * @example
 * ```typescript
 * import { createCoreHookRegistry, loadCoreHooks } from "@mcp-toolkit/mcp/hooks";
 *
 * // Create registry with core hooks pre-registered
 * const registry = createCoreHookRegistry();
 *
 * // Load hooks for session start
 * const { resolved } = await loadCoreHooks("session", "start");
 * ```
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type HookDefinition,
  type HookLifecycle,
  type HookRegistry,
  type HookType,
  composeHooks,
  createContentLoader,
  createHookRegistry,
} from "@mcp-toolkit/core";
import { coreHookDefinitions } from "./definitions.js";

// Re-export definitions
export { coreHookDefinitions, sessionEndCoreHook, sessionStartCoreHook } from "./definitions.js";

/**
 * Get the hooks content directory path
 */
export function getHooksContentPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "content");
}

/**
 * Create a hook registry pre-populated with core MCP Toolkit hooks
 */
export function createCoreHookRegistry(): HookRegistry {
  const registry = createHookRegistry();
  registry.registerAll(coreHookDefinitions);
  return registry;
}

/**
 * Load and compose hooks for a specific lifecycle phase
 *
 * @param type - Hook type (session, action, storage, config)
 * @param lifecycle - Lifecycle phase (start, running, progress, cancel, end)
 * @param options - Additional query options
 * @returns Composed hook result with content
 */
export async function loadCoreHooks(
  type: HookType,
  lifecycle: HookLifecycle,
  options: {
    registry?: HookRegistry;
    storage?: string;
    feature?: string;
  } = {}
) {
  const registry = options.registry ?? createCoreHookRegistry();
  const contentPath = getHooksContentPath();
  const loader = createContentLoader({ basePath: contentPath });

  // Query hooks matching the lifecycle
  const hooks = registry.query({
    type,
    lifecycle,
    storage: options.storage,
    feature: options.feature as "tools" | "resources" | "prompts" | "sampling" | "elicitation",
  });

  // Load content for each hook
  const { resolved, failed } = await loader.loadAll(hooks);

  // Compose the resolved hooks
  const composed = composeHooks(resolved);

  return {
    hooks: resolved,
    failed,
    composed,
    content: composed.content,
  };
}

/**
 * Get session start guidance content
 *
 * Convenience function to load the session start hooks and return
 * the composed content.
 */
export async function getSessionStartContent(options?: {
  registry?: HookRegistry;
  storage?: string;
}): Promise<string> {
  const result = await loadCoreHooks("session", "start", options);
  return result.content;
}

/**
 * Get session end guidance content
 *
 * Convenience function to load the session end hooks and return
 * the composed content.
 */
export async function getSessionEndContent(options?: {
  registry?: HookRegistry;
  storage?: string;
}): Promise<string> {
  const result = await loadCoreHooks("session", "end", options);
  return result.content;
}

/**
 * Register additional hooks to the core registry
 *
 * @param registry - Registry to add hooks to (defaults to new core registry)
 * @param hooks - Additional hook definitions to register
 * @returns The registry with all hooks registered
 */
export function extendCoreHooks(
  hooks: Parameters<HookRegistry["registerAll"]>[0],
  registry: HookRegistry = createCoreHookRegistry()
): HookRegistry {
  registry.registerAll(hooks);
  return registry;
}

/**
 * Get a specific core hook definition by tag
 */
export function getCoreHook(tag: string): HookDefinition | undefined {
  const registry = createCoreHookRegistry();
  // Find the hook matching the tag pattern
  const allHooks = registry.all();
  return allHooks.find((h) => h.tag === tag);
}
