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
 *   tag: "welcome",
 *   type: "session",
 *   lifecycle: "start",
 *   name: "Welcome",
 *   requirementLevel: "SHOULD",
 * });
 *
 * // Query and compose hooks
 * const hooks = registry.query({ type: "session", lifecycle: "start" });
 * const loader = createContentLoader({ basePath: "./hooks" });
 * const { resolved } = await loader.loadAll(hooks);
 * const result = composeHooks(resolved);
 * ```
 */

// Composer
export {
  type ComposerOptions,
  composeHooks,
  createComposer,
  HookComposer,
} from "./composer.js";
// Content Loader
export {
  type ContentLoaderOptions,
  createContentLoader,
  HookContentLoader,
} from "./loader.js";
// Registry
export { createHookRegistry, HookRegistry } from "./registry.js";
// Types
export {
  type ComposedHooksResult,
  type HookDefinition,
  type HookDefinitionInput,
  HookDefinitionInputSchema,
  HookDefinitionSchema,
  type HookLifecycle,
  HookLifecycleSchema,
  type HookQueryOptions,
  HookQueryOptionsSchema,
  type HookSummary,
  type HookType,
  HookTypeSchema,
  type McpFeature,
  McpFeatureSchema,
  type RequirementLevel,
  RequirementLevelSchema,
  type ResolvedHook,
} from "./types.js";
