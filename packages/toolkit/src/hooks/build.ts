/**
 * Toolkit Build Hook
 *
 * The fourth phase of the toolkit workflow. Guides the LLM through
 * implementing the MCP server components.
 *
 * Demonstrates:
 * - Action hooks for ongoing guidance
 * - Tool, resource, and prompt implementation patterns
 * - Code generation guidance
 */

import type { HookDefinitionInput } from "@mcp-toolkit/core";
import { CONFIG_HOOK_ID } from "./config.js";

/**
 * Hook ID for the build hook
 */
export const BUILD_HOOK_ID = "mcp-toolkit:action:running:build";

/**
 * Build hook definition
 *
 * This hook:
 * - Fires during action (lifecycle: "running")
 * - Depends on config hook
 * - Guides implementation of tools, resources, prompts
 * - Provides patterns and best practices
 */
export const buildHook: HookDefinitionInput = {
  app: "mcp-toolkit",
  tag: "build",
  type: "action",
  lifecycle: "running",
  name: "Build Guidance",
  description:
    "Guide the implementation of MCP tools, resources, and prompts. Provides patterns and best practices.",
  requirementLevel: "MAY",
  priority: 70,
  dependencies: [CONFIG_HOOK_ID],
  tags: ["toolkit", "build", "implementation", "onboarding"],
};

/**
 * MCP Tool definition guidance
 */
export interface ToolGuidance {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema properties */
  inputSchema: Record<string, unknown>;
  /** Example usage */
  example?: string;
}

/**
 * MCP Resource definition guidance
 */
export interface ResourceGuidance {
  /** Resource URI template */
  uriTemplate: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * MCP Prompt definition guidance
 */
export interface PromptGuidance {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description: string;
  /** Arguments */
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}
