/**
 * Elicitation Helpers for MCP
 *
 * Requesting structured input from the user, mid-operation.
 *
 * ## Push became pull
 *
 * Under 2025-era MCP the server *pushed* a question down a live connection and
 * awaited the answer:
 *
 * ```typescript
 * const answer = await server.elicitInput({ ... }); // throws on 2026-07-28
 * ```
 *
 * `2026-07-28` removed server-to-client requests, so that call now throws on a
 * modern connection. Instead the handler *returns* an `InputRequiredResult`
 * describing what it needs; the client gathers the answers and calls the tool
 * again with them attached. Any instance can serve the retry, because
 * everything needed travels in the payload.
 *
 * Handlers therefore read first and ask second:
 *
 * ```typescript
 * export async function handleDeploy(args, context) {
 *   const confirm = elicitConfirmation(context, "confirm", "Deploy to production?");
 *   if (confirm.status === "pending") {
 *     return confirm.result; // client will call us again with the answer
 *   }
 *   return deploy(confirm.value);
 * }
 * ```
 *
 * ## What still works where
 *
 * | Transport | Era    | Elicitation |
 * |-----------|--------|-------------|
 * | stdio     | modern | yes         |
 * | stdio     | legacy | yes - the SDK shim turns the return into a 2025 push |
 * | HTTP      | modern | yes         |
 * | HTTP      | legacy | **no** - stateless per-request serving has no channel to push on |
 *
 * The last row is a property of stateless HTTP, not of this code: there is no
 * open connection to carry a server-to-client request. Legacy HTTP clients
 * needing elicitation must use stdio or upgrade.
 *
 * ## Answers do not accumulate
 *
 * `inputResponses` carries only the answers to the requests issued in the round
 * immediately before. Ask for A, then ask for B, and by the time B arrives A is
 * gone - a handler that re-asks for what it cannot see will loop until the
 * SDK's `maxRounds` cap fires.
 *
 * There are two correct shapes, and the first is almost always the right one:
 *
 * 1. **Ask for everything in one round** - `elicitAll`. All answers arrive
 *    together, nothing needs remembering.
 * 2. **Carry earlier answers forward** - `carryForward`, which signs them into
 *    `requestState`. Needed only when a later question depends on an earlier
 *    answer. Requires `requestStateKey` on the server.
 *
 * @see https://modelcontextprotocol.io/specification/2026-07-28
 */

import {
  acceptedContent,
  type ElicitInputParams,
  type InputRequest,
  type InputRequiredResult,
  inputRequired,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ServerContext } from "../server.js";

/**
 * Either the answer, or the result to return so the client supplies it.
 *
 * Handlers branch on `status`: `"pending"` means return `result` and wait to be
 * called again; `"ready"` means `value` is available.
 */
export type ElicitOutcome<T> =
  | { status: "ready"; value: T }
  | { status: "pending"; result: InputRequiredResult };

/**
 * Schema shape elicitation accepts: a flat object of primitives.
 *
 * Derived from the SDK rather than restated, so it cannot drift from what the
 * protocol actually allows.
 */
export type ElicitationSchema = ElicitInputParams["requestedSchema"];

/**
 * Options shared by the helpers
 */
export interface ElicitOptions {
  /**
   * Opaque state echoed back by the client on the retry.
   *
   * Use it to carry progress through a multi-step flow. It round-trips through
   * an untrusted client, so sign it (`createRequestStateCodec`) if anything is
   * decided by its contents.
   */
  requestState?: string;
}

/**
 * Read an answer this handler previously asked for, if it has arrived.
 *
 * @returns the accepted content, or undefined on the first round (and when the
 *          user declined or cancelled)
 */
export function readResponse<T extends Record<string, unknown>>(
  context: Pick<ServerContext, "inputResponses">,
  key: string
): T | undefined {
  return acceptedContent<T>(context.inputResponses, key);
}

/**
 * Build the result that asks the client for input.
 *
 * Compose several requests in one round trip by passing more than one entry.
 */
export function requestInput(
  requests: Record<string, InputRequest>,
  options: ElicitOptions = {}
): InputRequiredResult {
  return inputRequired({
    inputRequests: requests,
    ...(options.requestState === undefined ? {} : { requestState: options.requestState }),
  });
}

/**
 * Generic form elicitation against a JSON Schema.
 *
 * @param context - Handler context (carries any answers already supplied)
 * @param key - Names this request, and the answer that comes back
 * @param message - Prompt shown to the user
 * @param schema - Shape of the requested input
 */
export function elicitInput<T extends Record<string, unknown>>(
  context: Pick<ServerContext, "inputResponses">,
  key: string,
  message: string,
  schema: ElicitationSchema,
  options: ElicitOptions = {}
): ElicitOutcome<T> {
  const existing = readResponse<T>(context, key);
  if (existing) {
    return { status: "ready", value: existing };
  }

  return {
    status: "pending",
    result: requestInput(
      { [key]: inputRequired.elicit({ message, requestedSchema: schema }) },
      options
    ),
  };
}

/**
 * Ask a yes/no question.
 */
export function elicitConfirmation(
  context: Pick<ServerContext, "inputResponses">,
  key: string,
  message: string,
  options: ElicitOptions = {}
): ElicitOutcome<boolean> {
  const outcome = elicitInput<{ confirm: boolean }>(
    context,
    key,
    message,
    {
      type: "object",
      properties: {
        confirm: { type: "boolean", description: "Confirm this action" },
      },
      required: ["confirm"],
    },
    options
  );

  return outcome.status === "ready"
    ? { status: "ready", value: outcome.value.confirm === true }
    : outcome;
}

/**
 * Ask for a single line of text.
 */
export function elicitText(
  context: Pick<ServerContext, "inputResponses">,
  key: string,
  message: string,
  options: ElicitOptions & { description?: string } = {}
): ElicitOutcome<string> {
  const outcome = elicitInput<{ value: string }>(
    context,
    key,
    message,
    {
      type: "object",
      properties: {
        value: {
          type: "string",
          ...(options.description === undefined ? {} : { description: options.description }),
        },
      },
      required: ["value"],
    },
    options
  );

  return outcome.status === "ready" ? { status: "ready", value: outcome.value.value } : outcome;
}

/**
 * Ask the user to pick one of a fixed set of options.
 *
 * The chosen value is validated against `choices`, so a client that answers
 * with something else is treated as not having answered - the request is
 * re-issued rather than a bogus value being trusted.
 */
export function elicitChoice<T extends string>(
  context: Pick<ServerContext, "inputResponses">,
  key: string,
  message: string,
  choices: ReadonlyArray<{ value: T; label?: string }>,
  options: ElicitOptions = {}
): ElicitOutcome<T> {
  const values = choices.map((choice) => choice.value);
  const schema = z.object({ choice: z.enum(values as [T, ...T[]]) });

  const existing = acceptedContent(context.inputResponses, key, schema);
  if (existing) {
    return { status: "ready", value: existing.choice as T };
  }

  return {
    status: "pending",
    result: requestInput(
      {
        [key]: inputRequired.elicit({
          message,
          requestedSchema: {
            type: "object",
            properties: {
              choice: {
                type: "string",
                enum: values,
                description: choices
                  .map((choice) => `${choice.value}${choice.label ? ` (${choice.label})` : ""}`)
                  .join(", "),
              },
            },
            required: ["choice"],
          },
        }),
      },
      options
    ),
  };
}

/**
 * Build a request for a single line of text, for use with `elicitAll`.
 */
export function textRequest(message: string, description?: string): InputRequest {
  return inputRequired.elicit({
    message,
    requestedSchema: {
      type: "object",
      properties: {
        value: { type: "string", ...(description === undefined ? {} : { description }) },
      },
      required: ["value"],
    },
  });
}

/**
 * Build a yes/no request, for use with `elicitAll`.
 */
export function confirmationRequest(message: string): InputRequest {
  return inputRequired.elicit({
    message,
    requestedSchema: {
      type: "object",
      properties: { confirm: { type: "boolean", description: "Confirm this action" } },
      required: ["confirm"],
    },
  });
}

/**
 * Build a pick-one request, for use with `elicitAll`.
 */
export function choiceRequest(
  message: string,
  choices: ReadonlyArray<{ value: string; label?: string }>
): InputRequest {
  return inputRequired.elicit({
    message,
    requestedSchema: {
      type: "object",
      properties: {
        choice: {
          type: "string",
          enum: choices.map((choice) => choice.value),
          description: choices
            .map((choice) => `${choice.value}${choice.label ? ` (${choice.label})` : ""}`)
            .join(", "),
        },
      },
      required: ["choice"],
    },
  });
}

/**
 * Ask several questions in a single round.
 *
 * The preferred shape for multi-field input: every answer arrives together, so
 * nothing has to be remembered between rounds.
 *
 * @example
 * ```typescript
 * const answers = elicitAll(context, {
 *   name: textRequest("Your name?"),
 *   team: textRequest("Your team?"),
 * });
 * if (answers.status === "pending") return answers.result;
 * // answers.value.name.value, answers.value.team.value
 * ```
 */
export function elicitAll<T extends Record<string, Record<string, unknown>>>(
  context: Pick<ServerContext, "inputResponses">,
  requests: Record<keyof T & string, InputRequest>,
  options: ElicitOptions = {}
): ElicitOutcome<T> {
  const answers: Record<string, Record<string, unknown>> = {};
  const outstanding: Record<string, InputRequest> = {};

  for (const [key, request] of Object.entries(requests)) {
    const answer = readResponse(context, key);
    if (answer) {
      answers[key] = answer;
    } else {
      outstanding[key] = request;
    }
  }

  if (Object.keys(outstanding).length > 0) {
    return { status: "pending", result: requestInput(outstanding, options) };
  }

  return { status: "ready", value: answers as T };
}

/**
 * Merge answers carried from earlier rounds with the ones that just arrived.
 *
 * Use when a later question depends on an earlier answer, so the questions
 * cannot all be asked at once. The merged view is what the helpers should read,
 * and `remember` produces the state to carry into the next round.
 *
 * The carried state is signed by the server's `requestStateKey`, so a client
 * cannot forge an answer it never gave.
 *
 * @example
 * ```typescript
 * const carried = carryForward(context);
 *
 * const env = elicitChoice(carried.context, "env", "Which environment?", ENVS);
 * if (env.status === "pending") return await carried.remember(env.result);
 *
 * // Only ask this once the environment is known.
 * const confirm = elicitConfirmation(carried.context, "confirm", `Deploy to ${env.value}?`);
 * if (confirm.status === "pending") return await carried.remember(confirm.result);
 * ```
 */
export function carryForward(
  context: Pick<ServerContext, "inputResponses" | "carriedState" | "mintRequestState">
): {
  /** Context whose `inputResponses` include everything answered so far */
  context: Pick<ServerContext, "inputResponses">;
  /** Attach the accumulated answers to a pending result */
  remember: (result: InputRequiredResult) => Promise<InputRequiredResult>;
} {
  const carried = (context.carriedState?.answers ?? {}) as Record<string, unknown>;
  const arrived = (context.inputResponses ?? {}) as Record<string, unknown>;
  const merged = { ...carried, ...arrived };

  return {
    context: { inputResponses: merged },
    remember: async (result) => {
      if (!context.mintRequestState) {
        throw new ElicitationNotSupportedError(
          "Multi-step elicitation needs signed state: pass requestStateKey to createServer, " +
            "or ask for everything in one round with elicitAll."
        );
      }
      return {
        ...result,
        requestState: await context.mintRequestState({ answers: merged }),
      };
    },
  };
}

/**
 * Whether this connection can carry an elicitation at all.
 *
 * False for legacy HTTP, where per-request serving has no channel to reach the
 * client. Handlers that can proceed without the input should check this and
 * take the fallback path rather than returning a request that cannot be met.
 */
export function canElicit(context: Pick<ServerContext, "clientCapabilities">): boolean {
  return context.clientCapabilities?.elicitation !== undefined;
}

/**
 * Raised when elicitation is unavailable and the handler cannot continue.
 */
export class ElicitationNotSupportedError extends Error {
  constructor(message = "Elicitation is not available on this connection") {
    super(message);
    this.name = "ElicitationNotSupportedError";
  }
}

/**
 * Raised when the user declined or cancelled and the handler cannot continue.
 */
export class ElicitationDeclinedError extends Error {
  constructor(message = "User declined to provide input") {
    super(message);
    this.name = "ElicitationDeclinedError";
  }
}
