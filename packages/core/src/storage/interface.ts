/**
 * Storage Interface - Contract for pluggable storage backends
 *
 * This module uses the Consumer/Publisher pattern for session management:
 * - SessionConsumer: Reads/queries session data
 * - SessionPublisher: Writes/publishes session data
 * - SessionProvider: Combined interface (implements both)
 *
 * This allows components to depend only on the capability they need.
 *
 * ## Sessions are addressed by handle
 *
 * Every read and mutate operation takes an explicit `sessionId`. This is what
 * makes a provider usable from more than one server instance: the id travels in
 * the request payload, so any instance can resolve the session from shared
 * storage rather than from its own memory.
 *
 * MCP's `2026-07-28` revision removed protocol-managed sessions (no
 * `initialize` handshake, no `Mcp-Session-Id` header) precisely so servers could
 * be load-balanced without sticky routing. Application state is still allowed -
 * it just has to be addressed explicitly. That is what this interface models.
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28
 */

import type { SessionConfig, SessionCreateInput, SessionUpdateInput } from "@mcp-toolkit/model";

/**
 * Result type for provider operations
 */
export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Options common to provider construction
 */
export interface ProviderOptions {
  /**
   * How long a session survives after its last write, in milliseconds.
   *
   * Shared stores need eviction or they grow without bound. Expiry is a storage
   * concern, so it is tracked in the storage envelope rather than on
   * `SessionConfig` - the domain model stays clean.
   *
   * Omit for no expiry.
   */
  ttlMs?: number;
}

// =============================================================================
// Consumer Interface
// =============================================================================

/**
 * Session consumer interface - reads/queries session data
 *
 * Use this interface when you only need to read session state.
 * This supports the principle of least privilege - components
 * that only read should not have write access.
 */
export interface SessionConsumer {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Get a session by its handle.
   *
   * Returns `data: null` when the session is unknown or has expired - an
   * unknown handle is a normal outcome, not an error.
   */
  getSession(sessionId: string): Promise<ProviderResult<SessionConfig | null>>;

  /**
   * Check whether a session exists and has not expired
   */
  hasSession(sessionId: string): Promise<boolean>;
}

// =============================================================================
// Publisher Interface
// =============================================================================

/**
 * Session publisher interface - writes/publishes session data
 *
 * Use this interface when you need to modify session state.
 * Components that publish changes should implement event-driven
 * patterns where appropriate.
 */
export interface SessionPublisher {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Initialize a new session.
   *
   * The provider mints the handle unless the caller supplies one, and returns it
   * on the resulting `SessionConfig`. Callers that already hold an id for the
   * request (an MCP server threading one through) pass it in; callers that do
   * not (the CLI, tests) let the provider generate it.
   *
   * @param input - Session configuration
   * @param sessionId - Optional pre-minted handle; generated when omitted
   */
  initSession(
    input: SessionCreateInput,
    sessionId?: string
  ): Promise<ProviderResult<SessionConfig>>;

  /**
   * Update an existing session, addressed by handle
   */
  updateSession(
    sessionId: string,
    input: SessionUpdateInput
  ): Promise<ProviderResult<SessionConfig>>;

  /**
   * Clear a session, addressed by handle.
   *
   * Clearing an unknown session succeeds - the operation is idempotent.
   */
  clearSession(sessionId: string): Promise<ProviderResult<void>>;
}

// =============================================================================
// Combined Provider Interface
// =============================================================================

/**
 * Session provider interface - combined consumer and publisher
 *
 * Implementations:
 * - MemoryProvider: In-memory storage (default, zero dependencies).
 *   Correct for stdio; single-instance only over HTTP.
 * - FileProvider: JSON files on disk. Shared across processes on one host.
 * - RedisProvider: Shared across hosts. The production option.
 * - Custom: Implement this interface for your own storage backend.
 *
 * Providers implement both consumer and publisher capabilities.
 * Components can depend on just SessionConsumer or SessionPublisher
 * if they don't need both.
 *
 * Every implementation must pass the shared conformance suite exported from
 * `@mcp-toolkit/core/testing` - see `runProviderConformanceTests`.
 */
export interface SessionProvider extends SessionConsumer, SessionPublisher {}

/**
 * Provider factory function type
 */
export type ProviderFactory = () => SessionProvider;
