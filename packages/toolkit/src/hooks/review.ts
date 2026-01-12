/**
 * Toolkit Review Hook
 *
 * The fifth and final phase of the toolkit workflow. Guides the LLM
 * through reviewing the work and preparing for the next session.
 *
 * Demonstrates:
 * - End lifecycle hooks
 * - Summary generation
 * - Checkpoint and handoff patterns
 * - Looping back to earlier phases
 */

import type { HookDefinitionInput } from "@mcp-toolkit/core";
import { CONFIG_HOOK_ID } from "./config.js";

/**
 * Hook ID for the review hook
 */
export const REVIEW_HOOK_ID = "mcp-toolkit:session:end:review";

/**
 * Review hook definition
 *
 * This hook:
 * - Fires at session end (lifecycle: "end")
 * - Depends on config hook
 * - Summarizes work completed
 * - Identifies next steps
 * - Can loop back to model/plan phases
 */
export const reviewHook: HookDefinitionInput = {
  app: "mcp-toolkit",
  tag: "review",
  type: "session",
  lifecycle: "end",
  name: "Session Review",
  description:
    "Review the work completed, create a summary, and identify next steps. May loop back to Model or Plan phases.",
  requirementLevel: "SHOULD",
  priority: 100, // High priority at end
  dependencies: [CONFIG_HOOK_ID],
  tags: ["toolkit", "review", "summary", "onboarding"],
};

/**
 * Work item for tracking progress
 */
export interface WorkItem {
  /** Item description */
  description: string;
  /** Item status */
  status: "completed" | "in-progress" | "pending" | "blocked";
  /** Related files */
  files?: string[];
}

/**
 * Session summary
 */
export interface SessionSummary {
  /** Summary of work completed */
  completed: WorkItem[];
  /** Work in progress */
  inProgress: WorkItem[];
  /** Next steps for future sessions */
  nextSteps: string[];
  /** Suggested next phase */
  suggestedPhase?: "model" | "plan" | "build" | "review";
}
