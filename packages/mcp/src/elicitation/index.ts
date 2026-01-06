/**
 * Elicitation Module
 *
 * Provides utilities for interactive user input via MCP elicitation.
 *
 * Elicitation enables servers to request structured input from users through
 * the client, allowing for interactive workflows where the LLM doesn't have
 * all the necessary information.
 *
 * ## Key Concepts
 *
 * - **Form-based elicitation**: Server sends a JSON schema, client presents a form
 * - **Typed responses**: Results are typed based on the schema you provide
 * - **User actions**: Users can accept (submit), decline, or cancel
 *
 * ## Usage Examples
 *
 * ### Simple text input
 * ```typescript
 * import { elicitText } from "./elicitation/index.js";
 *
 * const name = await elicitText(server, "What is your name?", {
 *   title: "Name",
 *   description: "Enter your full name"
 * });
 * ```
 *
 * ### Confirmation dialog
 * ```typescript
 * import { elicitConfirmation } from "./elicitation/index.js";
 *
 * const { confirmed } = await elicitConfirmation(
 *   server,
 *   "Are you sure you want to delete this item?"
 * );
 * ```
 *
 * ### Choice from options
 * ```typescript
 * import { elicitChoice } from "./elicitation/index.js";
 *
 * const priority = await elicitChoice(server, "Select priority:", [
 *   { value: "low", label: "Low" },
 *   { value: "medium", label: "Medium" },
 *   { value: "high", label: "High" }
 * ]);
 * ```
 *
 * ### Custom form
 * ```typescript
 * import { elicitInput } from "./elicitation/index.js";
 *
 * interface TaskInput {
 *   title: string;
 *   description?: string;
 *   priority: "low" | "medium" | "high";
 * }
 *
 * const result = await elicitInput<TaskInput>(server, "Create a new task:", {
 *   type: "object",
 *   properties: {
 *     title: { type: "string", title: "Title", minLength: 1 },
 *     description: { type: "string", title: "Description" },
 *     priority: {
 *       type: "string",
 *       title: "Priority",
 *       enum: ["low", "medium", "high"],
 *       default: "medium"
 *     }
 *   },
 *   required: ["title", "priority"]
 * });
 *
 * if (result.action === "accept" && result.content) {
 *   console.log(`Creating task: ${result.content.title}`);
 * }
 * ```
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation
 */

// Core helpers
export {
  // Main functions
  elicitInput,
  elicitConfirmation,
  elicitText,
  elicitChoice,
  // Utility functions
  clientSupportsElicitation,
  getElicitationTimeout,
  // Constants
  DEFAULT_ELICITATION_TIMEOUT_MS,
  // Types
  type TypedElicitResult,
  type ElicitOptions,
  type ElicitationSchema,
  // Errors
  ElicitationNotSupportedError,
  ElicitationDeclinedError,
  ElicitationValidationError,
} from "./helpers.js";

/**
 * Example elicitation schemas for common use cases
 */
export const EXAMPLE_SCHEMAS = {
  /**
   * Schema for getting user confirmation
   */
  confirmation: {
    type: "object" as const,
    properties: {
      confirm: {
        type: "boolean" as const,
        title: "Confirm",
        description: "Confirm this action?",
      },
      reason: {
        type: "string" as const,
        title: "Reason",
        description: "Optional reason for your decision",
      },
    },
    required: ["confirm"],
  },

  /**
   * Schema for getting user feedback
   */
  feedback: {
    type: "object" as const,
    properties: {
      rating: {
        type: "string" as const,
        title: "Rating",
        description: "How would you rate this?",
        enum: ["poor", "fair", "good", "excellent"],
        enumNames: ["Poor", "Fair", "Good", "Excellent"],
      },
      comments: {
        type: "string" as const,
        title: "Comments",
        description: "Any additional comments?",
        maxLength: 1000,
      },
    },
    required: ["rating"],
  },

  /**
   * Schema for task creation
   */
  task: {
    type: "object" as const,
    properties: {
      title: {
        type: "string" as const,
        title: "Title",
        description: "Task title",
        minLength: 1,
        maxLength: 200,
      },
      description: {
        type: "string" as const,
        title: "Description",
        description: "Detailed description of the task",
      },
      priority: {
        type: "string" as const,
        title: "Priority",
        description: "Task priority level",
        enum: ["low", "medium", "high", "critical"],
        enumNames: ["Low", "Medium", "High", "Critical"],
        default: "medium",
      },
    },
    required: ["title"],
  },

  /**
   * Schema for configuration options
   */
  config: {
    type: "object" as const,
    properties: {
      enabled: {
        type: "boolean" as const,
        title: "Enabled",
        description: "Enable this feature?",
        default: true,
      },
      timeout: {
        type: "integer" as const,
        title: "Timeout (seconds)",
        description: "Timeout in seconds",
        minimum: 1,
        maximum: 3600,
        default: 30,
      },
      mode: {
        type: "string" as const,
        title: "Mode",
        enum: ["development", "staging", "production"],
        enumNames: ["Development", "Staging", "Production"],
        default: "development",
      },
    },
  },
};
