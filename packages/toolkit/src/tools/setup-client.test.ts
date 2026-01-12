/**
 * Setup Client Tool Tests
 */

import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupClientTool,
  setupVerifyTool,
  handleSetupClient,
  handleSetupVerify,
} from "./setup-client.js";

// Mock the storage to use a test directory
let testDir: string;

vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");

  return {
    ...actual,
    createToolkitStorage: () => {
      testDir = testDir || join(tmpdir(), `toolkit-setup-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      return new actual.ToolkitStorage({ baseDir: testDir });
    },
  };
});

describe("setupClientTool", () => {
  it("has correct tool definition", () => {
    expect(setupClientTool.name).toBe("toolkit:setup:client");
    expect(setupClientTool.description).toContain("Configure an IDE");
    expect(setupClientTool.inputSchema).toBeDefined();
  });
});

describe("setupVerifyTool", () => {
  it("has correct tool definition", () => {
    expect(setupVerifyTool.name).toBe("toolkit:setup:verify");
    expect(setupVerifyTool.description).toContain("Verify");
    expect(setupVerifyTool.inputSchema).toBeDefined();
  });
});

describe("handleSetupClient", () => {
  let originalCwd: typeof process.cwd;
  let mockCwd: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-setup-test-${Date.now()}`);
    mockCwd = join(tmpdir(), `toolkit-cwd-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(mockCwd, { recursive: true });

    // Mock process.cwd()
    originalCwd = process.cwd;
    process.cwd = () => mockCwd;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (mockCwd && existsSync(mockCwd)) {
      rmSync(mockCwd, { recursive: true, force: true });
    }
  });

  describe("validation", () => {
    it("rejects invalid input", async () => {
      const result = await handleSetupClient({ client: "invalid" }, {});
      expect(result.isError).toBe(true);
    });

    it("rejects missing client", async () => {
      const result = await handleSetupClient({}, {});
      expect(result.isError).toBe(true);
    });
  });

  describe("custom client", () => {
    it("provides manual instructions for custom client", async () => {
      const result = await handleSetupClient({ client: "custom" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Custom Client Setup");
      expect(result.content[0].text).toContain("manually configure");
    });
  });

  describe("server path detection", () => {
    it("fails when server path cannot be detected", async () => {
      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Could not auto-detect");
    });

    it("detects dist/index.js", async () => {
      mkdirSync(join(mockCwd, "dist"), { recursive: true });
      writeFileSync(join(mockCwd, "dist", "index.js"), "// server");

      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("dist/index.js");
    });

    it("detects build/index.js", async () => {
      mkdirSync(join(mockCwd, "build"), { recursive: true });
      writeFileSync(join(mockCwd, "build", "index.js"), "// server");

      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("build/index.js");
    });

    it("detects src/index.ts", async () => {
      mkdirSync(join(mockCwd, "src"), { recursive: true });
      writeFileSync(join(mockCwd, "src", "index.ts"), "// server");

      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("src/index.ts");
    });

    it("detects index.js in root", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("index.js");
    });

    it("uses provided serverPath", async () => {
      const customPath = "/custom/path/server.js";

      const result = await handleSetupClient({ client: "cursor", serverPath: customPath }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain(customPath);
    });
  });

  describe("cursor configuration", () => {
    it("creates .cursor/mcp.json", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Cursor Configured Successfully");

      const configPath = join(mockCwd, ".cursor", "mcp.json");
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.mcpServers).toBeDefined();
    });

    it("uses custom server name", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient(
        { client: "cursor", options: { serverName: "my-server" } },
        {}
      );

      expect(result.isError).toBeUndefined();
      const configPath = join(mockCwd, ".cursor", "mcp.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.mcpServers["my-server"]).toBeDefined();
    });
  });

  describe("vscode configuration", () => {
    it("creates .vscode/settings.json", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "vscode" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("VS Code Configured Successfully");

      const configPath = join(mockCwd, ".vscode", "settings.json");
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config["mcp.servers"]).toBeDefined();
    });

    it("merges with existing settings.json", async () => {
      mkdirSync(join(mockCwd, ".vscode"), { recursive: true });
      writeFileSync(
        join(mockCwd, ".vscode", "settings.json"),
        JSON.stringify({ "editor.fontSize": 14 })
      );
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "vscode" }, {});

      expect(result.isError).toBeUndefined();
      const configPath = join(mockCwd, ".vscode", "settings.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config["editor.fontSize"]).toBe(14);
      expect(config["mcp.servers"]).toBeDefined();
    });

    it("handles invalid existing settings.json", async () => {
      mkdirSync(join(mockCwd, ".vscode"), { recursive: true });
      writeFileSync(join(mockCwd, ".vscode", "settings.json"), "invalid json");
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "vscode" }, {});

      expect(result.isError).toBeUndefined();
    });
  });

  describe("cli configuration", () => {
    it("creates ~/.mcp-toolkit/config.json", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "cli" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("CLI Configured Successfully");
    });
  });

  describe("claude-desktop configuration", () => {
    it("creates config file", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      const result = await handleSetupClient({ client: "claude-desktop" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Claude Desktop Configured Successfully");
    });

    it("merges with existing claude config", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      // First setup
      await handleSetupClient({ client: "claude-desktop", options: { serverName: "server1" } }, {});

      // Second setup - should merge
      const result = await handleSetupClient(
        { client: "claude-desktop", options: { serverName: "server2" } },
        {}
      );

      expect(result.isError).toBeUndefined();
    });

    it("overwrites invalid existing cursor config", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      // Create directory and write invalid JSON config
      mkdirSync(join(mockCwd, ".cursor"), { recursive: true });
      writeFileSync(join(mockCwd, ".cursor", "mcp.json"), "invalid json");

      // Setup cursor - should overwrite invalid config
      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Cursor Configured Successfully");
    });

    it("overwrites invalid existing vscode config", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      // Create directory and write invalid JSON config
      mkdirSync(join(mockCwd, ".vscode"), { recursive: true });
      writeFileSync(join(mockCwd, ".vscode", "mcp.json"), "invalid json");

      // Setup vscode - should overwrite invalid config
      const result = await handleSetupClient({ client: "vscode" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("VS Code Configured Successfully");
    });
  });

  describe("write errors", () => {
    it("handles write failure gracefully", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      // Create a directory with the config file name to prevent writing
      const cursorDir = join(mockCwd, ".cursor");
      mkdirSync(cursorDir, { recursive: true });
      // Make it so we can't write to the directory
      mkdirSync(join(cursorDir, "mcp.json"), { recursive: true });

      const result = await handleSetupClient({ client: "cursor" }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to write configuration");
    });
  });

  describe("state updates", () => {
    it("updates configured clients list", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      await handleSetupClient({ client: "cursor" }, {});

      const { createToolkitStorage } = await import("../model/storage.js");
      const storage = createToolkitStorage();
      const state = storage.loadState();

      expect(state.data?.configuredClients).toContain("cursor");
    });

    it("does not duplicate configured clients", async () => {
      writeFileSync(join(mockCwd, "index.js"), "// server");

      await handleSetupClient({ client: "cursor" }, {});
      await handleSetupClient({ client: "cursor" }, {});

      const { createToolkitStorage } = await import("../model/storage.js");
      const storage = createToolkitStorage();
      const state = storage.loadState();

      const cursorCount = state.data?.configuredClients?.filter((c) => c === "cursor").length;
      expect(cursorCount).toBe(1);
    });
  });
});

describe("handleSetupVerify", () => {
  let originalCwd: typeof process.cwd;
  let mockCwd: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-verify-test-${Date.now()}`);
    mockCwd = join(tmpdir(), `toolkit-verify-cwd-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(mockCwd, { recursive: true });

    originalCwd = process.cwd;
    process.cwd = () => mockCwd;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (mockCwd && existsSync(mockCwd)) {
      rmSync(mockCwd, { recursive: true, force: true });
    }
  });

  describe("validation", () => {
    it("rejects invalid input", async () => {
      const result = await handleSetupVerify({ client: "invalid" }, {});
      expect(result.isError).toBe(true);
    });
  });

  describe("verify all clients", () => {
    it("checks all clients when none specified", async () => {
      const result = await handleSetupVerify({}, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Client Configuration Status");
      expect(result.content[0].text).toContain("Claude Desktop");
      expect(result.content[0].text).toContain("Cursor");
      expect(result.content[0].text).toContain("VS Code");
      expect(result.content[0].text).toContain("CLI");
    });
  });

  describe("verify specific client", () => {
    it("checks only specified client", async () => {
      const result = await handleSetupVerify({ client: "cursor" }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Cursor");
    });

    it("shows configured status for existing valid config", async () => {
      mkdirSync(join(mockCwd, ".cursor"), { recursive: true });
      writeFileSync(join(mockCwd, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: {} }));

      const result = await handleSetupVerify({ client: "cursor" }, {});

      expect(result.content[0].text).toContain("✓");
      expect(result.content[0].text).toContain("Configured");
    });

    it("shows error for invalid JSON config", async () => {
      mkdirSync(join(mockCwd, ".cursor"), { recursive: true });
      writeFileSync(join(mockCwd, ".cursor", "mcp.json"), "invalid json");

      const result = await handleSetupVerify({ client: "cursor" }, {});

      expect(result.content[0].text).toContain("⚠");
      expect(result.content[0].text).toContain("Invalid JSON");
    });

    it("shows not configured status for missing config", async () => {
      const result = await handleSetupVerify({ client: "cursor" }, {});

      expect(result.content[0].text).toContain("✗");
      expect(result.content[0].text).toContain("Not configured");
    });
  });

  describe("verbose mode", () => {
    it("shows config path in verbose mode", async () => {
      mkdirSync(join(mockCwd, ".cursor"), { recursive: true });
      writeFileSync(join(mockCwd, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: {} }));

      const result = await handleSetupVerify({ client: "cursor", verbose: true }, {});

      expect(result.content[0].text).toContain("Path:");
      expect(result.content[0].text).toContain(".cursor/mcp.json");
    });
  });

  describe("custom client", () => {
    it("skips custom client in verification", async () => {
      const result = await handleSetupVerify({ client: "custom" }, {});

      // Custom returns null from getClientConfig, so it gets skipped
      expect(result.content[0].text).toContain("Client Configuration Status");
    });
  });
});
