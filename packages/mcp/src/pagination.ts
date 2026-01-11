/**
 * Pagination Utilities
 *
 * @deprecated Import from "@mcp-toolkit/mcp/spec" instead.
 * This re-exports for backward compatibility.
 */

export {
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  decodeCursor,
  type PaginatedResult,
  type PaginateOptions,
  paginateResults,
  createPaginatedResponse,
  InvalidCursorError,
} from "./spec/pagination.js";
