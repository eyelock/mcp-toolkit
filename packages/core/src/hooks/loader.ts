/**
 * Hook Content Loader
 *
 * Resolves and loads markdown content for hooks. Supports convention-based
 * resolution from tag name or explicit contentFile paths.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HookDefinition, ResolvedHook } from "./types.js";

/**
 * Options for the content loader
 */
export interface ContentLoaderOptions {
  /**
   * Base directory for resolving content files.
   * Content is loaded from `${basePath}/${hook.tag}.md` unless
   * the hook specifies an explicit contentFile.
   */
  basePath: string;

  /**
   * Cache resolved content to avoid repeated file reads
   */
  cache?: boolean;
}

/**
 * Loader for resolving hook content from .md files
 */
export class HookContentLoader {
  private cache: Map<string, string> = new Map();
  private readonly options: Required<ContentLoaderOptions>;

  constructor(options: ContentLoaderOptions) {
    this.options = {
      cache: true,
      ...options,
    };
  }

  /**
   * Resolve the content path for a hook definition.
   *
   * If contentFile is provided, uses that path.
   * Otherwise, looks for a .md file matching the hook's tag in basePath.
   */
  resolveContentPath(hook: HookDefinition): string {
    if (hook.contentFile) {
      // Explicit content file - resolve relative to basePath
      return join(this.options.basePath, hook.contentFile);
    }

    // Convention: basePath/${tag}.md
    return join(this.options.basePath, `${hook.tag}.md`);
  }

  /**
   * Load content for a hook definition
   *
   * @param hook The hook definition
   * @returns The resolved hook with content loaded
   * @throws Error if content file cannot be read
   */
  async load(hook: HookDefinition): Promise<ResolvedHook> {
    const contentPath = this.resolveContentPath(hook);

    // Check cache first
    if (this.options.cache && this.cache.has(contentPath)) {
      return {
        ...hook,
        content: this.cache.get(contentPath)!,
        contentPath,
        resolvedAt: new Date().toISOString(),
      };
    }

    // Load content from file
    const content = await readFile(contentPath, "utf-8");

    // Cache if enabled
    if (this.options.cache) {
      this.cache.set(contentPath, content);
    }

    return {
      ...hook,
      content,
      contentPath,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * Load content for multiple hooks, returning successful loads and failures
   */
  async loadAll(hooks: HookDefinition[]): Promise<{
    resolved: ResolvedHook[];
    failed: Array<{ hook: HookDefinition; error: string }>;
  }> {
    const resolved: ResolvedHook[] = [];
    const failed: Array<{ hook: HookDefinition; error: string }> = [];

    for (const hook of hooks) {
      try {
        const result = await this.load(hook);
        resolved.push(result);
      } catch (error) {
        failed.push({
          hook,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { resolved, failed };
  }

  /**
   * Load content from an inline string (for testing or dynamic hooks)
   */
  loadInline(hook: HookDefinition, content: string): ResolvedHook {
    return {
      ...hook,
      content,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * Clear the content cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the current cache size
   */
  cacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Create a new content loader instance
 */
export function createContentLoader(options: ContentLoaderOptions): HookContentLoader {
  return new HookContentLoader(options);
}
