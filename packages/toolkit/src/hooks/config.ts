/**
 * Toolkit Config Hook
 *
 * The first phase of the toolkit workflow. This hook is BLOCKING -
 * all other toolkit tools are blocked until configuration is complete.
 *
 * Demonstrates:
 * - Blocking hooks that enforce workflow order
 * - Elicitation for gathering user input
 * - Config storage and persistence
 */

import type { HookDefinitionInput } from "@mcp-toolkit/core";

/**
 * Hook ID for the config hook (used for dependency references)
 */
export const CONFIG_HOOK_ID = "mcp-toolkit:config:start:config";

/**
 * Config hook definition
 *
 * This hook:
 * - Fires at session start (lifecycle: "start")
 * - Is blocking (blocks all toolkit:* tools until complete)
 * - Has MUST requirement level (cannot be skipped)
 * - Gathers: project name, purpose, domain, feature flags
 */
export const configHook: HookDefinitionInput = {
  app: "mcp-toolkit",
  tag: "config",
  type: "config",
  lifecycle: "start",
  name: "Toolkit Configuration",
  description:
    "Gather project configuration before proceeding with the toolkit workflow. This hook blocks all other toolkit operations until complete.",
  requirementLevel: "MUST",
  priority: 100, // Highest priority - runs first
  blocking: true, // Blocks toolkit:* tools until complete
  tags: ["toolkit", "config", "blocking", "onboarding"],
};

/**
 * Configuration schema for elicitation
 *
 * Defines the fields gathered during the config phase.
 */
export interface ToolkitConfig {
  /** Project name in kebab-case */
  projectName: string;
  /** What the MCP server will be used for */
  purpose: string;
  /** Primary domain/industry */
  domain: string;
  /** Enable tools feature */
  enableTools: boolean;
  /** Enable resources feature */
  enableResources: boolean;
  /** Enable prompts feature */
  enablePrompts: boolean;
  /** Enable sampling feature */
  enableSampling: boolean;
}

/**
 * Default configuration values
 */
export const defaultToolkitConfig: Partial<ToolkitConfig> = {
  enableTools: true,
  enableResources: true,
  enablePrompts: false,
  enableSampling: false,
};
