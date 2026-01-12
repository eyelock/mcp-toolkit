/**
 * Resources Index Tests
 */

import { describe, expect, it } from "vitest";
import {
  toolkitResources,
  toolkitResourceTemplates,
  registerToolkitResources,
  registerToolkitResourceTemplates,
  isToolkitResource,
  handleToolkitResourceRead,
} from "./index.js";

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
  it("returns null for non-toolkit URIs", async () => {
    const result = await handleToolkitResourceRead("session://current");
    expect(result).toBeNull();
  });

  it("reads model resource", async () => {
    const result = await handleToolkitResourceRead("toolkit://model");
    expect(result).not.toBeNull();
    expect(result?.contents).toHaveLength(1);
  });

  it("reads template resources", async () => {
    const result = await handleToolkitResourceRead("toolkit://templates/tool");
    expect(result).not.toBeNull();
    expect(result?.contents).toHaveLength(1);
  });

  it("handles unknown template type", async () => {
    const result = await handleToolkitResourceRead("toolkit://templates/unknown");
    expect(result).not.toBeNull();
    expect(result?.contents[0].text).toContain("Unknown template type");
  });

  it("reads client config resources", async () => {
    const result = await handleToolkitResourceRead("toolkit://clients/cursor/config");
    expect(result).not.toBeNull();
    expect(result?.contents).toHaveLength(1);
  });

  it("handles unknown client", async () => {
    const result = await handleToolkitResourceRead("toolkit://clients/unknown/config");
    expect(result).not.toBeNull();
    expect(result?.contents[0].text).toContain("Unknown client");
  });
});
