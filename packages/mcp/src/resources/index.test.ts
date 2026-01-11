import { createMemoryProvider } from "@mcp-toolkit/storage";
import { beforeEach, describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import { getResourceTemplates, handleResourceRead, registerResources } from "./index.js";
import { SESSION_RESOURCE_URI } from "./session.js";

describe("Resources Registry", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = { provider: createMemoryProvider() };
  });

  describe("registerResources", () => {
    it("returns array of resources", () => {
      const resources = registerResources();

      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
    });

    it("includes session resource", () => {
      const resources = registerResources();

      const sessionResource = resources.find((r) => r.uri === SESSION_RESOURCE_URI);
      expect(sessionResource).toBeDefined();
    });
  });

  describe("getResourceTemplates", () => {
    it("returns array of resource templates", () => {
      const templates = getResourceTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it("includes log entries template", () => {
      const templates = getResourceTemplates();

      const logTemplate = templates.find((t) => t.uriTemplate === "log:///{date}");
      expect(logTemplate).toBeDefined();
      expect(logTemplate?.name).toBe("Log Entries");
    });

    it("includes feature config template", () => {
      const templates = getResourceTemplates();

      const configTemplate = templates.find((t) => t.uriTemplate === "config:///{feature}");
      expect(configTemplate).toBeDefined();
      expect(configTemplate?.name).toBe("Feature Configuration");
    });
  });

  describe("handleResourceRead", () => {
    it("handles known static resource URI", async () => {
      await context.provider.initSession({ projectName: "test-project" });

      const result = await handleResourceRead(SESSION_RESOURCE_URI, context);

      expect(result.contents).toHaveLength(1);
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.projectName).toBe("test-project");
    });

    it("handles templated log resource URI", async () => {
      const result = await handleResourceRead("log:///2024-01-15", context);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("log:///2024-01-15");
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.date).toBe("2024-01-15");
      expect(data.entries).toBeDefined();
    });

    it("handles templated config resource URI", async () => {
      await context.provider.initSession({
        projectName: "test-project",
        features: { tools: true },
      });

      const result = await handleResourceRead("config:///tools", context);

      expect(result.contents).toHaveLength(1);
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.feature).toBe("tools");
      expect(data.enabled).toBe(true);
    });

    it("returns error for unknown resource URI", async () => {
      const result = await handleResourceRead("unknown://resource", context);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("unknown://resource");
      expect(result.contents[0].mimeType).toBe("text/plain");
      expect(result.contents[0].text).toContain("Unknown resource");
    });
  });
});
