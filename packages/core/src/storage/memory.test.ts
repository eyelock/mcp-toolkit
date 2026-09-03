/**
 * MemoryProvider specifics.
 *
 * Behaviour shared by every provider lives in the conformance suite
 * (`conformance.test.ts`); this file covers only what is particular to the
 * in-memory backend and to error handling that a fake cannot reach.
 */

import { SessionConfigSchema } from "@mcp-toolkit/model";
import { beforeEach, describe, expect, it, vi } from "vitest";
// Test index.ts re-exports
import * as StorageExports from "./index.js";
import { createMemoryProvider, MemoryProvider } from "./memory.js";

describe("MemoryProvider", () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = new MemoryProvider();
  });

  describe("error normalisation", () => {
    it("handles non-Error throws in initSession", async () => {
      const spy = vi.spyOn(SessionConfigSchema, "parse").mockImplementation(() => {
        throw "string error"; // Non-Error throw
      });

      const result = await provider.initSession({
        projectName: "test-project",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to initialize session");
      spy.mockRestore();
    });

    it("handles non-Error throws in updateSession", async () => {
      const created = await provider.initSession({ projectName: "test-project" });

      const spy = vi.spyOn(SessionConfigSchema, "parse").mockImplementation(() => {
        throw "string error"; // Non-Error throw
      });

      const result = await provider.updateSession(created.data?.sessionId ?? "", {
        projectName: "new-name",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update session");
      spy.mockRestore();
    });
  });

  describe("isolation between instances", () => {
    // The documented caveat, pinned as a test: memory does not cross processes,
    // and it does not cross provider instances either.
    it("does not share sessions with another provider instance", async () => {
      const created = await provider.initSession({ projectName: "test-project" });
      const other = new MemoryProvider();

      expect(await other.hasSession(created.data?.sessionId ?? "")).toBe(false);
    });
  });
});

describe("createMemoryProvider", () => {
  it("creates a new provider instance", () => {
    const provider = createMemoryProvider();
    expect(provider.name).toBe("memory");
  });

  it("accepts a ttl", () => {
    const provider = createMemoryProvider({ ttlMs: 1000 });
    expect(provider.name).toBe("memory");
  });
});

describe("storage exports", () => {
  it("re-exports all storage exports", () => {
    expect(StorageExports.MemoryProvider).toBeDefined();
    expect(StorageExports.createMemoryProvider).toBeDefined();
    expect(StorageExports.FileProvider).toBeDefined();
    expect(StorageExports.createFileProvider).toBeDefined();
    expect(StorageExports.RedisProvider).toBeDefined();
    expect(StorageExports.createRedisProvider).toBeDefined();
  });
});
