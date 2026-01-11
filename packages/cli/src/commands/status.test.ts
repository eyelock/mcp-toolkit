import * as providerModule from "@mcp-toolkit/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Status from "./status.js";

// Mock the provider module
vi.mock("@mcp-toolkit/storage", async (importOriginal) => {
  const original = await importOriginal<typeof providerModule>();
  return {
    ...original,
    createMemoryProvider: vi.fn(() => original.createMemoryProvider()),
  };
});

describe("Status command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset to real implementation by default
    vi.mocked(providerModule.createMemoryProvider).mockImplementation(
      () => new providerModule.MemoryProvider()
    );
    logSpy = vi.spyOn(Status.prototype, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when no session exists", () => {
    it("displays no session message", async () => {
      await Status.run([]);

      expect(logSpy).toHaveBeenCalledWith("No active session.");
      expect(logSpy).toHaveBeenCalledWith(
        "Run 'mcp-toolkit-cli init <project-name>' to create one."
      );
    });

    it("outputs JSON error when --json flag is used", async () => {
      await Status.run(["--json"]);

      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ error: "No active session" }, null, 2));
    });
  });

  describe("when session exists", () => {
    beforeEach(() => {
      const mockSession = {
        projectName: "test-project",
        features: { tools: true, resources: true, prompts: false, sampling: false },
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      vi.mocked(providerModule.createMemoryProvider).mockReturnValue({
        name: "memory",
        hasSession: vi.fn().mockResolvedValue(true),
        getSession: vi.fn().mockResolvedValue({ success: true, data: mockSession }),
        initSession: vi.fn(),
        updateSession: vi.fn(),
        clearSession: vi.fn(),
      });
    });

    it("displays session status", async () => {
      await Status.run([]);

      expect(logSpy).toHaveBeenCalledWith("Session Status");
      expect(logSpy).toHaveBeenCalledWith("  Project:  test-project");
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Features: tools, resources"));
    });

    it("outputs JSON when --json flag is used", async () => {
      await Status.run(["--json"]);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("test-project"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("features"));
    });

    it("shows 'none' when all features are disabled", async () => {
      vi.mocked(providerModule.createMemoryProvider).mockReturnValue({
        name: "memory",
        hasSession: vi.fn().mockResolvedValue(true),
        getSession: vi.fn().mockResolvedValue({
          success: true,
          data: {
            projectName: "test-project",
            features: { tools: false, resources: false, prompts: false, sampling: false },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        }),
        initSession: vi.fn(),
        updateSession: vi.fn(),
        clearSession: vi.fn(),
      });

      await Status.run([]);

      expect(logSpy).toHaveBeenCalledWith("  Features: none");
    });
  });

  describe("command metadata", () => {
    it("has description", () => {
      expect(Status.description).toBeDefined();
      expect(Status.description).toContain("session status");
    });

    it("has examples", () => {
      expect(Status.examples).toBeDefined();
      expect(Status.examples.length).toBeGreaterThan(0);
    });

    it("has json flag", () => {
      expect(Status.flags.json).toBeDefined();
    });
  });
});
