/**
 * Prompts Registration
 *
 * Central registry for all MCP prompts, including toolkit prompts.
 */

import { getToolkitComponents, getToolkitHandlers } from "@mcp-toolkit/toolkit";
import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";
import {
  getSessionSetupPrompt,
  getWelcomePrompt,
  sessionSetupPrompt,
  welcomePrompt,
} from "./welcome.js";

// Get toolkit components and handlers
const toolkitComponents = getToolkitComponents();
const toolkitHandlers = getToolkitHandlers();

/**
 * All core prompts
 */
const corePrompts: Prompt[] = [welcomePrompt, sessionSetupPrompt];

/**
 * Prompt handlers mapped by name (core prompts only)
 */
const coreHandlers: Record<
  string,
  (args: Record<string, string> | undefined, context: ServerContext) => Promise<GetPromptResult>
> = {
  welcome: getWelcomePrompt,
  session_setup: getSessionSetupPrompt,
};

/**
 * Register all prompts (core + toolkit)
 */
export function registerPrompts(): Prompt[] {
  return [...corePrompts, ...toolkitComponents.prompts];
}

/**
 * Handle a get prompt request (core or toolkit)
 */
export async function handleGetPrompt(
  name: string,
  args: Record<string, string> | undefined,
  context: ServerContext
): Promise<GetPromptResult> {
  // First check if it's a toolkit prompt
  if (toolkitHandlers.isToolkitPrompt(name)) {
    const result = await toolkitHandlers.handlePrompt(name, args);
    if (result) {
      return result;
    }
  }

  // Then check core handlers
  const handler = coreHandlers[name];

  if (!handler) {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Unknown prompt: ${name}`,
          },
        },
      ],
    };
  }

  return handler(args, context);
}
