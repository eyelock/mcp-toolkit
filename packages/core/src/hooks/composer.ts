/**
 * Hook Composer
 *
 * Composes multiple resolved hooks into a single output, grouping by
 * RFC 2119 requirement level and respecting priority ordering within groups.
 */

import type { ComposedHooksResult, HookSummary, RequirementLevel, ResolvedHook } from "./types.js";

/**
 * Preamble text for each requirement level section
 */
const REQUIREMENT_PREAMBLES: Record<RequirementLevel, string> = {
  MUST: "These are absolute requirements. You must follow these instructions.",
  "MUST NOT": "These are absolute prohibitions. You must not do these things.",
  SHOULD: "These are recommended actions. Follow unless you have good reason not to.",
  "SHOULD NOT": "These are not recommended. May be done with good reason.",
  MAY: "These are optional. Use your judgment.",
};

/**
 * Ordering for requirement levels in composed output
 */
const REQUIREMENT_ORDER: RequirementLevel[] = ["MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY"];

/**
 * Options for composing hooks
 */
export interface ComposerOptions {
  /**
   * Include section preambles explaining requirement levels (default: true)
   */
  includePreambles?: boolean;

  /**
   * Separator between hooks within a section (default: "\n\n---\n\n")
   */
  separator?: string;

  /**
   * Include RFC 2119 reference at the top (default: true)
   */
  includeRfc2119Reference?: boolean;
}

const DEFAULT_OPTIONS: Required<ComposerOptions> = {
  includePreambles: true,
  separator: "\n\n---\n\n",
  includeRfc2119Reference: true,
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
   * Hooks are grouped by RFC 2119 requirement level:
   * 1. MUST / MUST NOT
   * 2. SHOULD / SHOULD NOT
   * 3. MAY
   *
   * Within each group, hooks are ordered by priority (higher = first).
   */
  compose(hooks: ResolvedHook[]): ComposedHooksResult {
    const now = new Date().toISOString();

    if (hooks.length === 0) {
      return {
        content: "",
        includedHooks: [],
        skippedHooks: [],
        failedHooks: [],
        notices: [],
        composedAt: now,
      };
    }

    // Group hooks by requirement level
    const grouped = this.groupByRequirementLevel(hooks);

    // Build composed content
    const sections: string[] = [];
    const includedHooks: HookSummary[] = [];

    // Add RFC 2119 reference
    if (this.options.includeRfc2119Reference) {
      sections.push(
        "> The following sections use requirement levels defined in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)."
      );
    }

    // Compose each requirement level section
    for (const level of REQUIREMENT_ORDER) {
      const levelHooks = grouped.get(level);
      if (!levelHooks || levelHooks.length === 0) {
        continue;
      }

      // Sort by priority within level (higher = first)
      const sorted = [...levelHooks].sort((a, b) => b.priority - a.priority);

      // Build section
      const sectionParts: string[] = [];

      // Section header
      sectionParts.push(`## ${level}`);

      // Preamble
      if (this.options.includePreambles) {
        sectionParts.push("");
        sectionParts.push(REQUIREMENT_PREAMBLES[level]);
      }

      // Hook contents
      for (const hook of sorted) {
        sectionParts.push("");
        sectionParts.push(`### ${hook.name}`);
        sectionParts.push("");
        sectionParts.push(hook.content);

        includedHooks.push({
          id: hook.id,
          name: hook.name,
          requirementLevel: hook.requirementLevel,
          priority: hook.priority,
        });
      }

      sections.push(sectionParts.join("\n"));
    }

    return {
      content: sections.join("\n\n---\n\n"),
      includedHooks,
      skippedHooks: [],
      failedHooks: [],
      notices: [],
      composedAt: now,
    };
  }

  /**
   * Compose hooks and track skipped/failed hooks for transparency
   */
  composeWithTransparency(
    resolved: ResolvedHook[],
    skipped: Array<{ hook: HookSummary; reason: string }>,
    failed: Array<{ hook: HookSummary; error: string }>
  ): ComposedHooksResult {
    const result = this.compose(resolved);

    // Add skipped hooks
    result.skippedHooks = skipped.map(({ hook, reason }) => ({
      ...hook,
      skipReason: reason,
    }));

    // Add failed hooks
    result.failedHooks = failed.map(({ hook, error }) => ({
      ...hook,
      error,
    }));

    // Generate notices
    if (skipped.length > 0) {
      const skipDetails = skipped.map(({ hook, reason }) => `${hook.name} (${reason})`).join(", ");
      result.notices.push(
        `${skipped.length} hook(s) were skipped (conditions not met): ${skipDetails}`
      );
    }

    if (failed.length > 0) {
      const failDetails = failed.map(({ hook, error }) => `${hook.name} (${error})`).join(", ");
      result.notices.push(`${failed.length} hook(s) failed to load: ${failDetails}`);
    }

    return result;
  }

  /**
   * Group hooks by requirement level
   */
  private groupByRequirementLevel(hooks: ResolvedHook[]): Map<RequirementLevel, ResolvedHook[]> {
    const groups = new Map<RequirementLevel, ResolvedHook[]>();

    for (const level of REQUIREMENT_ORDER) {
      groups.set(level, []);
    }

    for (const hook of hooks) {
      const group = groups.get(hook.requirementLevel);
      if (group) {
        group.push(hook);
      }
    }

    return groups;
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
