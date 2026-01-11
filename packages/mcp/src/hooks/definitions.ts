/**
 * MCP Toolkit Core Hook Definitions
 *
 * Defines the core session lifecycle hooks that provide guidance for
 * LLM interactions with the MCP server.
 */

import type { HookDefinitionInput } from "@mcp-toolkit/core";

/**
 * Core session start hook - provides initial guidance when a session begins.
 *
 * This hook is triggered at the start of a new session and includes:
 * - Server identity and capabilities
 * - Session initialization requirements
 * - Ping/status response expectations
 * - Initial workflow guidance
 */
export const sessionStartCoreHook: HookDefinitionInput = {
  tag: "session-start-core",
  type: "session",
  lifecycle: "start",
  name: "Session Initialization",
  description:
    "Core guidance for session initialization including server status, ping handling, and workflow setup",
  requirementLevel: "MUST",
  priority: 100, // High priority - runs first
  contentFile: "core.md",
};

/**
 * Core session end hook - provides guidance when a session is ending.
 *
 * This hook is triggered at the end of a session and includes:
 * - Context preservation guidance
 * - Cleanup requirements
 * - Handoff information
 * - Summary generation guidance
 */
export const sessionEndCoreHook: HookDefinitionInput = {
  tag: "session-end-core",
  type: "session",
  lifecycle: "end",
  name: "Session Completion",
  description:
    "Core guidance for session completion including context handoff, cleanup, and summary generation",
  requirementLevel: "SHOULD",
  priority: 100, // High priority - runs first
  contentFile: "session-end-core.md",
};

/**
 * All core hook definitions
 */
export const coreHookDefinitions: HookDefinitionInput[] = [
  sessionStartCoreHook,
  sessionEndCoreHook,
];
