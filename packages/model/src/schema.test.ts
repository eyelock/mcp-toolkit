import { describe, expect, it } from "vitest";
// Also test index.ts re-exports
import * as ModelExports from "./index.js";
import {
  ServerIdentitySchema,
  ServerTagsSchema,
  SessionConfigSchema,
  SessionFeaturesSchema,
  SessionInitInputSchema,
  SessionUpdateInputSchema,
  zodToJsonSchema,
} from "./schema.js";

describe("ServerTagsSchema", () => {
  it("applies default empty object", () => {
    const result = ServerTagsSchema.parse(undefined);
    expect(result).toEqual({});
  });

  it("accepts valid tag keys and values", () => {
    const result = ServerTagsSchema.parse({
      env: "development",
      team: "platform",
    });
    expect(result).toEqual({
      env: "development",
      team: "platform",
    });
  });

  it("accepts kebab-case keys", () => {
    const result = ServerTagsSchema.parse({
      "my-tag": "value",
    });
    expect(result["my-tag"]).toBe("value");
  });

  it("accepts empty string values", () => {
    const result = ServerTagsSchema.parse({
      env: "",
    });
    expect(result.env).toBe("");
  });

  it("accepts values up to 255 characters", () => {
    const result = ServerTagsSchema.parse({
      key: "a".repeat(255),
    });
    expect(result.key).toBe("a".repeat(255));
  });
});

describe("ServerIdentitySchema", () => {
  it("applies default empty tags", () => {
    const result = ServerIdentitySchema.parse({
      canonicalName: "my-toolkit",
    });
    expect(result).toEqual({
      canonicalName: "my-toolkit",
      tags: {},
    });
  });

  it("validates canonicalName format (kebab-case)", () => {
    expect(() =>
      ServerIdentitySchema.parse({
        canonicalName: "my-toolkit",
      })
    ).not.toThrow();

    expect(() =>
      ServerIdentitySchema.parse({
        canonicalName: "My Toolkit", // Not kebab-case
      })
    ).toThrow();
  });

  it("rejects empty canonicalName", () => {
    expect(() =>
      ServerIdentitySchema.parse({
        canonicalName: "",
      })
    ).toThrow();
  });

  it("rejects canonicalName over 100 characters", () => {
    expect(() =>
      ServerIdentitySchema.parse({
        canonicalName: "a".repeat(101),
      })
    ).toThrow();
  });

  it("accepts tags", () => {
    const result = ServerIdentitySchema.parse({
      canonicalName: "my-toolkit",
      tags: { env: "development", team: "platform" },
    });
    expect(result.tags).toEqual({ env: "development", team: "platform" });
  });
});

describe("SessionFeaturesSchema", () => {
  it("applies defaults for all features", () => {
    const result = SessionFeaturesSchema.parse({});
    expect(result).toEqual({
      tools: true,
      resources: true,
      prompts: false,
      sampling: false,
    });
  });

  it("allows overriding defaults", () => {
    const result = SessionFeaturesSchema.parse({
      tools: false,
      prompts: true,
    });
    expect(result.tools).toBe(false);
    expect(result.prompts).toBe(true);
  });
});

describe("SessionConfigSchema", () => {
  it("validates a complete session config", () => {
    const config = {
      projectName: "my-project",
      features: {
        tools: true,
        resources: true,
        prompts: false,
        sampling: false,
      },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    expect(() => SessionConfigSchema.parse(config)).not.toThrow();
  });

  it("rejects invalid project names", () => {
    const config = {
      projectName: "My Project", // Not kebab-case
      features: {},
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    expect(() => SessionConfigSchema.parse(config)).toThrow();
  });
});

describe("SessionInitInputSchema", () => {
  it("requires projectName", () => {
    expect(() => SessionInitInputSchema.parse({})).toThrow();
  });

  it("allows optional features", () => {
    const input = { projectName: "test-project" };
    expect(() => SessionInitInputSchema.parse(input)).not.toThrow();
  });

  it("allows partial features", () => {
    const input = {
      projectName: "test-project",
      features: { prompts: true },
    };
    const result = SessionInitInputSchema.parse(input);
    expect(result.features?.prompts).toBe(true);
  });
});

describe("SessionUpdateInputSchema", () => {
  it("allows empty update (all optional)", () => {
    expect(() => SessionUpdateInputSchema.parse({})).not.toThrow();
  });

  it("allows partial updates", () => {
    const input = { projectName: "new-name" };
    const result = SessionUpdateInputSchema.parse(input);
    expect(result.projectName).toBe("new-name");
  });
});

describe("zodToJsonSchema", () => {
  it("extracts schema definition", () => {
    const result = zodToJsonSchema(SessionFeaturesSchema);
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});

describe("index exports", () => {
  it("re-exports all schema exports", () => {
    expect(ModelExports.ServerTagsSchema).toBeDefined();
    expect(ModelExports.ServerIdentitySchema).toBeDefined();
    expect(ModelExports.SessionConfigSchema).toBeDefined();
    expect(ModelExports.SessionFeaturesSchema).toBeDefined();
    expect(ModelExports.SessionInitInputSchema).toBeDefined();
    expect(ModelExports.SessionUpdateInputSchema).toBeDefined();
    expect(ModelExports.zodToJsonSchema).toBeDefined();
  });
});
