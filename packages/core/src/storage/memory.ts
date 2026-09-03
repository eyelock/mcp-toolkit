/**
 * In-Memory Provider - Reference implementation with no external dependencies
 *
 * This provider stores session data in memory. Useful for:
 * - Development and testing
 * - stdio servers, where one process genuinely owns the conversation
 * - As a reference for implementing custom providers
 *
 * ## Deployment caveat
 *
 * Sessions live in *this process's* heap. That is correct for stdio, and
 * single-instance only over HTTP: put two replicas behind a load balancer and a
 * handle minted by one is unknown to the other. Use `FileProvider` (one host) or
 * `RedisProvider` (many hosts) for anything multi-instance.
 */

import type { SessionConfig, SessionCreateInput, SessionUpdateInput } from "@mcp-toolkit/model";
import {
  applySessionUpdate,
  buildSessionConfig,
  computeExpiry,
  isExpired,
  type SessionRecord,
  toErrorMessage,
} from "./config.js";
import type { ProviderOptions, ProviderResult, SessionProvider } from "./interface.js";

export class MemoryProvider implements SessionProvider {
  readonly name = "memory";
  private sessions = new Map<string, SessionRecord>();
  private readonly ttlMs?: number;

  constructor(options: ProviderOptions = {}) {
    this.ttlMs = options.ttlMs;
  }

  /**
   * Read a live record, evicting it if it has expired.
   *
   * Expiry is swept on read rather than on a timer: no background work means
   * nothing to leak, and nothing that misbehaves in a serverless runtime.
   */
  private read(sessionId: string): SessionRecord | null {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return null;
    }
    if (isExpired(record)) {
      this.sessions.delete(sessionId);
      return null;
    }
    return record;
  }

  async initSession(
    input: SessionCreateInput,
    sessionId?: string
  ): Promise<ProviderResult<SessionConfig>> {
    try {
      const config = buildSessionConfig(input, sessionId);
      this.sessions.set(config.sessionId, {
        config,
        expiresAt: computeExpiry(this.ttlMs),
      });
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to initialize session"),
      };
    }
  }

  async getSession(sessionId: string): Promise<ProviderResult<SessionConfig | null>> {
    return { success: true, data: this.read(sessionId)?.config ?? null };
  }

  async updateSession(
    sessionId: string,
    input: SessionUpdateInput
  ): Promise<ProviderResult<SessionConfig>> {
    const record = this.read(sessionId);
    if (!record) {
      return { success: false, error: "No session to update" };
    }

    try {
      const updated = applySessionUpdate(record.config, input);
      this.sessions.set(sessionId, {
        config: updated,
        expiresAt: computeExpiry(this.ttlMs),
      });
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to update session"),
      };
    }
  }

  async clearSession(sessionId: string): Promise<ProviderResult<void>> {
    this.sessions.delete(sessionId);
    return { success: true };
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return this.read(sessionId) !== null;
  }
}

/**
 * Factory function for creating a memory provider
 */
export function createMemoryProvider(options: ProviderOptions = {}): SessionProvider {
  return new MemoryProvider(options);
}
