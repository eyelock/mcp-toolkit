/**
 * Elicitation Helpers for MCP
 *
 * Provides utilities for requesting user input through MCP elicitation.
 * Elicitation allows the server to gather structured input from users
 * mid-operation, enabling interactive workflows.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { logDebug, logError, logWarning } from "../logging.js";

/**
 * Default timeout for elicitation requests (5 minutes).
 * Generous because humans need time to read and fill out forms.
 * Override via MCP_ELICITATION_TIMEOUT_MS environment variable.
 */
export const DEFAULT_ELICITATION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Gets the configured elicitation timeout in milliseconds.
 * Priority: options.timeout > MCP_ELICITATION_TIMEOUT_MS env var > default (5 minutes)
 */
export function getElicitationTimeout(optionsTimeout?: number): number {
  if (optionsTimeout !== undefined) {
    return optionsTimeout;
  }

  const envTimeout = process.env.MCP_ELICITATION_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = Number.parseInt(envTimeout, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_ELICITATION_TIMEOUT_MS;
}

/**
 * Result of an elicitation request with typed content
 */
export interface TypedElicitResult<T> {
  /** User action: accept, decline, or cancel */
  action: "accept" | "decline" | "cancel";
  /** User-provided content (only present when action is 'accept') */
  content?: T;
}

/**
 * Options for elicitation requests
 */
export interface ElicitOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to log the elicitation event */
  logEvent?: boolean;
}

/**
 * JSON Schema for elicitation form fields
 *
 * Supports: string, boolean, number/integer, and enum fields
 */
export interface ElicitationSchema {
  type: "object";
  properties: Record<
    string,
    | {
        type: "string";
        title?: string;
        description?: string;
        minLength?: number;
        maxLength?: number;
        format?: "date" | "uri" | "email" | "date-time";
        default?: string;
      }
    | {
        type: "string";
        title?: string;
        description?: string;
        enum: string[];
        enumNames?: string[];
        default?: string;
      }
    | {
        type: "boolean";
        title?: string;
        description?: string;
        default?: boolean;
      }
    | {
        type: "number" | "integer";
        title?: string;
        description?: string;
        minimum?: number;
        maximum?: number;
        default?: number;
      }
  >;
  required?: string[];
}

/**
 * Checks if the connected client supports elicitation
 *
 * @param server - MCP Server instance
 * @returns true if client supports form elicitation
 */
export function clientSupportsElicitation(server: Server): boolean {
  const capabilities = (
    server as unknown as {
      _clientCapabilities?: { elicitation?: { form?: unknown } };
    }
  )._clientCapabilities;
  return Boolean(capabilities?.elicitation?.form);
}

/**
 * Elicits structured input from the user
 *
 * This is the main function for requesting user input. It handles:
 * - Capability checking
 * - Timeout configuration
 * - Error handling
 * - Logging
 *
 * @param server - MCP Server instance
 * @param message - Message to display to the user
 * @param schema - JSON Schema defining the expected input structure
 * @param options - Additional options
 * @returns Typed elicitation result
 *
 * @example
 * ```typescript
 * const result = await elicitInput<{ name: string; age: number }>(
 *   server,
 *   "Please provide your details:",
 *   {
 *     type: "object",
 *     properties: {
 *       name: { type: "string", title: "Name", description: "Your full name" },
 *       age: { type: "integer", title: "Age", minimum: 0, maximum: 150 }
 *     },
 *     required: ["name"]
 *   }
 * );
 *
 * if (result.action === 'accept' && result.content) {
 *   console.log(`Hello ${result.content.name}!`);
 * }
 * ```
 */
export async function elicitInput<T>(
  server: Server,
  message: string,
  schema: ElicitationSchema,
  options?: ElicitOptions
): Promise<TypedElicitResult<T>> {
  const { logEvent = true } = options ?? {};
  const timeout = getElicitationTimeout(options?.timeout);

  // Check if client supports elicitation
  if (!clientSupportsElicitation(server)) {
    if (logEvent) {
      logWarning("Client does not support elicitation", {
        metadata: { feature: "elicitation" },
      });
    }
    throw new ElicitationNotSupportedError("Client does not support form elicitation");
  }

  if (logEvent) {
    logDebug(`Elicitation: Requesting input: ${message}`, {
      metadata: { feature: "elicitation" },
    });
  }

  try {
    // Build the elicitation params - cast to any to handle SDK type strictness
    const params = {
      mode: "form" as const,
      message,
      requestedSchema: schema,
    };

    // biome-ignore lint/suspicious/noExplicitAny: SDK types are stricter than our schema type
    const result: ElicitResult = await server.elicitInput(params as any, { timeout });

    if (logEvent) {
      logDebug(`Elicitation: User action: ${result.action}`, {
        metadata: { feature: "elicitation", action: result.action },
      });
    }

    return {
      action: result.action,
      content: result.content as T | undefined,
    };
  } catch (error) {
    if (logEvent) {
      logError(`Elicitation failed: ${String(error)}`, error instanceof Error ? error : undefined, {
        metadata: { feature: "elicitation" },
      });
    }
    throw error;
  }
}

/**
 * Elicits confirmation from the user (yes/no with optional reason)
 *
 * @param server - MCP Server instance
 * @param message - Confirmation message to display
 * @param options - Additional options
 * @returns Confirmation result
 *
 * @example
 * ```typescript
 * const { confirmed, reason } = await elicitConfirmation(
 *   server,
 *   "Are you sure you want to delete this item?"
 * );
 *
 * if (confirmed) {
 *   await deleteItem();
 * } else if (reason) {
 *   console.log(`Deletion cancelled: ${reason}`);
 * }
 * ```
 */
export async function elicitConfirmation(
  server: Server,
  message: string,
  options?: ElicitOptions
): Promise<{ confirmed: boolean; reason?: string }> {
  const schema: ElicitationSchema = {
    type: "object",
    properties: {
      confirm: {
        type: "boolean",
        title: "Confirm",
        description: "Confirm this action?",
      },
      reason: {
        type: "string",
        title: "Reason",
        description: "Optional reason for your decision",
      },
    },
    required: ["confirm"],
  };

  const result = await elicitInput<{ confirm: boolean; reason?: string }>(
    server,
    message,
    schema,
    options
  );

  if (result.action === "accept" && result.content) {
    return {
      confirmed: result.content.confirm,
      reason: result.content.reason,
    };
  }

  // Decline or cancel means not confirmed
  return { confirmed: false };
}

/**
 * Elicits a text input from the user
 *
 * @param server - MCP Server instance
 * @param message - Message to display
 * @param fieldConfig - Configuration for the text field
 * @param options - Additional options
 * @returns The text value or undefined if cancelled
 *
 * @example
 * ```typescript
 * const name = await elicitText(server, "What is your name?", {
 *   title: "Name",
 *   description: "Enter your full name",
 *   minLength: 1,
 *   maxLength: 100
 * });
 * ```
 */
export async function elicitText(
  server: Server,
  message: string,
  fieldConfig?: {
    title?: string;
    description?: string;
    minLength?: number;
    maxLength?: number;
    default?: string;
  },
  options?: ElicitOptions
): Promise<string | undefined> {
  const schema: ElicitationSchema = {
    type: "object",
    properties: {
      value: {
        type: "string",
        title: fieldConfig?.title ?? "Value",
        description: fieldConfig?.description,
        minLength: fieldConfig?.minLength,
        maxLength: fieldConfig?.maxLength,
        default: fieldConfig?.default,
      },
    },
    required: ["value"],
  };

  const result = await elicitInput<{ value: string }>(server, message, schema, options);

  if (result.action === "accept" && result.content) {
    return result.content.value;
  }

  return undefined;
}

/**
 * Elicits a choice from a list of options
 *
 * @param server - MCP Server instance
 * @param message - Message to display
 * @param choices - List of choices
 * @param options - Additional options
 * @returns The selected choice or undefined if cancelled
 *
 * @example
 * ```typescript
 * const priority = await elicitChoice(
 *   server,
 *   "Select priority level:",
 *   [
 *     { value: "low", label: "Low" },
 *     { value: "medium", label: "Medium" },
 *     { value: "high", label: "High" }
 *   ]
 * );
 * ```
 */
export async function elicitChoice<T extends string>(
  server: Server,
  message: string,
  choices: Array<{ value: T; label: string }>,
  options?: ElicitOptions & { title?: string; description?: string }
): Promise<T | undefined> {
  const schema: ElicitationSchema = {
    type: "object",
    properties: {
      choice: {
        type: "string",
        title: options?.title ?? "Choice",
        description: options?.description,
        enum: choices.map((c) => c.value),
        enumNames: choices.map((c) => c.label),
      },
    },
    required: ["choice"],
  };

  const result = await elicitInput<{ choice: T }>(server, message, schema, options);

  if (result.action === "accept" && result.content) {
    return result.content.choice;
  }

  return undefined;
}

/**
 * Error thrown when client doesn't support elicitation
 */
export class ElicitationNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElicitationNotSupportedError";
  }
}

/**
 * Error thrown when user declines or cancels elicitation
 */
export class ElicitationDeclinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElicitationDeclinedError";
  }
}

/**
 * Error thrown when elicitation validation fails
 */
export class ElicitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElicitationValidationError";
  }
}
