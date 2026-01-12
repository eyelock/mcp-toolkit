/**
 * Model Schema Tests
 */

import { describe, expect, it } from "vitest";
import {
  DomainModelSchema,
  EntityDefinitionSchema,
  PropertyDefinitionSchema,
  ModelDesignInputSchema,
  GenerateInputSchema,
} from "./schema.js";

describe("PropertyDefinitionSchema", () => {
  it("validates a valid property definition", () => {
    const result = PropertyDefinitionSchema.safeParse({
      name: "userName",
      type: "string",
      description: "The user's name",
      required: true,
      unique: false,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid property name", () => {
    const result = PropertyDefinitionSchema.safeParse({
      name: "123invalid",
      type: "string",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid property type", () => {
    const result = PropertyDefinitionSchema.safeParse({
      name: "validName",
      type: "invalidType",
    });

    expect(result.success).toBe(false);
  });

  it("allows all valid property types", () => {
    const types = [
      "string",
      "number",
      "boolean",
      "date",
      "datetime",
      "uuid",
      "email",
      "url",
      "json",
      "array",
      "object",
    ];

    for (const type of types) {
      const result = PropertyDefinitionSchema.safeParse({
        name: "prop",
        type,
      });
      expect(result.success, `type ${type} should be valid`).toBe(true);
    }
  });
});

describe("EntityDefinitionSchema", () => {
  it("validates a valid entity definition", () => {
    const result = EntityDefinitionSchema.safeParse({
      name: "User",
      description: "A user in the system",
      properties: [
        { name: "id", type: "uuid", required: true, unique: true },
        { name: "email", type: "email", required: true, unique: true },
        { name: "name", type: "string", required: true, unique: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects entity name not in PascalCase", () => {
    const result = EntityDefinitionSchema.safeParse({
      name: "user",
      description: "A user",
      properties: [{ name: "id", type: "uuid", required: true, unique: false }],
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one property", () => {
    const result = EntityDefinitionSchema.safeParse({
      name: "User",
      description: "A user",
      properties: [],
    });

    expect(result.success).toBe(false);
  });

  it("validates relationships", () => {
    const result = EntityDefinitionSchema.safeParse({
      name: "Post",
      description: "A blog post",
      properties: [{ name: "title", type: "string", required: true, unique: false }],
      relationships: [
        {
          target: "User",
          type: "one-to-many",
          description: "Author of the post",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("DomainModelSchema", () => {
  it("validates a complete domain model", () => {
    const result = DomainModelSchema.safeParse({
      name: "blog-app",
      description: "A blogging application",
      version: "1.0.0",
      entities: [
        {
          name: "User",
          description: "A user",
          properties: [{ name: "email", type: "email", required: true, unique: true }],
        },
        {
          name: "Post",
          description: "A blog post",
          properties: [{ name: "title", type: "string", required: true, unique: false }],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires kebab-case model name", () => {
    const result = DomainModelSchema.safeParse({
      name: "BlogApp",
      description: "A blogging application",
    });

    expect(result.success).toBe(false);
  });

  it("defaults entities to empty array", () => {
    const result = DomainModelSchema.safeParse({
      name: "my-app",
      description: "My application",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entities).toEqual([]);
    }
  });
});

describe("ModelDesignInputSchema", () => {
  it("validates start action", () => {
    const result = ModelDesignInputSchema.safeParse({
      action: "start",
      name: "my-model",
      description: "My domain model",
    });

    expect(result.success).toBe(true);
  });

  it("validates add-entity action", () => {
    const result = ModelDesignInputSchema.safeParse({
      action: "add-entity",
      entity: {
        name: "User",
        description: "A user entity",
        properties: [{ name: "id", type: "uuid", required: true, unique: true }],
      },
    });

    expect(result.success).toBe(true);
  });

  it("validates show action", () => {
    const result = ModelDesignInputSchema.safeParse({
      action: "show",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = ModelDesignInputSchema.safeParse({
      action: "invalid-action",
    });

    expect(result.success).toBe(false);
  });
});

describe("GenerateInputSchema", () => {
  it("validates generation with tier", () => {
    const result = GenerateInputSchema.safeParse({
      tier: "definitions",
    });

    expect(result.success).toBe(true);
  });

  it("validates generation with all tiers", () => {
    const tiers = ["definitions", "stubs", "full"];

    for (const tier of tiers) {
      const result = GenerateInputSchema.safeParse({ tier });
      expect(result.success, `tier ${tier} should be valid`).toBe(true);
    }
  });

  it("allows optional entities filter", () => {
    const result = GenerateInputSchema.safeParse({
      tier: "full",
      entities: ["User", "Post"],
    });

    expect(result.success).toBe(true);
  });

  it("defaults dryRun to false", () => {
    const result = GenerateInputSchema.safeParse({
      tier: "definitions",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dryRun).toBe(false);
    }
  });
});
