/**
 * Toolkit Hook Definitions
 *
 * This module exports all hook definitions for the toolkit workflow.
 * The workflow guides developers through customizing their MCP Toolkit instance.
 *
 * Workflow phases:
 * 1. Config (blocking) - Gather project configuration
 * 2. Model - Design domain model
 * 3. Plan - Create implementation plan
 * 4. Build - Implement tools, resources, prompts
 * 5. Review - Summarize and identify next steps
 */

// Individual hook exports
export {
  CONFIG_HOOK_ID,
  configHook,
  type ToolkitConfig,
  defaultToolkitConfig,
} from "./config.js";

export {
  MODEL_HOOK_ID,
  modelHook,
  type EntityDefinition,
  type DomainModel,
} from "./model.js";

export {
  PLAN_HOOK_ID,
  planHook,
  type ImplementationPhase,
  type ImplementationPlan,
} from "./plan.js";

export {
  BUILD_HOOK_ID,
  buildHook,
  type ToolGuidance,
  type ResourceGuidance,
  type PromptGuidance,
} from "./build.js";

export {
  REVIEW_HOOK_ID,
  reviewHook,
  type WorkItem,
  type SessionSummary,
} from "./review.js";

import type { HookDefinitionInput } from "@mcp-toolkit/core";
import { configHook, CONFIG_HOOK_ID } from "./config.js";
import { modelHook } from "./model.js";
import { planHook } from "./plan.js";
import { buildHook } from "./build.js";
import { reviewHook } from "./review.js";
import type { BlockingHookDef } from "@mcp-toolkit/mcp";

/**
 * All toolkit hook definitions in workflow order
 */
export const allToolkitHooks: HookDefinitionInput[] = [
  configHook,
  modelHook,
  planHook,
  buildHook,
  reviewHook,
];

/**
 * Config phase hooks only
 */
export const configHooks: HookDefinitionInput[] = [configHook];

/**
 * Model phase hooks only
 */
export const modelHooks: HookDefinitionInput[] = [modelHook];

/**
 * Plan phase hooks only
 */
export const planHooks: HookDefinitionInput[] = [planHook];

/**
 * Build phase hooks only
 */
export const buildHooks: HookDefinitionInput[] = [buildHook];

/**
 * Review phase hooks only
 */
export const reviewHooks: HookDefinitionInput[] = [reviewHook];

/**
 * Blocking hook definitions for workflow enforcement
 *
 * These are registered with the WorkflowStateTracker to enforce
 * that config must complete before other toolkit tools can run.
 */
export const toolkitBlockingHooks: BlockingHookDef[] = [
  {
    hookId: CONFIG_HOOK_ID,
    toolPrefix: "toolkit:",
    name: "Toolkit Configuration",
    blockMessage:
      "You must complete the toolkit configuration workflow before using toolkit tools. " +
      "The config hook gathers project name, purpose, domain, and feature flags.",
  },
];
