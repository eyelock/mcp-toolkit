/**
 * Resources Index Tests
 */

import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  toolkitResources,
  toolkitResourceTemplates,
  registerToolkitResources,
  registerToolkitResourceTemplates,
  isToolkitResource,
  handleToolkitResourceRead,
  getTemplateTypes,
  getClientNames,
} from "./index.js";

// Mock the storage to use a test directory
let testDir: string;

vi.mock("../model/storage.js", async () => {
  const actual = await vi.importActual<typeof import("../model/storage.js")>("../model/storage.js");

  return {
    ...actual,
    createToolkitStorage: () => {
      testDir = testDir || join(tmpdir(), `toolkit-resource-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      return new actual.ToolkitStorage({ baseDir: testDir });
    },
  };
});

describe("toolkitResources", () => {
  it("exports static resources", () => {
    const uris = toolkitResources.map((r) => r.uri);
    expect(uris).toContain("toolkit://model");
  });
});

describe("toolkitResourceTemplates", () => {
  it("exports resource templates", () => {
    const templates = toolkitResourceTemplates.map((t) => t.uriTemplate);
    expect(templates).toContain("toolkit://templates/{type}");
    expect(templates).toContain("toolkit://clients/{name}/config");
  });
});

describe("registerToolkitResources", () => {
  it("returns all toolkit resources", () => {
    const resources = registerToolkitResources();
    expect(resources).toEqual(toolkitResources);
  });
});

describe("registerToolkitResourceTemplates", () => {
  it("returns all toolkit resource templates", () => {
    const templates = registerToolkitResourceTemplates();
    expect(templates).toEqual(toolkitResourceTemplates);
  });
});

describe("isToolkitResource", () => {
  it("returns true for toolkit URIs", () => {
    expect(isToolkitResource("toolkit://model")).toBe(true);
    expect(isToolkitResource("toolkit://templates/tool")).toBe(true);
    expect(isToolkitResource("toolkit://clients/cursor/config")).toBe(true);
  });

  it("returns false for non-toolkit URIs", () => {
    expect(isToolkitResource("session://current")).toBe(false);
    expect(isToolkitResource("file:///path")).toBe(false);
  });
});

describe("handleToolkitResourceRead", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `toolkit-resource-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("returns null for non-toolkit URIs", async () => {
    const result = await handleToolkitResourceRead("session://current");
    expect(result).toBeNull();
  });

  describe("model resource", () => {
    it("reads model resource when no model exists", async () => {
      const result = await handleToolkitResourceRead("toolkit://model");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
      expect(result?.contents[0].text).toContain("No model found");
    });

    it("reads model resource when model exists", async () => {
      const { createToolkitStorage } = await import("../model/storage.js");
      const storage = createToolkitStorage();
      storage.initModel("test-model", "A test model");

      const result = await handleToolkitResourceRead("toolkit://model");
      expect(result).not.toBeNull();
      expect(result?.contents[0].text).toContain("test-model");
    });
  });

  describe("template resources", () => {
    it("reads tool template", async () => {
      const result = await handleToolkitResourceRead("toolkit://templates/tool");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("reads resource template", async () => {
      const result = await handleToolkitResourceRead("toolkit://templates/resource");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("reads prompt template", async () => {
      const result = await handleToolkitResourceRead("toolkit://templates/prompt");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("reads handler template", async () => {
      const result = await handleToolkitResourceRead("toolkit://templates/handler");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("handles unknown template type", async () => {
      const result = await handleToolkitResourceRead("toolkit://templates/unknown");
      expect(result).not.toBeNull();
      expect(result?.contents[0].text).toContain("Unknown template type");
      expect(result?.contents[0].text).toContain("available");
    });
  });

  describe("client config resources", () => {
    it("reads claude-desktop config", async () => {
      const result = await handleToolkitResourceRead("toolkit://clients/claude-desktop/config");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("reads cursor config", async () => {
      const result = await handleToolkitResourceRead("toolkit://clients/cursor/config");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("reads vscode config", async () => {
      const result = await handleToolkitResourceRead("toolkit://clients/vscode/config");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("reads cli config", async () => {
      const result = await handleToolkitResourceRead("toolkit://clients/cli/config");
      expect(result).not.toBeNull();
      expect(result?.contents).toHaveLength(1);
    });

    it("handles unknown client", async () => {
      const result = await handleToolkitResourceRead("toolkit://clients/unknown/config");
      expect(result).not.toBeNull();
      expect(result?.contents[0].text).toContain("Unknown client");
      expect(result?.contents[0].text).toContain("available");
    });
  });
});

describe("getTemplateTypes", () => {
  it("returns available template types", () => {
    const types = getTemplateTypes();
    expect(types).toContain("tool");
    expect(types).toContain("resource");
    expect(types).toContain("prompt");
    expect(types).toContain("handler");
  });
});

describe("getClientNames", () => {
  it("returns available client names", () => {
    const clients = getClientNames();
    expect(clients).toContain("claude-desktop");
    expect(clients).toContain("cursor");
    expect(clients).toContain("vscode");
    expect(clients).toContain("cli");
  });
});
