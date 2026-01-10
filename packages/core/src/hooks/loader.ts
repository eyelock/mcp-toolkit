/**
 * Hook Content Loader
 *
 * Resolves and loads markdown content for hooks. Supports convention-based
 * adjacent .md file resolution or explicit contentFile paths.
 */

import { readFile } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookDefinition, ResolvedHook } from "./types.js";

/**
 * Options for the content loader
 */
export interface ContentLoaderOptions {
  /**
   * Base directory for resolving relative content paths.
   * If not provided, paths are resolved relative to the hook definition file.
   */
  basePath?: string;

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
  private readonly options: ContentLoaderOptions;

  constructor(options: ContentLoaderOptions = {}) {
    this.options = {
      cache: true,
      ...options,
    };
  }

  /**
   * Resolve the content path for a hook definition.
   *
   * If contentFile is provided, uses that path.
   * Otherwise, looks for an adjacent .md file with the same basename.
   *
   * @param hook The hook definition
   * @param definitionPath Path to the .ts file that defines the hook
   */
  resolveContentPath(hook: HookDefinition, definitionPath: string): string {
    if (hook.contentFile) {
      // Explicit content file - resolve relative to definition or basePath
      if (this.options.basePath) {
        return join(this.options.basePath, hook.contentFile);
      }
      return join(dirname(definitionPath), hook.contentFile);
    }

    // Convention: adjacent .md file with same basename
    const dir = dirname(definitionPath);
    const base = basename(definitionPath, extname(definitionPath));
    return join(dir, `${base}.md`);
  }

  /**
   * Load content for a hook definition
   *
   * @param hook The hook definition
   * @param definitionPath Path to the .ts file that defines the hook
   * @returns The resolved hook with content loaded
   */
  async load(hook: HookDefinition, definitionPath: string): Promise<ResolvedHook> {
    const contentPath = this.resolveContentPath(hook, definitionPath);

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
   * Load content for multiple hooks
   */
  async loadAll(
    hooks: Array<{ hook: HookDefinition; definitionPath: string }>
  ): Promise<ResolvedHook[]> {
    return Promise.all(hooks.map(({ hook, definitionPath }) => this.load(hook, definitionPath)));
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
export function createContentLoader(options?: ContentLoaderOptions): HookContentLoader {
  return new HookContentLoader(options);
}

/**
 * Helper to get the directory of the current module
 * Use this when defining hooks to resolve content paths correctly
 */
export function getModuleDir(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}
