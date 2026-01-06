/**
 * Sampling Patterns
 *
 * Examples of how to use MCP sampling to request LLM completions.
 * Sampling allows the server to ask the client's LLM for help with tasks.
 *
 * ## Message Roles
 *
 * - **role: "user"** - Represents a request from the human/user
 * - **role: "assistant"** - Represents context from the LLM/AI assistant
 *
 * Using role: "assistant" to provide context is powerful because it allows
 * the server to give the LLM relevant information before asking for help.
 * The LLM can then build on this context to provide better responses.
 *
 * Note: Sampling requires the client to support it and the session to have
 * the sampling feature enabled.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/client/sampling
 */

import type { CreateMessageRequest } from "@modelcontextprotocol/sdk/types.js";

/**
 * Create a sampling request for generating a project description
 *
 * This demonstrates the request format for sampling. The actual
 * request would be made through the server's sampling capability.
 */
export function createProjectDescriptionRequest(
  projectName: string
): CreateMessageRequest["params"] {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate a brief, professional description (2-3 sentences) for a software project named "${projectName}". The description should be suitable for a README file.`,
        },
      },
    ],
    maxTokens: 200,
  };
}

/**
 * Create a sampling request for suggesting feature configurations
 */
export function createFeatureSuggestionRequest(
  projectType: string
): CreateMessageRequest["params"] {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `For a ${projectType} project using MCP Toolkit, suggest which features should be enabled.

Available features:
- tools: Enable callable tools
- resources: Enable data resources
- prompts: Enable prompt templates
- sampling: Enable LLM completion requests

Respond with a JSON object like: {"tools": true, "resources": true, "prompts": false, "sampling": false}
Only respond with the JSON, no other text.`,
        },
      },
    ],
    maxTokens: 100,
  };
}

/**
 * Parse a feature suggestion response
 */
export function parseFeatureSuggestion(responseText: string): Record<string, boolean> | null {
  try {
    return JSON.parse(responseText);
  } catch {
    return null;
  }
}

// ============================================================================
// Role: Assistant Examples (Context-Aware Sampling)
// ============================================================================

/**
 * Session summary entry for summarization
 */
export interface SessionEntry {
  type: string;
  timestamp: string;
  description: string;
  outcome?: "success" | "partial" | "failure";
  metadata?: Record<string, unknown>;
}

/**
 * Summary format types
 */
export type SummaryFormat = "standup" | "handoff" | "weekly" | "custom";

/**
 * Create a sampling request for summarizing session activity
 *
 * This demonstrates the role: "assistant" pattern where the server provides
 * context to the LLM before asking for help. The assistant message contains
 * the session data, and the LLM builds on this to generate a summary.
 *
 * @param entries - Session entries to summarize
 * @param format - Summary format (standup, handoff, weekly, custom)
 * @param customPrompt - Custom prompt for 'custom' format
 *
 * @example
 * ```typescript
 * const entries = [
 *   { type: "task", timestamp: "2024-01-15T10:00:00Z", description: "Fixed login bug", outcome: "success" },
 *   { type: "review", timestamp: "2024-01-15T11:00:00Z", description: "Code review for PR #123" }
 * ];
 *
 * const request = createSessionSummaryRequest(entries, "standup");
 * const result = await server.sampling.createMessage(request);
 * ```
 */
export function createSessionSummaryRequest(
  entries: SessionEntry[],
  format: SummaryFormat = "standup",
  customPrompt?: string
): CreateMessageRequest["params"] {
  // Format entries as structured context
  const entriesContext = entries
    .map((e) => {
      const outcome = e.outcome ? ` [${e.outcome}]` : "";
      return `- [${e.type}] ${e.timestamp}: ${e.description}${outcome}`;
    })
    .join("\n");

  // Build format-specific instructions
  let formatInstructions: string;
  switch (format) {
    case "standup":
      formatInstructions = `Generate a brief daily standup update covering:
- What was accomplished
- Any blockers or issues
- What's next

Keep it concise (3-5 bullet points total).`;
      break;
    case "handoff":
      formatInstructions = `Generate a developer handoff summary including:
- Current state of work
- Important context for the next developer
- Any pending decisions or open questions
- Recommended next steps

Be thorough but organized.`;
      break;
    case "weekly":
      formatInstructions = `Generate a weekly progress report including:
- Key accomplishments
- Challenges faced and how they were addressed
- Metrics if applicable (tasks completed, etc.)
- Goals for next week

Format professionally for stakeholder communication.`;
      break;
    case "custom":
      formatInstructions = customPrompt ?? "Summarize the session activity.";
      break;
  }

  return {
    messages: [
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I have access to the following session activity data:

${entriesContext}

I'll analyze this activity to provide a helpful summary.`,
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: formatInstructions,
        },
      },
    ],
    maxTokens: 500,
  };
}

/**
 * Create a sampling request for code review assistance
 *
 * Demonstrates providing code context via role: "assistant" and asking
 * the LLM to review it.
 *
 * @param code - The code to review
 * @param language - Programming language
 * @param focus - What to focus on (security, performance, readability)
 */
export function createCodeReviewRequest(
  code: string,
  language: string,
  focus: "security" | "performance" | "readability" | "all" = "all"
): CreateMessageRequest["params"] {
  const focusInstructions = {
    security: "Focus on security vulnerabilities, input validation, and potential exploits.",
    performance: "Focus on performance bottlenecks, unnecessary operations, and optimization opportunities.",
    readability: "Focus on code clarity, naming conventions, and maintainability.",
    all: "Review for security, performance, and readability issues.",
  };

  return {
    messages: [
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'm reviewing the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

I'll analyze this code carefully.`,
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: `Please review this code. ${focusInstructions[focus]}

Provide specific, actionable feedback with line references where applicable.
Format as a bulleted list of findings.`,
        },
      },
    ],
    maxTokens: 1000,
  };
}

/**
 * Create a sampling request for explaining a concept
 *
 * Demonstrates using role: "assistant" to establish expertise context.
 *
 * @param concept - The concept to explain
 * @param audience - Target audience level
 */
export function createExplanationRequest(
  concept: string,
  audience: "beginner" | "intermediate" | "expert" = "intermediate"
): CreateMessageRequest["params"] {
  const audienceContext = {
    beginner: "I'll explain this in simple terms with analogies.",
    intermediate: "I'll provide a balanced explanation with some technical depth.",
    expert: "I'll focus on nuances and advanced considerations.",
  };

  return {
    messages: [
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I understand you want to learn about "${concept}". ${audienceContext[audience]}`,
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: `Explain "${concept}" to me. Include:
- A clear definition
- Key concepts
- A practical example
- Common pitfalls or misconceptions`,
        },
      },
    ],
    maxTokens: 800,
  };
}
