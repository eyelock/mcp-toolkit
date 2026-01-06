/**
 * Pagination Utilities
 *
 * Implements MCP specification cursor-based pagination.
 * Provides utilities for encoding/decoding opaque cursors and paginating results.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
 */

/**
 * Pagination cursor structure (internal - clients must treat as opaque)
 */
interface PaginationCursor {
  /** Zero-based offset into the result set */
  offset: number;
  /** Page size used for this cursor */
  pageSize: number;
}

/**
 * Default page size for paginated results
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Encode a pagination cursor to an opaque string
 *
 * Uses base64 encoding to create an opaque cursor token.
 * Clients MUST NOT parse or make assumptions about cursor format.
 *
 * @param cursor - Cursor structure to encode
 * @returns Opaque cursor string
 */
export function encodeCursor(cursor: PaginationCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json).toString("base64");
}

/**
 * Decode a pagination cursor from an opaque string
 *
 * @param cursorString - Opaque cursor string from client
 * @returns Decoded cursor structure
 * @throws {InvalidCursorError} If cursor is invalid
 */
export function decodeCursor(cursorString: string): PaginationCursor {
  try {
    const json = Buffer.from(cursorString, "base64").toString("utf-8");
    const cursor = JSON.parse(json) as PaginationCursor;

    // Validate cursor structure
    if (typeof cursor.offset !== "number" || typeof cursor.pageSize !== "number") {
      throw new Error("Invalid cursor structure");
    }

    if (cursor.offset < 0 || cursor.pageSize <= 0) {
      throw new Error("Invalid cursor values");
    }

    return cursor;
  } catch (error) {
    throw new InvalidCursorError(
      `Invalid cursor: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Result of paginating an array
 */
export interface PaginatedResult<T> {
  /** Items for the current page */
  items: T[];
  /** Cursor for the next page (undefined if no more results) */
  nextCursor?: string;
  /** Total number of items (optional, for informational purposes) */
  total?: number;
}

/**
 * Options for pagination
 */
export interface PaginateOptions {
  /** Number of items per page (default: 100) */
  pageSize?: number;
  /** Include total count in result */
  includeTotal?: boolean;
}

/**
 * Paginate an array of results using cursor-based pagination
 *
 * Implements MCP specification for cursor-based pagination:
 * - Returns a page of results with optional nextCursor
 * - Cursors are opaque base64-encoded tokens
 * - Missing nextCursor signals end of results
 *
 * @param items - Full array of items to paginate
 * @param cursor - Optional cursor from previous page
 * @param options - Pagination options
 * @returns Paginated results with optional nextCursor
 *
 * @example
 * ```typescript
 * // First page
 * const page1 = paginateResults(allItems);
 * console.log(page1.items); // First 100 items
 *
 * // Next page using cursor
 * if (page1.nextCursor) {
 *   const page2 = paginateResults(allItems, page1.nextCursor);
 * }
 *
 * // Custom page size
 * const smallPage = paginateResults(allItems, undefined, { pageSize: 10 });
 * ```
 */
export function paginateResults<T>(
  items: T[],
  cursor?: string,
  options?: PaginateOptions
): PaginatedResult<T> {
  const includeTotal = options?.includeTotal ?? false;

  // Decode cursor or start from beginning
  // If cursor exists, use its pageSize to maintain consistency across pages
  const decodedCursor = cursor ? decodeCursor(cursor) : null;
  const offset = decodedCursor?.offset ?? 0;
  const pageSize = decodedCursor?.pageSize ?? options?.pageSize ?? DEFAULT_PAGE_SIZE;

  // Slice the page
  const page = items.slice(offset, offset + pageSize);

  // Check if there are more results
  const hasMore = offset + pageSize < items.length;

  const result: PaginatedResult<T> = {
    items: page,
    nextCursor: hasMore ? encodeCursor({ offset: offset + pageSize, pageSize }) : undefined,
  };

  if (includeTotal) {
    result.total = items.length;
  }

  return result;
}

/**
 * Create a paginated response for MCP resources
 *
 * Helper for creating properly formatted paginated resource responses.
 *
 * @param nextCursor - Cursor for next page (if any)
 * @returns Object suitable for spreading into resource response
 *
 * @example
 * ```typescript
 * const { items, nextCursor } = paginateResults(allNotes, params.cursor);
 * return {
 *   contents: [{
 *     uri: uri.toString(),
 *     mimeType: "application/json",
 *     text: JSON.stringify(items, null, 2)
 *   }],
 *   ...createPaginatedResponse(nextCursor)
 * };
 * ```
 */
export function createPaginatedResponse(nextCursor?: string): { nextCursor?: string } {
  return nextCursor ? { nextCursor } : {};
}

/**
 * Error thrown when cursor is invalid
 */
export class InvalidCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCursorError";
  }
}
