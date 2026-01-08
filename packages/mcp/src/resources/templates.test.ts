/**
 * Resource Templates Tests
 */

import { describe, it, expect, vi } from "vitest";
import {
  LOG_ENTRIES_TEMPLATE,
  FEATURE_CONFIG_TEMPLATE,
  resourceTemplates,
  registerResourceTemplates,
  extractTemplateParams,
  matchesTemplate,
  readLogEntries,
  readFeatureConfig,
  handleTemplatedResourceRead,
} from "./templates.js";
import type { ServerContext } from "../server.js";

describe("Resource Templates", () => {
  describe("Template definitions", () => {
    it("defines log entries template with correct structure", () => {
      expect(LOG_ENTRIES_TEMPLATE.uriTemplate).toBe("log:///{date}");
      expect(LOG_ENTRIES_TEMPLATE.name).toBe("Log Entries");
      expect(LOG_ENTRIES_TEMPLATE.mimeType).toBe("application/json");
    });

    it("defines feature config template with correct structure", () => {
      expect(FEATURE_CONFIG_TEMPLATE.uriTemplate).toBe("config:///{feature}");
      expect(FEATURE_CONFIG_TEMPLATE.name).toBe("Feature Configuration");
    });

    it("includes all templates in resourceTemplates array", () => {
      expect(resourceTemplates).toHaveLength(2);
      expect(resourceTemplates).toContain(LOG_ENTRIES_TEMPLATE);
      expect(resourceTemplates).toContain(FEATURE_CONFIG_TEMPLATE);
    });
  });

  describe("registerResourceTemplates", () => {
    it("returns all resource templates", () => {
      const result = registerResourceTemplates();

      expect(result).toHaveLength(2);
      expect(result[0].uriTemplate).toBe("log:///{date}");
      expect(result[1].uriTemplate).toBe("config:///{feature}");
    });
  });

  describe("extractTemplateParams", () => {
    it("extracts single parameter from log template", () => {
      const params = extractTemplateParams("log:///{date}", "log:///2024-01-15");

      expect(params).toEqual({ date: "2024-01-15" });
    });

    it("extracts parameter from config template", () => {
      const params = extractTemplateParams("config:///{feature}", "config:///tools");

      expect(params).toEqual({ feature: "tools" });
    });

    it("returns null when URI does not match template", () => {
      const params = extractTemplateParams("log:///{date}", "config:///tools");

      expect(params).toBeNull();
    });

    it("returns null when URI has wrong structure", () => {
      const params = extractTemplateParams("log:///{date}", "log:///2024/01/15");

      expect(params).toBeNull();
    });

    it("decodes URL-encoded parameters", () => {
      const params = extractTemplateParams("search:///{query}", "search:///hello%20world");

      expect(params).toEqual({ query: "hello world" });
    });

    it("handles templates with multiple parameters", () => {
      const params = extractTemplateParams("log:///{date}/{level}", "log:///2024-01-15/error");

      expect(params).toEqual({ date: "2024-01-15", level: "error" });
    });
  });

  describe("matchesTemplate", () => {
    it("returns true when URI matches template", () => {
      expect(matchesTemplate("log:///{date}", "log:///2024-01-15")).toBe(true);
    });

    it("returns false when URI does not match template", () => {
      expect(matchesTemplate("log:///{date}", "config:///tools")).toBe(false);
    });

    it("returns false for partial matches", () => {
      expect(matchesTemplate("log:///{date}/entries", "log:///2024-01-15")).toBe(false);
    });
  });

  describe("readLogEntries", () => {
    const mockContext = {} as ServerContext;

    it("returns log entries for valid date", async () => {
      const result = await readLogEntries("2024-01-15", mockContext);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("log:///2024-01-15");
      expect(result.contents[0].mimeType).toBe("application/json");

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.date).toBe("2024-01-15");
      expect(data.entries).toHaveLength(3);
      expect(data.count).toBe(3);
    });

    it("returns error for invalid date format", async () => {
      const result = await readLogEntries("15-01-2024", mockContext);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.error).toBe("Invalid date format");
      expect(data.expected).toBe("YYYY-MM-DD");
      expect(data.received).toBe("15-01-2024");
    });

    it("returns error for malformed date", async () => {
      const result = await readLogEntries("not-a-date", mockContext);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.error).toBe("Invalid date format");
    });

    it("includes correct timestamps in log entries", async () => {
      const result = await readLogEntries("2024-06-20", mockContext);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.entries[0].timestamp).toContain("2024-06-20");
    });
  });

  describe("readFeatureConfig", () => {
    it("returns config for valid feature with active session", async () => {
      const mockContext = {
        provider: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              projectName: "test-project",
              features: {
                tools: true,
                resources: true,
                prompts: false,
                sampling: false,
              },
            },
          }),
        },
      } as unknown as ServerContext;

      const result = await readFeatureConfig("tools", mockContext);

      expect(result.contents).toHaveLength(1);
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.feature).toBe("tools");
      expect(data.enabled).toBe(true);
      expect(data.project).toBe("test-project");
      expect(data.description).toContain("Callable functions");
    });

    it("returns error for unknown feature", async () => {
      const mockContext = {
        provider: {
          getSession: vi.fn().mockResolvedValue({ data: null }),
        },
      } as unknown as ServerContext;

      const result = await readFeatureConfig("unknown", mockContext);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.error).toBe("Unknown feature");
      expect(data.validFeatures).toContain("tools");
      expect(data.received).toBe("unknown");
    });

    it("returns error when no active session", async () => {
      const mockContext = {
        provider: {
          getSession: vi.fn().mockResolvedValue({ data: null }),
        },
      } as unknown as ServerContext;

      const result = await readFeatureConfig("tools", mockContext);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.error).toBe("No active session");
    });

    it("returns correct descriptions for each feature", async () => {
      const mockContext = {
        provider: {
          getSession: vi.fn().mockResolvedValue({
            data: { projectName: "test", features: { sampling: true } },
          }),
        },
      } as unknown as ServerContext;

      const result = await readFeatureConfig("sampling", mockContext);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.description).toContain("LLM completion requests");
    });
  });

  describe("handleTemplatedResourceRead", () => {
    it("routes log URIs to readLogEntries", async () => {
      const mockContext = {} as ServerContext;

      const result = await handleTemplatedResourceRead("log:///2024-01-15", mockContext);

      expect(result).not.toBeNull();
      const data = JSON.parse(result!.contents[0].text as string);
      expect(data.date).toBe("2024-01-15");
    });

    it("routes config URIs to readFeatureConfig", async () => {
      const mockContext = {
        provider: {
          getSession: vi.fn().mockResolvedValue({
            data: { projectName: "test", features: { tools: true } },
          }),
        },
      } as unknown as ServerContext;

      const result = await handleTemplatedResourceRead("config:///tools", mockContext);

      expect(result).not.toBeNull();
      const data = JSON.parse(result!.contents[0].text as string);
      expect(data.feature).toBe("tools");
    });

    it("returns null for unmatched URIs", async () => {
      const mockContext = {} as ServerContext;

      const result = await handleTemplatedResourceRead("unknown:///something", mockContext);

      expect(result).toBeNull();
    });

    it("returns null for static resource URIs", async () => {
      const mockContext = {} as ServerContext;

      const result = await handleTemplatedResourceRead("session://current", mockContext);

      expect(result).toBeNull();
    });
  });
});
