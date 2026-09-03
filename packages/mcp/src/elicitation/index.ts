/**
 * Elicitation Module
 *
 * Requesting structured input from users, for workflows where the LLM does not
 * have everything it needs.
 *
 * ## Key Concepts
 *
 * - **Pull, not push**: `2026-07-28` removed server-to-client requests. A
 *   handler *returns* a description of what it needs and is called again with
 *   the answers, so any instance can serve the retry.
 * - **Read first, ask second**: every helper checks for an answer already
 *   supplied before asking for one, so a handler is written once and runs on
 *   both rounds.
 * - **Typed responses**: results are typed from the schema you provide, and
 *   validated before they reach you.
 *
 * ## Usage Examples
 *
 * ### Confirmation
 * ```typescript
 * import { elicitConfirmation } from "./elicitation/index.js";
 *
 * export async function handleDelete(args, context) {
 *   const confirm = elicitConfirmation(context, "confirm", "Delete this item?");
 *   if (confirm.status === "pending") {
 *     return confirm.result;
 *   }
 *   if (!confirm.value) {
 *     return { content: [{ type: "text", text: "Cancelled." }] };
 *   }
 *   return doDelete(args);
 * }
 * ```
 *
 * ### Text input
 * ```typescript
 * const name = elicitText(context, "name", "What is your name?", {
 *   description: "Enter your full name",
 * });
 * if (name.status === "pending") return name.result;
 * // name.value is a string
 * ```
 *
 * ### Choice from options
 * ```typescript
 * const priority = elicitChoice(context, "priority", "Select priority:", [
 *   { value: "low", label: "Low" },
 *   { value: "medium", label: "Medium" },
 *   { value: "high", label: "High" },
 * ]);
 * if (priority.status === "pending") return priority.result;
 * // priority.value is "low" | "medium" | "high"
 * ```
 *
 * ### Custom form
 * ```typescript
 * interface TaskInput extends Record<string, unknown> {
 *   title: string;
 *   priority: "low" | "medium" | "high";
 * }
 *
 * const task = elicitInput<TaskInput>(context, "task", "Create a new task:", {
 *   type: "object",
 *   properties: {
 *     title: { type: "string", title: "Title", minLength: 1 },
 *     priority: { type: "string", title: "Priority", enum: ["low", "medium", "high"] },
 *   },
 *   required: ["title", "priority"],
 * });
 * if (task.status === "pending") return task.result;
 * console.log(`Creating task: ${task.value.title}`);
 * ```
 *
 * ### Several questions in one round trip
 * ```typescript
 * import { readResponse, requestInput } from "./elicitation/index.js";
 * import { inputRequired } from "@modelcontextprotocol/server";
 *
 * const name = readResponse<{ value: string }>(context, "name");
 * const team = readResponse<{ value: string }>(context, "team");
 * if (!name || !team) {
 *   return requestInput({
 *     name: inputRequired.elicit({ message: "Your name?", requestedSchema: textSchema }),
 *     team: inputRequired.elicit({ message: "Your team?", requestedSchema: textSchema }),
 *   });
 * }
 * ```
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28
 */

// Core helpers
export {
  // Capability check
  canElicit,
  carryForward,
  choiceRequest,
  confirmationRequest,
  ElicitationDeclinedError,
  // Errors
  ElicitationNotSupportedError,
  type ElicitationSchema,
  type ElicitOptions,
  // Outcome type - handlers branch on `status`
  type ElicitOutcome,
  elicitAll,
  elicitChoice,
  elicitConfirmation,
  // Main functions
  elicitInput,
  elicitText,
  // Lower-level building blocks
  readResponse,
  requestInput,
  textRequest,
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
