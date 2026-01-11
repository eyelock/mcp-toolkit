/**
 * Progress Notification Utilities
 *
 * Provides helpers for sending progress updates during long-running operations.
 * Per MCP spec, progress notifications are sent when the client provides a progressToken.
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CancellationError } from "./cancellation.js";

/**
 * Progress notification parameters
 */
export interface ProgressParams {
  /** Current progress value (must increase with each call) */
  progress: number;
  /** Total value (optional, omit if unknown) */
  total?: number;
  /** Human-readable status message */
  message?: string;
}

/**
 * Error thrown when progress values don't increase monotonically
 */
export class ProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgressError";
  }
}

/**
 * Progress reporter for long-running operations
 *
 * Handles progress token validation and notification sending.
 * Only sends notifications when a progress token was provided by the client.
 */
export class ProgressReporter {
  private server: McpServer | null;
  private progressToken: string | number | undefined;
  private lastProgress = 0;
  private enabled: boolean;

  constructor(server: McpServer | null, progressToken: string | number | undefined) {
    this.server = server;
    this.progressToken = progressToken;
    this.enabled = server !== null && progressToken !== undefined;
  }

  /**
   * Check if progress reporting is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Report progress
   *
   * Progress values must increase monotonically.
   *
   * @param params - Progress parameters
   * @throws ProgressError if progress value doesn't increase
   */
  async report(params: ProgressParams): Promise<void> {
    if (!this.enabled || this.progressToken === undefined || !this.server) {
      return;
    }

    // Validate progress increases
    if (params.progress <= this.lastProgress) {
      throw new ProgressError(`Progress must increase: ${params.progress} <= ${this.lastProgress}`);
    }

    this.lastProgress = params.progress;

    try {
      await this.server.server.notification({
        method: "notifications/progress",
        params: {
          progressToken: this.progressToken,
          progress: params.progress,
          total: params.total,
          message: params.message,
        },
      });
    } catch {
      // Silently fail - progress notification may not be supported
    }
  }

  /**
   * Report progress as item count
   *
   * Uses 1-based indexing for display (e.g., "1/10" instead of "0/10").
   *
   * @param current - Current item index (0-based)
   * @param total - Total items
   * @param message - Optional status message
   */
  async reportPercentage(current: number, total: number, message?: string): Promise<void> {
    await this.report({
      progress: current + 1, // 1-based for display
      total,
      message,
    });
  }

  /**
   * Report completion
   *
   * @param message - Optional completion message
   */
  async complete(message?: string): Promise<void> {
    if (!this.enabled) return;

    // Send final progress with message
    await this.report({
      progress: this.lastProgress + 1,
      message: message ?? "Complete",
    });
  }
}

/**
 * Tool handler extra data with progress token
 */
export interface ToolHandlerExtra {
  signal?: AbortSignal;
  _meta?: {
    progressToken?: string | number;
  };
}

/**
 * Create a progress reporter from request extra
 *
 * @param server - MCP Server instance (can be null for testing)
 * @param extra - Request handler extra data
 * @returns ProgressReporter (may be disabled if no token)
 */
export function createProgressReporter(
  server: McpServer | null,
  extra?: ToolHandlerExtra
): ProgressReporter {
  return new ProgressReporter(server, extra?._meta?.progressToken);
}

/**
 * Batch processor with progress reporting
 *
 * Processes items in sequence and reports progress at specified intervals.
 * Supports cancellation via AbortSignal.
 *
 * @param items - Items to process
 * @param processor - Async function to process each item
 * @param reporter - Progress reporter
 * @param options - Processing options
 * @returns Processed results
 * @throws CancellationError if cancelled during processing
 */
export async function processWithProgress<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  reporter: ProgressReporter,
  options: {
    /** Report every N items (default: 1) */
    reportInterval?: number;
    /** Message generator */
    messageGenerator?: (index: number, total: number, item: T) => string;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
  } = {}
): Promise<R[]> {
  const {
    reportInterval = 1,
    messageGenerator = (i, t) => `Processing ${i + 1}/${t}...`,
    signal,
  } = options;

  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    // Check cancellation
    if (signal?.aborted) {
      throw new CancellationError(
        typeof signal.reason === "string" ? signal.reason : "Operation cancelled"
      );
    }

    // Process item
    const result = await processor(items[i] as T, i);
    results.push(result);

    // Report progress at intervals
    if ((i + 1) % reportInterval === 0 || i === items.length - 1) {
      await reporter.reportPercentage(i, total, messageGenerator(i, total, items[i] as T));
    }
  }

  return results;
}
