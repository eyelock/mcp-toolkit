/**
 * @mcp-toolkit/model - Zod schemas as the single source of truth
 *
 * All schemas are defined here with .describe() for self-documentation.
 * Input schemas are derived via .pick(), .extend(), .partial() - never manually redefined.
 */

import { z } from "zod";
import { ClientMetadataSchema, ToolStrategyConfigSchema } from "./strategy.js";

// =============================================================================
// Server Identity
// =============================================================================

/**
 * Server tags for metadata and discovery (similar to AWS/K8s tags)
 */
export const ServerTagsSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(63)
      .regex(
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        "Tag key must be lowercase alphanumeric with hyphens"
      ),
    z.string().max(255)
  )
  .default({})
  .describe("Key-value tags for server metadata (e.g., env=development, team=platform)");

/**
 * Server identity for distinguishing between server installations
 */
export const ServerIdentitySchema = z
  .object({
    canonicalName: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
      .describe("Canonical name that identifies this server across installations"),
    tags: ServerTagsSchema.describe("Key-value tags for server metadata"),
  })
  .describe("Server identity with canonical name and metadata tags");

// =============================================================================
// Session Configuration
// =============================================================================

/**
 * Features that can be enabled for a session
 */
export const SessionFeaturesSchema = z
  .object({
    tools: z.boolean().default(true).describe("Enable MCP tools for this session"),
    resources: z.boolean().default(true).describe("Enable MCP resources for this session"),
    prompts: z.boolean().default(false).describe("Enable MCP prompts for this session"),
    sampling: z.boolean().default(false).describe("Enable MCP sampling for this session"),
  })
  .describe("MCP features to enable for the session");

/**
 * Full session configuration schema
 */
export const SessionConfigSchema = z
  .object({
    projectName: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Must be kebab-case")
      .describe("Project name in kebab-case format"),
    features: SessionFeaturesSchema.describe("Enabled MCP features"),
    clientMetadata: ClientMetadataSchema.optional().describe(
      "Discovered or provided client/LLM metadata"
    ),
    toolStrategies: ToolStrategyConfigSchema.describe("Per-tool execution strategy overrides"),
    createdAt: z.string().datetime().describe("ISO 8601 timestamp of session creation"),
    updatedAt: z.string().datetime().describe("ISO 8601 timestamp of last update"),
  })
  .describe("Session configuration stored by the provider");

/**
 * Input schema for session initialization
 * Derived from SessionConfigSchema - never manually redefined
 */
export const SessionInitInputSchema = SessionConfigSchema.pick({
  projectName: true,
}).extend({
  features: SessionFeaturesSchema.partial()
    .optional()
    .describe("Features to enable (defaults will be applied for unspecified)"),
  clientMetadata: ClientMetadataSchema.optional().describe(
    "Optional client metadata. If not provided and sampling is available, will be discovered."
  ),
  discoverClient: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to attempt client discovery via sampling if metadata not provided"),
});

/**
 * Input schema for session update
 * Partial version of the config - all fields optional
 */
export const SessionUpdateInputSchema = SessionConfigSchema.omit({
  createdAt: true,
}).partial();

// =============================================================================
// Type Exports
// =============================================================================

export type ServerTags = z.infer<typeof ServerTagsSchema>;
export type ServerIdentity = z.infer<typeof ServerIdentitySchema>;
export type SessionFeatures = z.infer<typeof SessionFeaturesSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type SessionInitInput = z.infer<typeof SessionInitInputSchema>;
export type SessionUpdateInput = z.infer<typeof SessionUpdateInputSchema>;

// =============================================================================
// Schema Metadata Helpers
// =============================================================================

/**
 * Extract JSON Schema from a Zod schema for MCP tool definitions
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Use zod-to-json-schema in production, simplified version here
  return schema._def as unknown as Record<string, unknown>;
}
