/**
 * Provider Interface - Contract for pluggable storage backends
 *
 * This interface defines the contract that all providers must implement.
 * The pattern allows swapping storage implementations without changing
 * business logic.
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

/**
 * Provider interface for session storage
 *
 * Implementations:
 * - MemoryProvider: In-memory storage (default, no external deps)
 * - FileProvider: File-based storage (optional)
 * - Custom: Implement this interface for your own storage
 */
export interface SessionProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Initialize a new session
   */
  initSession(input: SessionInitInput): Promise<ProviderResult<SessionConfig>>;

  /**
   * Get the current session configuration
   */
  getSession(): Promise<ProviderResult<SessionConfig | null>>;

  /**
   * Update the current session
   */
  updateSession(input: SessionUpdateInput): Promise<ProviderResult<SessionConfig>>;

  /**
   * Clear the current session
   */
  clearSession(): Promise<ProviderResult<void>>;

  /**
   * Check if a session exists
   */
  hasSession(): Promise<boolean>;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = () => SessionProvider;
