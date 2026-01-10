/**
 * Hook Composer
 *
 * Composes multiple resolved hooks into a single output, respecting
 * priority ordering and dependency relationships.
 */

import type { ResolvedHook, ComposedHooksResult } from "./types.js";

/**
 * Options for composing hooks
 */
export interface ComposerOptions {
  /**
   * Separator between hook contents (default: double newline)
   */
  separator?: string;

  /**
   * Include hook headers in output (default: false)
   */
  includeHeaders?: boolean;

  /**
   * Header format when includeHeaders is true
   * Available placeholders: {id}, {name}, {priority}
   */
  headerFormat?: string;
}

const DEFAULT_OPTIONS: Required<ComposerOptions> = {
  separator: "\n\n",
  includeHeaders: false,
  headerFormat: "## {name}",
};

/**
 * Composer for combining resolved hooks
 */
export class HookComposer {
  private readonly options: Required<ComposerOptions>;

  constructor(options: ComposerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compose multiple resolved hooks into a single result.
   *
   * Hooks are ordered by:
   * 1. Dependency order (dependencies come first)
   * 2. Priority (lower = earlier)
   * 3. Registration order (stable sort)
   */
  compose(hooks: ResolvedHook[]): ComposedHooksResult {
    if (hooks.length === 0) {
      return {
        content: "",
        hooks: [],
        composedAt: new Date().toISOString(),
        blockingHooks: [],
      };
    }

    // Sort by dependencies then priority
    const sorted = this.topologicalSort(hooks);

    // Build composed content
    const contentParts: string[] = [];
    const blockingHooks: string[] = [];

    for (const hook of sorted) {
      if (hook.blocking) {
        blockingHooks.push(hook.id);
      }

      if (this.options.includeHeaders) {
        const header = this.formatHeader(hook);
        contentParts.push(`${header}\n\n${hook.content}`);
      } else {
        contentParts.push(hook.content);
      }
    }

    return {
      content: contentParts.join(this.options.separator),
      hooks: sorted.map((h) => ({
        id: h.id,
        name: h.name,
        priority: h.priority,
      })),
      composedAt: new Date().toISOString(),
      blockingHooks,
    };
  }

  /**
   * Sort hooks respecting dependencies and priority
   */
  private topologicalSort(hooks: ResolvedHook[]): ResolvedHook[] {
    const hookMap = new Map(hooks.map((h) => [h.id, h]));
    const visited = new Set<string>();
    const result: ResolvedHook[] = [];

    // Build dependency graph
    const visit = (hook: ResolvedHook, ancestors: Set<string>) => {
      if (visited.has(hook.id)) {
        return;
      }

      if (ancestors.has(hook.id)) {
        throw new Error(
          `Circular dependency detected: ${Array.from(ancestors).join(" -> ")} -> ${hook.id}`
        );
      }

      ancestors.add(hook.id);

      // Visit dependencies first
      for (const depId of hook.dependencies) {
        const dep = hookMap.get(depId);
        if (dep) {
          visit(dep, new Set(ancestors));
        }
        // Silently ignore missing dependencies - they may be from other registries
      }

      visited.add(hook.id);
      result.push(hook);
    };

    // Sort hooks by priority first, then visit in that order
    const sortedByPriority = [...hooks].sort((a, b) => a.priority - b.priority);

    for (const hook of sortedByPriority) {
      visit(hook, new Set());
    }

    return result;
  }

  /**
   * Format header for a hook
   */
  private formatHeader(hook: ResolvedHook): string {
    return this.options.headerFormat
      .replace("{id}", hook.id)
      .replace("{name}", hook.name)
      .replace("{priority}", String(hook.priority));
  }
}

/**
 * Create a new hook composer instance
 */
export function createComposer(options?: ComposerOptions): HookComposer {
  return new HookComposer(options);
}

/**
 * Compose hooks with default options (convenience function)
 */
export function composeHooks(hooks: ResolvedHook[]): ComposedHooksResult {
  return new HookComposer().compose(hooks);
}
