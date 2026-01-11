/**
 * Cancellation Utilities
 *
 * Provides helpers for checking cancellation status during long-running operations.
 * The MCP SDK automatically sets up AbortController handling for requests - these
 * utilities help tool handlers respond to cancellation signals.
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/cancellation
 */

/**
 * Error thrown when an operation is cancelled
 */
export class CancellationError extends Error {
  constructor(reason?: string) {
    super(reason ?? "Operation was cancelled");
    this.name = "CancellationError";
  }
}

/**
 * Check if the operation has been cancelled and throw if so
 *
 * Call this at checkpoints during long operations.
 *
 * @param signal - AbortSignal from request extra
 * @throws CancellationError if cancelled
 *
 * @example
 * ```typescript
 * for (const item of items) {
 *   checkCancelled(extra.signal);
 *   await processItem(item);
 * }
 * ```
 */
export function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CancellationError(typeof signal.reason === "string" ? signal.reason : undefined);
  }
}

/**
 * Check if cancelled (non-throwing version)
 *
 * @param signal - AbortSignal from request extra
 * @returns true if cancelled
 */
export function isCancelled(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

/**
 * Create an AbortController that also aborts when the parent signal aborts
 *
 * Useful for child operations that need their own abort capability.
 *
 * @param parentSignal - Parent AbortSignal to link to
 * @returns Linked AbortController
 *
 * @example
 * ```typescript
 * const linked = createLinkedAbortController(extra.signal);
 * const result = await fetch(url, { signal: linked.signal });
 * ```
 */
export function createLinkedAbortController(parentSignal?: AbortSignal): AbortController {
  const controller = new AbortController();

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener(
        "abort",
        () => {
          controller.abort(parentSignal.reason);
        },
        { once: true }
      );
    }
  }

  return controller;
}

/**
 * Run an async operation with cancellation support
 *
 * Checks for cancellation before and after the operation.
 *
 * @param signal - AbortSignal to monitor
 * @param operation - Async operation to run
 * @returns Operation result
 * @throws CancellationError if cancelled during operation
 *
 * @example
 * ```typescript
 * const result = await withCancellation(extra.signal, async () => {
 *   return await longRunningOperation();
 * });
 * ```
 */
export async function withCancellation<T>(
  signal: AbortSignal | undefined,
  operation: () => Promise<T>
): Promise<T> {
  checkCancelled(signal);

  const result = await operation();

  checkCancelled(signal);

  return result;
}
