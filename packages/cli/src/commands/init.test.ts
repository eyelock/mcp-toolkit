import * as providerModule from "@mcp-toolkit/provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Init from "./init.js";

// Mock the provider module
vi.mock("@mcp-toolkit/provider", async (importOriginal) => {
  const original = await importOriginal<typeof providerModule>();
  return {
    ...original,
    createMemoryProvider: vi.fn(() => original.createMemoryProvider()),
  };
});

describe("Init command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset to real implementation by default
    vi.mocked(providerModule.createMemoryProvider).mockImplementation(
      () => new providerModule.MemoryProvider()
    );
    logSpy = vi.spyOn(Init.prototype, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(Init.prototype, "error").mockImplementation((msg) => {
      throw new Error(String(msg));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful initialization", () => {
    it("initializes a session with default features", async () => {
      await Init.run(["my-project"]);

      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
      expect(logSpy).toHaveBeenCalledWith("  Project:  my-project");
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Features: tools, resources"));
    });

    it("initializes with custom features via flags", async () => {
      await Init.run(["my-project", "--no-tools", "--prompts"]);

      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("enables all features with --all-features flag", async () => {
      await Init.run(["my-project", "--all-features"]);

      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Features: tools, resources, prompts, sampling")
      );
    });

    it("outputs created timestamp", async () => {
      await Init.run(["my-project"]);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Created:"));
    });
  });

  describe("validation errors", () => {
    it("rejects invalid project names with spaces", async () => {
      await expect(Init.run(["My Project"])).rejects.toThrow("Project name must be kebab-case");
      expect(errorSpy).toHaveBeenCalled();
    });

    it("rejects camelCase project names", async () => {
      await expect(Init.run(["myProject"])).rejects.toThrow("Project name must be kebab-case");
    });

    it("rejects uppercase project names", async () => {
      await expect(Init.run(["MY-PROJECT"])).rejects.toThrow("Project name must be kebab-case");
    });

    it("rejects underscore project names", async () => {
      await expect(Init.run(["my_project"])).rejects.toThrow("Project name must be kebab-case");
    });
  });

  describe("valid project names", () => {
    it("accepts simple kebab-case", async () => {
      await Init.run(["test-project"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("accepts single word lowercase", async () => {
      await Init.run(["project"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("accepts numbers in name", async () => {
      await Init.run(["api-v2"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });
  });

  describe("feature flag combinations", () => {
    it("can disable tools feature", async () => {
      await Init.run(["test", "--no-tools"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("can disable resources feature", async () => {
      await Init.run(["test", "--no-resources"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("can enable prompts feature", async () => {
      await Init.run(["test", "--prompts"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("can enable sampling feature", async () => {
      await Init.run(["test", "--sampling"]);
      expect(logSpy).toHaveBeenCalledWith("✓ Session initialized successfully!");
    });

    it("shows 'none' when all features are disabled", async () => {
      await Init.run(["test", "--no-tools", "--no-resources", "--no-prompts", "--no-sampling"]);
      expect(logSpy).toHaveBeenCalledWith("  Features: none");
    });
  });

  describe("provider errors", () => {
    it("reports error when provider fails", async () => {
      vi.mocked(providerModule.createMemoryProvider).mockReturnValue({
        name: "memory",
        hasSession: vi.fn().mockResolvedValue(false),
        getSession: vi.fn().mockResolvedValue({ success: true, data: null }),
        initSession: vi.fn().mockResolvedValue({
          success: false,
          error: "Provider internal error",
        }),
        updateSession: vi.fn(),
        clearSession: vi.fn(),
      });

      await expect(Init.run(["test-project"])).rejects.toThrow(
        "Failed to initialize session: Provider internal error"
      );
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
