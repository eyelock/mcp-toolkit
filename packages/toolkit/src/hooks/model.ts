/**
 * Toolkit Model Hook
 *
 * The second phase of the toolkit workflow. Guides the LLM through
 * designing the domain model for the MCP server.
 *
 * Demonstrates:
 * - Hook dependencies (requires config to complete first)
 * - Resources for providing templates and schemas
 * - JSON schema definitions
 */

import type { HookDefinitionInput } from "@mcp-toolkit/core";
import { CONFIG_HOOK_ID } from "./config.js";

/**
 * Hook ID for the model hook
 */
export const MODEL_HOOK_ID = "mcp-toolkit:session:start:model";

/**
 * Model hook definition
 *
 * This hook:
 * - Fires at session start (lifecycle: "start")
 * - Depends on config hook (won't activate until config completes)
 * - Guides domain model design (entities, relationships, schemas)
 * - Has SHOULD requirement level (recommended but not mandatory)
 */
export const modelHook: HookDefinitionInput = {
  app: "mcp-toolkit",
  tag: "model",
  type: "session",
  lifecycle: "start",
  name: "Domain Model Design",
  description:
    "Guide the design of core entities, relationships, and schemas for the MCP server. Activates after configuration is complete.",
  requirementLevel: "SHOULD",
  priority: 90, // After config
  dependencies: [CONFIG_HOOK_ID],
  tags: ["toolkit", "model", "design", "onboarding"],
};

/**
 * Entity definition for domain modeling
 */
export interface EntityDefinition {
  /** Entity name (PascalCase) */
  name: string;
  /** Description of the entity */
  description: string;
  /** Entity properties */
  properties: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
  }>;
  /** Relationships to other entities */
  relationships?: Array<{
    target: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
    description?: string;
  }>;
}

/**
 * Domain model definition
 */
export interface DomainModel {
  /** Model name */
  name: string;
  /** Model description */
  description: string;
  /** Entities in the model */
  entities: EntityDefinition[];
}
