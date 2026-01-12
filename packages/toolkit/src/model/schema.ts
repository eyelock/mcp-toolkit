/**
 * Toolkit Model Schema
 *
 * Zod schemas for the domain model that the toolkit helps developers design.
 * This is the model that gets persisted in toolkit.model.json.
 */

import { z } from "zod";

// =============================================================================
// Property Definitions
// =============================================================================

/**
 * Property type enum - supported types for entity properties
 */
export const PropertyTypeSchema = z.enum([
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
]);

/**
 * A property within an entity
 */
export const PropertyDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Must start with letter, alphanumeric and underscores only")
    .describe("Property name (camelCase recommended)"),
  type: PropertyTypeSchema.describe("Property data type"),
  description: z.string().max(500).optional().describe("Human-readable description"),
  required: z.boolean().default(true).describe("Whether this property is required"),
  unique: z.boolean().default(false).describe("Whether values must be unique"),
  default: z.unknown().optional().describe("Default value if not provided"),
  validation: z
    .object({
      min: z.number().optional().describe("Minimum value (numbers) or length (strings)"),
      max: z.number().optional().describe("Maximum value (numbers) or length (strings)"),
      pattern: z.string().optional().describe("Regex pattern for validation"),
      enum: z.array(z.string()).optional().describe("Allowed values"),
    })
    .optional()
    .describe("Validation rules"),
});

// =============================================================================
// Relationship Definitions
// =============================================================================

/**
 * Relationship type enum
 */
export const RelationshipTypeSchema = z.enum(["one-to-one", "one-to-many", "many-to-many"]);

/**
 * A relationship between entities
 */
export const RelationshipDefinitionSchema = z.object({
  target: z
    .string()
    .min(1)
    .regex(/^[A-Z][a-zA-Z0-9]*$/, "Must be PascalCase entity name")
    .describe("Target entity name"),
  type: RelationshipTypeSchema.describe("Relationship cardinality"),
  description: z.string().max(500).optional().describe("Human-readable description"),
  inverse: z.string().optional().describe("Name of the inverse relationship on the target entity"),
  cascade: z
    .enum(["none", "delete", "nullify"])
    .default("none")
    .describe("Cascade behavior on delete"),
});

// =============================================================================
// Entity Definitions
// =============================================================================

/**
 * An entity in the domain model
 */
export const EntityDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Z][a-zA-Z0-9]*$/, "Must be PascalCase")
    .describe("Entity name (PascalCase)"),
  description: z.string().max(1000).describe("Human-readable description of this entity"),
  properties: z.array(PropertyDefinitionSchema).min(1).describe("Entity properties"),
  relationships: z
    .array(RelationshipDefinitionSchema)
    .default([])
    .describe("Relationships to other entities"),
  tags: z.array(z.string()).default([]).describe("Tags for categorization"),
});

// =============================================================================
// Domain Model
// =============================================================================

/**
 * The complete domain model
 */
export const DomainModelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/, "Must be kebab-case")
    .describe("Model name (kebab-case)"),
  description: z.string().max(2000).describe("Human-readable description of the domain"),
  version: z.string().default("1.0.0").describe("Model version (semver)"),
  entities: z.array(EntityDefinitionSchema).default([]).describe("Entities in the model"),
  createdAt: z.string().datetime().optional().describe("ISO 8601 timestamp of creation"),
  updatedAt: z.string().datetime().optional().describe("ISO 8601 timestamp of last update"),
});

// =============================================================================
// Toolkit Configuration
// =============================================================================

/**
 * Code generation tier
 */
export const GenerationTierSchema = z.enum([
  "definitions", // Tier 1: Just tool/resource/prompt definitions
  "stubs", // Tier 2: Definitions + implementation stubs
  "full", // Tier 3: Full working CRUD implementation
]);

/**
 * Target client for setup
 */
export const ClientTargetSchema = z.enum(["claude-desktop", "cursor", "vscode", "cli", "custom"]);

/**
 * Toolkit state - tracks progress through the workflow
 */
export const ToolkitStateSchema = z.object({
  phase: z
    .enum(["design", "generate", "setup", "complete"])
    .default("design")
    .describe("Current workflow phase"),
  model: DomainModelSchema.optional().describe("The domain model being designed"),
  generationTier: GenerationTierSchema.optional().describe("Selected generation tier"),
  generatedFiles: z.array(z.string()).default([]).describe("Files that have been generated"),
  configuredClients: z
    .array(ClientTargetSchema)
    .default([])
    .describe("Clients that have been configured"),
});

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Input for adding/updating an entity
 */
export const EntityInputSchema = EntityDefinitionSchema;

/**
 * Input for model design tool
 */
export const ModelDesignInputSchema = z.object({
  action: z
    .enum(["start", "add-entity", "update-entity", "remove-entity", "show", "finalize"])
    .describe("Design action to perform"),
  name: z.string().optional().describe("Model or entity name (depends on action)"),
  description: z.string().optional().describe("Description (for start or add-entity)"),
  entity: EntityInputSchema.optional().describe("Entity definition (for add/update-entity)"),
});

/**
 * Input for model import tool
 */
export const ModelImportInputSchema = z.object({
  source: z
    .enum(["openapi", "json-schema", "text", "url"])
    .describe("Source format to import from"),
  content: z.string().describe("Content to import (file path, URL, or inline content)"),
  merge: z.boolean().default(true).describe("Merge with existing model (true) or replace (false)"),
});

/**
 * Input for code generation tool
 */
export const GenerateInputSchema = z.object({
  tier: GenerationTierSchema.describe("Generation tier"),
  entities: z
    .array(z.string())
    .optional()
    .describe("Specific entities to generate (all if omitted)"),
  outputDir: z.string().optional().describe("Output directory (default: src/generated)"),
  dryRun: z.boolean().default(false).describe("Preview without writing files"),
});

/**
 * Input for client setup tool
 */
export const SetupClientInputSchema = z.object({
  client: ClientTargetSchema.describe("Target client to configure"),
  serverPath: z.string().optional().describe("Path to MCP server (auto-detected if omitted)"),
  options: z.record(z.string()).optional().describe("Client-specific options"),
});

/**
 * Input for setup verification tool
 */
export const SetupVerifyInputSchema = z.object({
  client: ClientTargetSchema.optional().describe("Specific client to verify (all if omitted)"),
  verbose: z.boolean().default(false).describe("Include detailed diagnostics"),
});

// =============================================================================
// Type Exports
// =============================================================================

export type PropertyType = z.infer<typeof PropertyTypeSchema>;
export type PropertyDefinition = z.infer<typeof PropertyDefinitionSchema>;
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
export type RelationshipDefinition = z.infer<typeof RelationshipDefinitionSchema>;
export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;
export type DomainModel = z.infer<typeof DomainModelSchema>;
export type GenerationTier = z.infer<typeof GenerationTierSchema>;
export type ClientTarget = z.infer<typeof ClientTargetSchema>;
export type ToolkitState = z.infer<typeof ToolkitStateSchema>;
export type EntityInput = z.infer<typeof EntityInputSchema>;
export type ModelDesignInput = z.infer<typeof ModelDesignInputSchema>;
export type ModelImportInput = z.infer<typeof ModelImportInputSchema>;
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type SetupClientInput = z.infer<typeof SetupClientInputSchema>;
export type SetupVerifyInput = z.infer<typeof SetupVerifyInputSchema>;
