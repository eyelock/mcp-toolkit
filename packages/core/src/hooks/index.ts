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

// Types
export {
  HookTypeSchema,
  HookLifecycleSchema,
  RequirementLevelSchema,
  McpFeatureSchema,
  HookDefinitionSchema,
  HookDefinitionInputSchema,
  HookQueryOptionsSchema,
  type HookType,
  type HookLifecycle,
  type RequirementLevel,
  type McpFeature,
  type HookDefinition,
  type HookDefinitionInput,
  type ResolvedHook,
  type HookQueryOptions,
  type HookSummary,
  type ComposedHooksResult,
} from "./types.js";

// Registry
export { HookRegistry, createHookRegistry } from "./registry.js";

// Content Loader
export {
  HookContentLoader,
  createContentLoader,
  type ContentLoaderOptions,
} from "./loader.js";

// Composer
export {
  HookComposer,
  createComposer,
  composeHooks,
  type ComposerOptions,
} from "./composer.js";
