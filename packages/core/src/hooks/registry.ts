/**
 * Hook Registry
 *
 * Central registry for managing hook definitions. Supports registration,
 * querying, and retrieval of hooks by various criteria.
 */

import {
  HookDefinitionSchema,
  type HookDefinition,
  type HookDefinitionInput,
  type HookQueryOptions,
} from "./types.js";

/**
 * Registry for managing hook definitions
 */
export class HookRegistry {
  private hooks: Map<string, HookDefinition> = new Map();

  /**
   * Register a new hook definition
   * @throws Error if hook with same ID already exists
   */
  register(input: HookDefinitionInput): HookDefinition {
    const hook = HookDefinitionSchema.parse(input);

    if (this.hooks.has(hook.id)) {
      throw new Error(`Hook with ID '${hook.id}' is already registered`);
    }

    this.hooks.set(hook.id, hook);
    return hook;
  }

  /**
   * Register multiple hooks at once
   * @throws Error if any hook ID already exists
   */
  registerAll(inputs: HookDefinitionInput[]): HookDefinition[] {
    return inputs.map((input) => this.register(input));
  }

  /**
   * Get a hook by its ID
   */
  get(id: string): HookDefinition | undefined {
    return this.hooks.get(id);
  }

  /**
   * Check if a hook with the given ID exists
   */
  has(id: string): boolean {
    return this.hooks.has(id);
  }

  /**
   * Remove a hook by its ID
   * @returns true if the hook was removed, false if it didn't exist
   */
  unregister(id: string): boolean {
    return this.hooks.delete(id);
  }

  /**
   * Query hooks based on filter options
   */
  query(options: HookQueryOptions = {}): HookDefinition[] {
    let results = Array.from(this.hooks.values());

    // Filter by type
    if (options.type) {
      results = results.filter((h) => h.type === options.type);
    }

    // Filter by lifecycle
    if (options.lifecycle) {
      results = results.filter((h) => h.lifecycle === options.lifecycle);
    }

    // Filter by tags (any match)
    if (options.tags && options.tags.length > 0) {
      results = results.filter((h) => h.tags.some((tag) => options.tags!.includes(tag)));
    }

    // Filter by conditions
    results = results.filter((h) =>
      this.evaluateConditions(h, options.provider, options.feature, options.config)
    );

    // Sort by priority (lower = earlier)
    results.sort((a, b) => a.priority - b.priority);

    return results;
  }

  /**
   * Get all registered hooks
   */
  all(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get the count of registered hooks
   */
  size(): number {
    return this.hooks.size;
  }

  /**
   * Clear all registered hooks
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * Evaluate whether a hook's conditions are met
   */
  private evaluateConditions(
    hook: HookDefinition,
    provider?: string,
    feature?: string,
    config?: Record<string, unknown>
  ): boolean {
    const conditions = hook.conditions;
    if (!conditions) {
      return true;
    }

    // Check provider requirement
    if (conditions.requiresProvider && conditions.requiresProvider !== provider) {
      return false;
    }

    // Check feature requirement
    if (conditions.requiresFeature && conditions.requiresFeature !== feature) {
      return false;
    }

    // Check config requirements
    if (conditions.requiresConfig && config) {
      for (const [key, value] of Object.entries(conditions.requiresConfig)) {
        if (config[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }
}

/**
 * Create a new hook registry instance
 */
export function createHookRegistry(): HookRegistry {
  return new HookRegistry();
}
