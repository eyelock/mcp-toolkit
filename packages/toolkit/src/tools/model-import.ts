/**
 * Model Import Tool
 *
 * Imports domain model definitions from various sources:
 * - OpenAPI specifications
 * - JSON Schema
 * - Plain text descriptions
 * - URLs
 */

import { readFileSync } from "node:fs";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  type EntityDefinition,
  type ModelImportInput,
  type PropertyType,
  ModelImportInputSchema,
  createToolkitStorage,
} from "../model/index.js";

/**
 * Tool definition for model import
 */
export const modelImportTool: Tool = {
  name: "toolkit:model:import",
  description:
    "Import entity definitions from external sources. Supports OpenAPI specs, JSON Schema, " +
    "plain text descriptions, or URLs. Entities are merged into the current model.",
  inputSchema: zodToJsonSchema(ModelImportInputSchema) as Tool["inputSchema"],
};

/**
 * Parse OpenAPI spec and extract entity definitions
 */
function parseOpenAPI(content: string): EntityDefinition[] {
  try {
    const spec = JSON.parse(content);
    const entities: EntityDefinition[] = [];

    // Extract from components/schemas
    const schemas = spec.components?.schemas || spec.definitions || {};

    for (const [name, schema] of Object.entries(schemas)) {
      const s = schema as Record<string, unknown>;
      if (s.type === "object" && s.properties) {
        const properties = Object.entries(s.properties as Record<string, unknown>).map(
          ([propName, propSchema]) => {
            const ps = propSchema as Record<string, unknown>;
            return {
              name: propName,
              type: mapOpenAPIType(
                ps.type as string,
                ps.format as string | undefined
              ) as PropertyType,
              description: (ps.description as string) || undefined,
              required: ((s.required as string[]) || []).includes(propName),
              unique: false,
            };
          }
        );

        entities.push({
          name: toPascalCase(name),
          description: (s.description as string) || `Entity from OpenAPI: ${name}`,
          properties,
          relationships: [],
          tags: ["imported", "openapi"],
        });
      }
    }

    return entities;
  } catch {
    throw new Error("Failed to parse OpenAPI specification");
  }
}

/**
 * Parse JSON Schema and extract entity definitions
 */
function parseJsonSchema(content: string): EntityDefinition[] {
  try {
    const schema = JSON.parse(content);
    const entities: EntityDefinition[] = [];

    // Handle single schema or definitions
    if (schema.type === "object" && schema.properties) {
      entities.push(schemaToEntity(schema, schema.title || "Entity"));
    }

    // Handle definitions
    const defs = schema.definitions || schema.$defs || {};
    for (const [name, def] of Object.entries(defs)) {
      const d = def as Record<string, unknown>;
      if (d.type === "object" && d.properties) {
        entities.push(schemaToEntity(d, name));
      }
    }

    return entities;
  } catch {
    throw new Error("Failed to parse JSON Schema");
  }
}

/**
 * Convert a JSON Schema object to an EntityDefinition
 */
function schemaToEntity(schema: Record<string, unknown>, name: string): EntityDefinition {
  const properties = Object.entries((schema.properties as Record<string, unknown>) || {}).map(
    ([propName, propSchema]) => {
      const ps = propSchema as Record<string, unknown>;
      return {
        name: propName,
        type: mapJsonSchemaType(ps.type as string, ps.format as string | undefined) as PropertyType,
        description: (ps.description as string) || undefined,
        required: ((schema.required as string[]) || []).includes(propName),
        unique: false,
      };
    }
  );

  return {
    name: toPascalCase(name),
    description: (schema.description as string) || `Entity from JSON Schema: ${name}`,
    properties,
    relationships: [],
    tags: ["imported", "json-schema"],
  };
}

/**
 * Parse plain text description and suggest entities
 */
function parseText(content: string): EntityDefinition[] {
  // This is a simplified parser - in practice, this would be enhanced
  // with LLM assistance to extract entities from natural language
  const entities: EntityDefinition[] = [];

  // Look for patterns like "User has name, email, password"
  const patterns = [/(\w+)\s+(?:has|contains|includes)\s+(.+)/gi, /(\w+):\s*(.+)/gi];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const entityName = match[1];
      const propsText = match[2];
      if (!entityName || !propsText) continue;

      const propNames = propsText
        .split(/[,;]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length < 50);

      if (propNames.length > 0) {
        entities.push({
          name: toPascalCase(entityName),
          description: `Entity extracted from text: ${entityName}`,
          properties: propNames.map((propName) => ({
            name: toCamelCase(propName),
            type: "string" as PropertyType,
            description: undefined,
            required: true,
            unique: false,
          })),
          relationships: [],
          tags: ["imported", "text"],
        });
      }
    }
  }

  return entities;
}

/**
 * Map OpenAPI types to our types
 */
function mapOpenAPIType(type: string, format?: string): string {
  if (format === "date") return "date";
  if (format === "date-time") return "datetime";
  if (format === "uuid") return "uuid";
  if (format === "email") return "email";
  if (format === "uri") return "url";
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "array") return "array";
  if (type === "object") return "object";
  return "string";
}

/**
 * Map JSON Schema types to our types
 */
function mapJsonSchemaType(type: string, format?: string): string {
  return mapOpenAPIType(type, format);
}

/**
 * Convert to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Convert to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Handle model import tool call
 */
export async function handleModelImport(args: unknown, _context: unknown): Promise<CallToolResult> {
  // Validate input
  const parseResult = ModelImportInputSchema.safeParse(args);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid input: ${parseResult.error.message}`,
        },
      ],
      isError: true,
    };
  }

  const input = parseResult.data as ModelImportInput;
  const storage = createToolkitStorage();

  // Ensure model exists
  if (!storage.hasModel() && input.merge) {
    return {
      content: [
        {
          type: "text",
          text: "No model exists to merge into. Use 'toolkit:model:design' with action 'start' first, or set merge=false to create a new model.",
        },
      ],
      isError: true,
    };
  }

  let content = input.content;
  let entities: EntityDefinition[] = [];

  try {
    // Handle URL source
    if (input.source === "url") {
      return {
        content: [
          {
            type: "text",
            text: "URL import is not yet implemented. Please provide the content directly or as a file path.",
          },
        ],
        isError: true,
      };
    }

    // Try to read as file path if content looks like a path
    if (content.endsWith(".json") || content.endsWith(".yaml") || content.endsWith(".yml")) {
      try {
        content = readFileSync(content, "utf-8");
      } catch {
        // Not a file, use as content directly
      }
    }

    // Parse based on source type
    switch (input.source) {
      case "openapi":
        entities = parseOpenAPI(content);
        break;
      case "json-schema":
        entities = parseJsonSchema(content);
        break;
      case "text":
        entities = parseText(content);
        break;
      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown source type: ${input.source}`,
            },
          ],
          isError: true,
        };
    }

    if (entities.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No entities could be extracted from the provided content.",
          },
        ],
      };
    }

    // Add entities to model
    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const entity of entities) {
      const result = storage.addEntity(entity);
      if (result.success) {
        addedCount++;
      } else if (result.error?.includes("already exists")) {
        skippedCount++;
      } else {
        errors.push(`${entity.name}: ${result.error}`);
      }
    }

    const summary = [
      `Import complete!`,
      "",
      `- Added: ${addedCount} entities`,
      skippedCount > 0 ? `- Skipped (already exist): ${skippedCount}` : null,
      errors.length > 0 ? `- Errors: ${errors.length}` : null,
      "",
      "Imported entities:",
      ...entities.map((e) => `- **${e.name}** (${e.properties.length} properties)`),
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: summary,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Import failed: ${error}`,
        },
      ],
      isError: true,
    };
  }
}
