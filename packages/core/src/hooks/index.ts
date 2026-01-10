/**
 * Hook System
 *
 * A composable hook system for MCP Toolkit that allows providers, workflows,
 * and session lifecycle to contribute guidance at the right time.
 *
 * @example
 * ```typescript
 * import {
 *   createHookRegistry,
 *   createContentLoader,
 *   composeHooks,
 * } from "@mcp-toolkit/core/hooks";
 *
 * // Create registry and register hooks
 * const registry = createHookRegistry();
 * registry.register({
 *   id: "session:start",
 *   type: "session",
 *   lifecycle: "start",
 *   name: "Session Start",
 * });
 *
 * // Query and compose hooks
 * const hooks = registry.query({ type: "session", lifecycle: "start" });
 * const loader = createContentLoader();
 * const resolved = await loader.loadAll(
 *   hooks.map(h => ({ hook: h, definitionPath: "..." }))
 * );
 * const result = composeHooks(resolved);
 * ```
 */

// Types
export {
  HookTypeSchema,
  HookLifecycleSchema,
  HookDefinitionSchema,
  HookDefinitionInputSchema,
  ResolvedHookSchema,
  HookQueryOptionsSchema,
  ComposedHooksResultSchema,
  type HookType,
  type HookLifecycle,
  type HookDefinition,
  type HookDefinitionInput,
  type ResolvedHook,
  type HookQueryOptions,
  type ComposedHooksResult,
} from "./types.js";

// Registry
export { HookRegistry, createHookRegistry } from "./registry.js";

// Content Loader
export {
  HookContentLoader,
  createContentLoader,
  getModuleDir,
  type ContentLoaderOptions,
} from "./loader.js";

// Composer
export {
  HookComposer,
  createComposer,
  composeHooks,
  type ComposerOptions,
} from "./composer.js";
