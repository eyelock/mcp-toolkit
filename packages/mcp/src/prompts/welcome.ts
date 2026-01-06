/**
 * Welcome Prompt
 *
 * Provides context-aware prompts for the MCP client.
 */

import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";

/**
 * Welcome prompt definition
 */
export const welcomePrompt: Prompt = {
  name: "welcome",
  description: "Get a welcome message with session context and available capabilities",
  arguments: [
    {
      name: "include_examples",
      description: "Include example commands in the response",
      required: false,
    },
  ],
};

/**
 * Generate the welcome prompt
 */
export async function getWelcomePrompt(
  args: Record<string, string> | undefined,
  context: ServerContext
): Promise<GetPromptResult> {
  const includeExamples = args?.include_examples === "true";
  const session = await context.provider.getSession();

  let message = `# MCP Toolkit

Welcome to MCP Toolkit! This server provides tools, resources, and prompts for managing your project session.

`;

  if (session.data) {
    const enabledFeatures = Object.entries(session.data.features)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    message += `## Current Session

- **Project**: ${session.data.projectName}
- **Features**: ${enabledFeatures.join(", ") || "none enabled"}
- **Created**: ${session.data.createdAt}

`;
  } else {
    message += `## Getting Started

No session is currently active. Initialize one using the \`session_init\` tool:

\`\`\`
session_init({ projectName: "my-project" })
\`\`\`

`;
  }

  message += `## Available Tools

- **session_init**: Initialize a new session
- **session_update**: Update session configuration
- **session_status**: View current session
- **session_clear**: Clear the session

## Available Resources

- **session://current**: Current session configuration (JSON)

`;

  if (includeExamples) {
    message += `## Examples

### Initialize with custom features
\`\`\`
session_init({
  projectName: "my-api-server",
  features: {
    tools: true,
    resources: true,
    prompts: true,
    sampling: false
  }
})
\`\`\`

### Update project name
\`\`\`
session_update({ projectName: "renamed-project" })
\`\`\`

### Enable a feature
\`\`\`
session_update({ features: { sampling: true } })
\`\`\`
`;
  }

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: message,
        },
      },
    ],
  };
}

/**
 * Session setup prompt for guided initialization
 */
export const sessionSetupPrompt: Prompt = {
  name: "session_setup",
  description: "Guide the user through setting up a new session with interactive questions",
  arguments: [],
};

export async function getSessionSetupPrompt(
  _args: Record<string, string> | undefined,
  context: ServerContext
): Promise<GetPromptResult> {
  const hasSession = await context.provider.hasSession();

  if (hasSession) {
    const session = await context.provider.getSession();
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `A session already exists for project "${session.data?.projectName}". Would you like to update it or clear it and start fresh?`,
          },
        },
      ],
    };
  }

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Let's set up your MCP Toolkit session!

Please answer the following questions:

1. **Project Name**: What is your project name? (kebab-case, e.g., "my-api-server")

2. **Features**: Which MCP features would you like enabled?
   - Tools (recommended): Allow the server to provide callable tools
   - Resources (recommended): Allow the server to expose data resources
   - Prompts: Allow the server to provide prompt templates
   - Sampling: Allow the server to request LLM completions

Once you provide the project name, I'll initialize the session for you.`,
        },
      },
    ],
  };
}
