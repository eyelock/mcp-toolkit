/**
 * Prompts Registration
 *
 * Central registry for all MCP prompts.
 */

import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";
import {
  getSessionSetupPrompt,
  getWelcomePrompt,
  sessionSetupPrompt,
  welcomePrompt,
} from "./welcome.js";

/**
 * All available prompts
 */
const prompts: Prompt[] = [welcomePrompt, sessionSetupPrompt];

/**
 * Prompt handlers mapped by name
 */
const handlers: Record<
  string,
  (args: Record<string, string> | undefined, context: ServerContext) => Promise<GetPromptResult>
> = {
  welcome: getWelcomePrompt,
  session_setup: getSessionSetupPrompt,
};

/**
 * Register all prompts
 */
export function registerPrompts(): Prompt[] {
  return prompts;
}

/**
 * Handle a get prompt request
 */
export async function handleGetPrompt(
  name: string,
  args: Record<string, string> | undefined,
  context: ServerContext
): Promise<GetPromptResult> {
  const handler = handlers[name];

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
