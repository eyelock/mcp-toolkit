/**
 * @mcp-toolkit/model - Zod schemas as the single source of truth
 *
 * All schemas are defined here with .describe() for self-documentation.
 * Input schemas are derived via .pick(), .extend(), .partial() - never manually redefined.
 */

import { z } from "zod";
import { ClientMetadataSchema, ToolDelegationConfigSchema } from "./strategy.js";

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
    prompts: z.boolean().default(true).describe("Enable MCP prompts for this session"),
    sampling: z.boolean().default(true).describe("Enable MCP sampling for this session"),
  })
  .describe("MCP features to enable for the session");

/**
 * Full session configuration schema
 */
export const SessionConfigSchema = z
  .object({
    sessionId: z
      .string()
      .min(1)
      .describe(
        "Unique identifier for this session. Under the stateless protocol this is the explicit handle: the server mints it, returns it, and clients thread it back on subsequent calls."
      ),
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
    toolDelegations: ToolDelegationConfigSchema.describe("Per-tool delegation configuration"),
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
 * The session handle, as it travels on a request.
 *
 * Under the stateless protocol a tool that operates on an existing session must
 * be told which one. The server mints the handle in `session_init` and returns
 * it; the model threads it back here. Optional so that single-session
 * transports (stdio) can fall back to a process default.
 */
export const SessionHandleSchema = z.object({
  session_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Session handle returned by session_init. Required when the server serves more than one session (HTTP); optional over stdio, which has a single session per process."
    ),
});

/**
 * Input schema for session storage.
 *
 * Derived from the tool input by dropping `discoverClient`, which asks whether
 * the *tool* should discover client metadata via sampling. That is a tool
 * concern; by the time a session reaches storage the question is already
 * answered, so the storage layer never sees it.
 */
export const SessionCreateInputSchema = SessionInitInputSchema.omit({
  discoverClient: true,
});

/**
 * Input schema for session update
 * Partial version of the config - all fields optional.
 *
 * `sessionId` is omitted: the handle identifies which session to update and is
 * therefore an argument to the provider, never a mutable field.
 *
 * `features` is re-declared as partial because providers *merge* features
 * rather than replacing them - without this, changing one flag would demand
 * restating all four.
 */
export const SessionUpdateInputSchema = SessionConfigSchema.omit({
  sessionId: true,
  createdAt: true,
})
  .partial()
  .extend({
    features: SessionFeaturesSchema.partial()
      .optional()
      .describe("Features to change; unspecified features keep their current value"),
  });

// =============================================================================
// Type Exports
// =============================================================================

export type ServerTags = z.infer<typeof ServerTagsSchema>;
export type ServerIdentity = z.infer<typeof ServerIdentitySchema>;
export type SessionFeatures = z.infer<typeof SessionFeaturesSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type SessionInitInput = z.infer<typeof SessionInitInputSchema>;
export type SessionCreateInput = z.infer<typeof SessionCreateInputSchema>;
export type SessionHandle = z.infer<typeof SessionHandleSchema>;
export type SessionUpdateInput = z.infer<typeof SessionUpdateInputSchema>;

// =============================================================================
// Schema Conversion
// =============================================================================

/**
 * Re-export zodToJsonSchema for convenience.
 * Use this to convert Zod schemas to JSON Schema for MCP tool definitions.
 *
 * @example
 * ```typescript
 * import { zodToJsonSchema, SessionInitInputSchema } from "@mcp-toolkit/model";
 *
 * const tool: Tool = {
 *   name: "session_init",
 *   inputSchema: zodToJsonSchema(SessionInitInputSchema) as Tool["inputSchema"],
 * };
 * ```
 */
export { zodToJsonSchema } from "zod-to-json-schema";
