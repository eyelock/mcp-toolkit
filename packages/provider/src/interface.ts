/**
 * Provider Interface - Contract for pluggable storage backends
 *
 * This module uses the Consumer/Publisher pattern for session management:
 * - SessionConsumer: Reads/queries session data
 * - SessionPublisher: Writes/publishes session data
 * - SessionProvider: Combined interface (implements both)
 *
 * This allows components to depend only on the capability they need.
 */

import type { SessionConfig, SessionInitInput, SessionUpdateInput } from "@mcp-toolkit/model";

/**
 * Result type for provider operations
 */
export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: string;
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
   * Get the current session configuration
   */
  getSession(): Promise<ProviderResult<SessionConfig | null>>;

  /**
   * Check if a session exists
   */
  hasSession(): Promise<boolean>;
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
   * Initialize a new session
   */
  initSession(input: SessionInitInput): Promise<ProviderResult<SessionConfig>>;

  /**
   * Update the current session
   */
  updateSession(input: SessionUpdateInput): Promise<ProviderResult<SessionConfig>>;

  /**
   * Clear the current session
   */
  clearSession(): Promise<ProviderResult<void>>;
}

// =============================================================================
// Combined Provider Interface
// =============================================================================

/**
 * Session provider interface - combined consumer and publisher
 *
 * Implementations:
 * - MemoryProvider: In-memory storage (default, no external deps)
 * - FileProvider: File-based storage (optional)
 * - Custom: Implement this interface for your own storage
 *
 * Providers implement both consumer and publisher capabilities.
 * Components can depend on just SessionConsumer or SessionPublisher
 * if they don't need both.
 */
export interface SessionProvider extends SessionConsumer, SessionPublisher {}

/**
 * Provider factory function type
 */
export type ProviderFactory = () => SessionProvider;
