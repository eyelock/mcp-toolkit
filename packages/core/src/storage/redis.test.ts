/**
 * RedisProvider specifics.
 *
 * Shared behaviour is covered by the conformance suite; this file covers key
 * namespacing, TTL delegation and the two client adapters.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRedisProvider,
  DEFAULT_KEY_PREFIX,
  fromIoRedis,
  fromNodeRedis,
  type RedisLikeClient,
  RedisProvider,
} from "./redis.js";

function createFakeRedis(): RedisLikeClient & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    del: async (key) => {
      store.delete(key);
    },
  };
}

describe("RedisProvider", () => {
  let client: ReturnType<typeof createFakeRedis>;
  let provider: RedisProvider;

  beforeEach(() => {
    client = createFakeRedis();
    provider = new RedisProvider({ client });
  });

  describe("key namespacing", () => {
    it("prefixes keys by default", async () => {
      const created = await provider.initSession({ projectName: "test-project" });

      expect([...client.store.keys()]).toEqual([`${DEFAULT_KEY_PREFIX}${created.data?.sessionId}`]);
    });

    it("honours a custom prefix", async () => {
      const custom = new RedisProvider({ client, keyPrefix: "myapp:" });
      const created = await custom.initSession({ projectName: "test-project" });

      expect([...client.store.keys()]).toEqual([`myapp:${created.data?.sessionId}`]);
    });

    it("does not collide across prefixes", async () => {
      const a = new RedisProvider({ client, keyPrefix: "a:" });
      const b = new RedisProvider({ client, keyPrefix: "b:" });

      const created = await a.initSession({ projectName: "alpha" }, "same-id");

      expect(await b.hasSession(created.data?.sessionId ?? "")).toBe(false);
    });
  });

  describe("ttl delegation", () => {
    it("passes pxMs to the client when a ttl is configured", async () => {
      const set = vi.spyOn(client, "set");
      const expiring = new RedisProvider({ client, ttlMs: 5000 });

      await expiring.initSession({ projectName: "test-project" });

      expect(set).toHaveBeenCalledWith(expect.any(String), expect.any(String), { pxMs: 5000 });
    });

    it("omits options when no ttl is configured", async () => {
      const set = vi.spyOn(client, "set");

      await provider.initSession({ projectName: "test-project" });

      expect(set).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined);
    });
  });

  describe("corrupt payloads", () => {
    it("treats unparseable JSON as no session and deletes the key", async () => {
      const created = await provider.initSession({ projectName: "test-project" });
      const sessionId = created.data?.sessionId ?? "";
      client.store.set(`${DEFAULT_KEY_PREFIX}${sessionId}`, "{not json");

      const read = await provider.getSession(sessionId);

      expect(read.success).toBe(true);
      expect(read.data).toBeNull();
      expect(client.store.size).toBe(0);
    });
  });

  describe("client failures", () => {
    it("surfaces a read failure as an error result", async () => {
      const failing: RedisLikeClient = {
        get: async () => {
          throw new Error("connection refused");
        },
        set: async () => undefined,
        del: async () => undefined,
      };

      const result = await new RedisProvider({ client: failing }).getSession("abc");

      expect(result.success).toBe(false);
      expect(result.error).toBe("connection refused");
    });

    it("reports false from hasSession when the client fails", async () => {
      const failing: RedisLikeClient = {
        get: async () => {
          throw new Error("connection refused");
        },
        set: async () => undefined,
        del: async () => undefined,
      };

      expect(await new RedisProvider({ client: failing }).hasSession("abc")).toBe(false);
    });
  });

  describe("createRedisProvider", () => {
    it("creates a provider", () => {
      expect(createRedisProvider({ client }).name).toBe("redis");
    });
  });
});

describe("client adapters", () => {
  describe("fromNodeRedis", () => {
    it("maps a ttl to the PX option object", async () => {
      const set = vi.fn().mockResolvedValue("OK");
      const adapted = fromNodeRedis({ get: vi.fn(), set, del: vi.fn() });

      await adapted.set("k", "v", { pxMs: 1000 });

      expect(set).toHaveBeenCalledWith("k", "v", { PX: 1000 });
    });

    it("omits options when there is no ttl", async () => {
      const set = vi.fn().mockResolvedValue("OK");
      const adapted = fromNodeRedis({ get: vi.fn(), set, del: vi.fn() });

      await adapted.set("k", "v");

      expect(set).toHaveBeenCalledWith("k", "v");
    });

    it("passes get and del straight through", async () => {
      const get = vi.fn().mockResolvedValue("value");
      const del = vi.fn().mockResolvedValue(1);
      const adapted = fromNodeRedis({ get, set: vi.fn(), del });

      expect(await adapted.get("k")).toBe("value");
      await adapted.del("k");
      expect(del).toHaveBeenCalledWith("k");
    });
  });

  describe("fromIoRedis", () => {
    it("maps a ttl to positional PX arguments", async () => {
      const set = vi.fn().mockResolvedValue("OK");
      const adapted = fromIoRedis({ get: vi.fn(), set, del: vi.fn() });

      await adapted.set("k", "v", { pxMs: 1000 });

      expect(set).toHaveBeenCalledWith("k", "v", "PX", 1000);
    });

    it("omits arguments when there is no ttl", async () => {
      const set = vi.fn().mockResolvedValue("OK");
      const adapted = fromIoRedis({ get: vi.fn(), set, del: vi.fn() });

      await adapted.set("k", "v");

      expect(set).toHaveBeenCalledWith("k", "v");
    });
  });
});
