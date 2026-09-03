/**
 * Redis Provider - session storage shared across hosts
 *
 * The production option: many server instances, on many machines, resolving the
 * same handles. This is what the stateless protocol is for - requests can be
 * round-robined because no instance owns any session.
 *
 * ## Why the client is injected
 *
 * `@mcp-toolkit/core` has no runtime dependencies and that is worth keeping, so
 * this provider does not import a Redis library. You pass one in, adapted to the
 * small structural interface below. Two adapters ship for the common clients.
 *
 * ```typescript
 * import { createClient } from "redis";
 * import { createRedisProvider, fromNodeRedis } from "@mcp-toolkit/core";
 *
 * const client = createClient({ url: process.env.REDIS_URL });
 * await client.connect();
 *
 * const provider = createRedisProvider({
 *   client: fromNodeRedis(client),
 *   ttlMs: 24 * 60 * 60 * 1000,
 * });
 * ```
 *
 * Expiry is delegated to Redis itself via `PX`, so eviction costs nothing and
 * there is no sweep to run.
 */

import type { SessionConfig, SessionCreateInput, SessionUpdateInput } from "@mcp-toolkit/model";
import {
  applySessionUpdate,
  buildSessionConfig,
  type SessionRecord,
  toErrorMessage,
} from "./config.js";
import type { ProviderOptions, ProviderResult, SessionProvider } from "./interface.js";

/**
 * The minimum a client must do to back this provider.
 *
 * Deliberately tiny and library-agnostic - anything with these three operations
 * works, including a test double.
 */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  /** Set a key, expiring it after `pxMs` milliseconds when supplied */
  set(key: string, value: string, options?: { pxMs?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/** Shape of the `redis` (node-redis v4+) client this adapter needs */
interface NodeRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { PX?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/** Shape of the `ioredis` client this adapter needs */
interface IoRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttl: number): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/**
 * Adapt a `redis` (node-redis v4+) client, which takes options as an object.
 */
export function fromNodeRedis(client: NodeRedisClient): RedisLikeClient {
  return {
    get: (key) => client.get(key),
    set: (key, value, options) =>
      options?.pxMs === undefined
        ? client.set(key, value)
        : client.set(key, value, { PX: options.pxMs }),
    del: (key) => client.del(key),
  };
}

/**
 * Adapt an `ioredis` client, which takes options as positional arguments.
 */
export function fromIoRedis(client: IoRedisClient): RedisLikeClient {
  return {
    get: (key) => client.get(key),
    set: (key, value, options) =>
      options?.pxMs === undefined
        ? client.set(key, value)
        : client.set(key, value, "PX", options.pxMs),
    del: (key) => client.del(key),
  };
}

/** Default key prefix, so sessions are namespaced within a shared Redis */
export const DEFAULT_KEY_PREFIX = "mcp-toolkit:session:";

export interface RedisProviderOptions extends ProviderOptions {
  /** Redis client, adapted to `RedisLikeClient` */
  client: RedisLikeClient;
  /** Key prefix (default: `mcp-toolkit:session:`) */
  keyPrefix?: string;
}

export class RedisProvider implements SessionProvider {
  readonly name = "redis";
  private readonly client: RedisLikeClient;
  private readonly keyPrefix: string;
  private readonly ttlMs?: number;

  constructor(options: RedisProviderOptions) {
    this.client = options.client;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlMs = options.ttlMs;
  }

  private keyFor(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  private async write(config: SessionConfig): Promise<void> {
    // expiresAt stays null: Redis owns expiry via PX, so duplicating the stamp
    // in the payload would just be a second source of truth to drift.
    const record: SessionRecord = { config, expiresAt: null };
    await this.client.set(
      this.keyFor(config.sessionId),
      JSON.stringify(record),
      this.ttlMs === undefined ? undefined : { pxMs: this.ttlMs }
    );
  }

  private async read(sessionId: string): Promise<SessionRecord | null> {
    const raw = await this.client.get(this.keyFor(sessionId));
    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionRecord;
    } catch {
      // Corrupt payload is indistinguishable from no session, and keeping it
      // would poison every future read.
      await this.client.del(this.keyFor(sessionId));
      return null;
    }
  }

  async initSession(
    input: SessionCreateInput,
    sessionId?: string
  ): Promise<ProviderResult<SessionConfig>> {
    try {
      const config = buildSessionConfig(input, sessionId);
      await this.write(config);
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to initialize session"),
      };
    }
  }

  async getSession(sessionId: string): Promise<ProviderResult<SessionConfig | null>> {
    try {
      const record = await this.read(sessionId);
      return { success: true, data: record?.config ?? null };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to read session"),
      };
    }
  }

  async updateSession(
    sessionId: string,
    input: SessionUpdateInput
  ): Promise<ProviderResult<SessionConfig>> {
    try {
      const record = await this.read(sessionId);
      if (!record) {
        return { success: false, error: "No session to update" };
      }

      const updated = applySessionUpdate(record.config, input);
      await this.write(updated);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to update session"),
      };
    }
  }

  async clearSession(sessionId: string): Promise<ProviderResult<void>> {
    try {
      await this.client.del(this.keyFor(sessionId));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to clear session"),
      };
    }
  }

  async hasSession(sessionId: string): Promise<boolean> {
    try {
      return (await this.read(sessionId)) !== null;
    } catch {
      return false;
    }
  }
}

/**
 * Factory function for creating a Redis provider
 */
export function createRedisProvider(options: RedisProviderOptions): SessionProvider {
  return new RedisProvider(options);
}
