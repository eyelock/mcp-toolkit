import { SessionConfigSchema } from "@mcp-toolkit/model";
import { beforeEach, describe, expect, it, vi } from "vitest";
// Test index.ts re-exports
import * as StorageExports from "./index.js";
import { MemoryProvider, createMemoryProvider } from "./memory.js";

describe("MemoryProvider", () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = new MemoryProvider();
  });

  describe("initSession", () => {
    it("creates a session with defaults", async () => {
      const result = await provider.initSession({
        projectName: "test-project",
      });

      expect(result.success).toBe(true);
      expect(result.data?.projectName).toBe("test-project");
      expect(result.data?.features.tools).toBe(true);
      expect(result.data?.features.resources).toBe(true);
      expect(result.data?.features.prompts).toBe(false);
      expect(result.data?.features.sampling).toBe(false);
    });

    it("allows overriding feature defaults", async () => {
      const result = await provider.initSession({
        projectName: "test-project",
        features: { prompts: true, tools: false },
      });

      expect(result.success).toBe(true);
      expect(result.data?.features.tools).toBe(false);
      expect(result.data?.features.prompts).toBe(true);
    });

    it("sets timestamps", async () => {
      const result = await provider.initSession({
        projectName: "test-project",
      });

      expect(result.data?.createdAt).toBeDefined();
      expect(result.data?.updatedAt).toBeDefined();
    });

    it("rejects invalid project names", async () => {
      const result = await provider.initSession({
        projectName: "Invalid Name",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

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
  });

  describe("getSession", () => {
    it("returns null when no session exists", async () => {
      const result = await provider.getSession();
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns the session after init", async () => {
      await provider.initSession({ projectName: "test-project" });
      const result = await provider.getSession();

      expect(result.success).toBe(true);
      expect(result.data?.projectName).toBe("test-project");
    });
  });

  describe("updateSession", () => {
    it("fails when no session exists", async () => {
      const result = await provider.updateSession({
        projectName: "new-name",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No session to update");
    });

    it("updates project name", async () => {
      await provider.initSession({ projectName: "old-name" });
      const result = await provider.updateSession({
        projectName: "new-name",
      });

      expect(result.success).toBe(true);
      expect(result.data?.projectName).toBe("new-name");
    });

    it("merges feature updates", async () => {
      await provider.initSession({
        projectName: "test-project",
        features: { tools: true, prompts: false },
      });

      const result = await provider.updateSession({
        features: { prompts: true },
      });

      expect(result.success).toBe(true);
      expect(result.data?.features.tools).toBe(true); // Preserved
      expect(result.data?.features.prompts).toBe(true); // Updated
    });

    it("updates the updatedAt timestamp", async () => {
      await provider.initSession({ projectName: "test-project" });
      const session1 = await provider.getSession();
      const originalUpdatedAt = session1.data?.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));

      await provider.updateSession({ projectName: "new-name" });
      const session2 = await provider.getSession();

      expect(session2.data?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it("returns error for invalid updates", async () => {
      await provider.initSession({ projectName: "test-project" });
      const result = await provider.updateSession({
        projectName: "Invalid Name With Spaces",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("handles non-Error throws in updateSession", async () => {
      await provider.initSession({ projectName: "test-project" });

      const spy = vi.spyOn(SessionConfigSchema, "parse").mockImplementation(() => {
        throw "string error"; // Non-Error throw
      });

      const result = await provider.updateSession({
        projectName: "new-name",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update session");
      spy.mockRestore();
    });
  });

  describe("clearSession", () => {
    it("clears the session", async () => {
      await provider.initSession({ projectName: "test-project" });
      expect(await provider.hasSession()).toBe(true);

      await provider.clearSession();
      expect(await provider.hasSession()).toBe(false);
    });
  });

  describe("hasSession", () => {
    it("returns false initially", async () => {
      expect(await provider.hasSession()).toBe(false);
    });

    it("returns true after init", async () => {
      await provider.initSession({ projectName: "test-project" });
      expect(await provider.hasSession()).toBe(true);
    });
  });
});

describe("createMemoryProvider", () => {
  it("creates a new provider instance", () => {
    const provider = createMemoryProvider();
    expect(provider.name).toBe("memory");
  });
});

describe("storage exports", () => {
  it("re-exports all storage exports", () => {
    expect(StorageExports.MemoryProvider).toBeDefined();
    expect(StorageExports.createMemoryProvider).toBeDefined();
  });
});
