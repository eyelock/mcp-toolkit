/**
 * Every shipped provider runs the same conformance suite.
 *
 * This is the point of the suite: a backend swap cannot quietly change
 * behaviour, because all three are held to one contract.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProviderConformanceTests } from "./conformance.js";
import { createFileProvider } from "./file.js";
import { createMemoryProvider } from "./memory.js";
import { createRedisProvider, type RedisLikeClient } from "./redis.js";

// =============================================================================
// Memory
// =============================================================================

runProviderConformanceTests("MemoryProvider", {
  createProvider: () => createMemoryProvider(),
  createExpiringProvider: (ttlMs) => createMemoryProvider({ ttlMs }),
});

// =============================================================================
// File
// =============================================================================

let fileDir: string | null = null;

runProviderConformanceTests("FileProvider", {
  createProvider: async () => {
    fileDir = await mkdtemp(join(tmpdir(), "mcp-toolkit-conformance-"));
    return createFileProvider({ directory: fileDir });
  },
  createExpiringProvider: async (ttlMs) => {
    fileDir = await mkdtemp(join(tmpdir(), "mcp-toolkit-conformance-"));
    return createFileProvider({ directory: fileDir, ttlMs });
  },
  cleanup: async () => {
    if (fileDir) {
      await rm(fileDir, { recursive: true, force: true });
      fileDir = null;
    }
  },
});

// =============================================================================
// Redis
// =============================================================================

/**
 * In-process stand-in for Redis.
 *
 * Exercises the provider's serialisation and key handling without a server.
 * TTL is intentionally not simulated - real expiry belongs to Redis, so the
 * suite skips those cases rather than testing a fake implementation of them.
 */
function createFakeRedis(): RedisLikeClient {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    del: async (key) => {
      store.delete(key);
    },
  };
}

runProviderConformanceTests("RedisProvider", {
  createProvider: () => createRedisProvider({ client: createFakeRedis() }),
});
