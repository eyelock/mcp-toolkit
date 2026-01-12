/**
 * Toolkit Prompts Registration
 *
 * Central registry for all toolkit MCP prompts.
 */

import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import {
  designEntityPrompt,
  designStartPrompt,
  getDesignEntityPrompt,
  getDesignStartPrompt,
} from "./design-guide.js";
import { getSetupGuidePrompt, setupGuidePrompt } from "./setup-guide.js";

// Re-export individual prompts
export * from "./design-guide.js";
export * from "./setup-guide.js";

/**
 * All toolkit prompts
 */
export const toolkitPrompts: Prompt[] = [
  designStartPrompt,
  designEntityPrompt,
  setupGuidePrompt,
];

/**
 * Prompt name to handler mapping
 */
const handlers: Record<
  string,
  (args: Record<string, string> | undefined) => Promise<GetPromptResult>
> = {
  "toolkit-design-start": getDesignStartPrompt,
  "toolkit-design-entity": getDesignEntityPrompt,
  "toolkit-setup-guide": getSetupGuidePrompt,
};

/**
 * Get all toolkit prompts for registration
 */
export function registerToolkitPrompts(): Prompt[] {
  return toolkitPrompts;
}

/**
 * Handle a toolkit prompt request
 */
export async function handleToolkitPrompt(
  name: string,
  args: Record<string, string> | undefined
): Promise<GetPromptResult | null> {
  const handler = handlers[name];

  if (!handler) {
    return null; // Not a toolkit prompt
  }

  return handler(args);
}

/**
 * Check if a prompt name is a toolkit prompt
 */
export function isToolkitPrompt(name: string): boolean {
  return name.startsWith("toolkit-");
}
