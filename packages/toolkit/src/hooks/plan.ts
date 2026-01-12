/**
 * Toolkit Plan Hook
 *
 * The third phase of the toolkit workflow. Guides the LLM through
 * creating an implementation plan for the MCP server.
 *
 * Demonstrates:
 * - Action hooks that fire during work
 * - Plan approval workflow
 * - Dependency tracking
 */

import type { HookDefinitionInput } from "@mcp-toolkit/core";
import { CONFIG_HOOK_ID } from "./config.js";

/**
 * Hook ID for the plan hook
 */
export const PLAN_HOOK_ID = "mcp-toolkit:action:running:plan";

/**
 * Plan hook definition
 *
 * This hook:
 * - Fires during action (lifecycle: "running")
 * - Depends on config hook
 * - Guides implementation planning
 * - Includes approval workflow before execution
 */
export const planHook: HookDefinitionInput = {
  app: "mcp-toolkit",
  tag: "plan",
  type: "action",
  lifecycle: "running",
  name: "Implementation Planning",
  description:
    "Guide the creation of an implementation plan for the MCP server. Includes approval workflow before proceeding.",
  requirementLevel: "SHOULD",
  priority: 80,
  dependencies: [CONFIG_HOOK_ID],
  tags: ["toolkit", "plan", "implementation", "onboarding"],
};

/**
 * Implementation phase definition
 */
export interface ImplementationPhase {
  /** Phase name */
  name: string;
  /** Phase description */
  description: string;
  /** Tasks in this phase */
  tasks: string[];
  /** Files affected by this phase */
  files?: string[];
  /** Estimated complexity (1-5) */
  complexity?: number;
}

/**
 * Implementation plan definition
 */
export interface ImplementationPlan {
  /** Plan title */
  title: string;
  /** Plan summary */
  summary: string;
  /** Implementation phases */
  phases: ImplementationPhase[];
  /** Files to create */
  filesToCreate: string[];
  /** Files to modify */
  filesToModify: string[];
  /** External dependencies to add */
  dependencies: string[];
}
