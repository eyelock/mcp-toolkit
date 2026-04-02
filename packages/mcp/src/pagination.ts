/**
 * Pagination Utilities
 *
 * @deprecated Import from "@mcp-toolkit/mcp/spec" instead.
 * This re-exports for backward compatibility.
 */

export {
  createPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  type PaginatedResult,
  type PaginateOptions,
  paginateResults,
} from "./spec/pagination.js";
