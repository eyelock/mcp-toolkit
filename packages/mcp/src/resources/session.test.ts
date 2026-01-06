import { createMemoryProvider } from "@mcp-toolkit/provider";
import { beforeEach, describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import { SESSION_RESOURCE_URI, readSessionResource, sessionResource } from "./session.js";

describe("Session Resource", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = { provider: createMemoryProvider() };
  });

  describe("sessionResource", () => {
    it("has correct URI", () => {
      expect(sessionResource.uri).toBe(SESSION_RESOURCE_URI);
    });

    it("has name and description", () => {
      expect(sessionResource.name).toBe("Current Session");
      expect(sessionResource.description).toBeDefined();
    });

    it("has JSON mime type", () => {
      expect(sessionResource.mimeType).toBe("application/json");
    });
  });

  describe("SESSION_RESOURCE_URI", () => {
    it("is the correct URI", () => {
      expect(SESSION_RESOURCE_URI).toBe("session://current");
    });
  });

  describe("readSessionResource", () => {
    it("returns error when no session exists", async () => {
      const result = await readSessionResource(context);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(SESSION_RESOURCE_URI);
      expect(result.contents[0].mimeType).toBe("application/json");

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.error).toBe("No active session");
    });

    it("returns session data when session exists", async () => {
      await context.provider.initSession({ projectName: "test-project" });

      const result = await readSessionResource(context);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(SESSION_RESOURCE_URI);

      const data = JSON.parse(result.contents[0].text as string);
      expect(data.projectName).toBe("test-project");
      expect(data.features).toBeDefined();
    });
  });
});
