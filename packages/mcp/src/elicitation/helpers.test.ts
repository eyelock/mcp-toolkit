/**
 * Elicitation helpers, in the pull model.
 *
 * Each helper is called twice in these tests: once with no answers (it should
 * ask) and once with the answer attached (it should proceed). That is exactly
 * how a handler runs across the two rounds of a real request.
 */

import { isInputRequiredResult } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import type { ServerContext } from "../server.js";
import {
  canElicit,
  carryForward,
  choiceRequest,
  confirmationRequest,
  ElicitationDeclinedError,
  ElicitationNotSupportedError,
  elicitAll,
  elicitChoice,
  elicitConfirmation,
  elicitInput,
  elicitText,
  readResponse,
  requestInput,
  textRequest,
} from "./helpers.js";

/** A first-round context: the handler has not asked anything yet. */
const firstRound = {} as Pick<ServerContext, "inputResponses">;

/** A second-round context carrying an accepted answer under `key`. */
function withAnswer(key: string, content: Record<string, unknown>) {
  return {
    inputResponses: { [key]: { kind: "elicit", action: "accept", content } },
  } as unknown as Pick<ServerContext, "inputResponses">;
}

/** A second-round context where the user declined. */
function withDecline(key: string) {
  return {
    inputResponses: { [key]: { kind: "elicit", action: "decline" } },
  } as unknown as Pick<ServerContext, "inputResponses">;
}

describe("elicitConfirmation", () => {
  it("asks on the first round", () => {
    const outcome = elicitConfirmation(firstRound, "confirm", "Delete this item?");

    expect(outcome.status).toBe("pending");
    if (outcome.status !== "pending") return;
    expect(isInputRequiredResult(outcome.result)).toBe(true);
    expect(outcome.result.inputRequests?.confirm).toBeDefined();
  });

  it("resolves true once accepted", () => {
    const outcome = elicitConfirmation(withAnswer("confirm", { confirm: true }), "confirm", "?");

    expect(outcome).toEqual({ status: "ready", value: true });
  });

  it("resolves false when the user says no", () => {
    const outcome = elicitConfirmation(withAnswer("confirm", { confirm: false }), "confirm", "?");

    expect(outcome).toEqual({ status: "ready", value: false });
  });

  it("asks again when the user declined to answer", () => {
    // Declining is not the same as answering "no" - there is no value to use.
    const outcome = elicitConfirmation(withDecline("confirm"), "confirm", "?");

    expect(outcome.status).toBe("pending");
  });
});

describe("elicitText", () => {
  it("asks on the first round", () => {
    const outcome = elicitText(firstRound, "name", "Your name?");

    expect(outcome.status).toBe("pending");
  });

  it("unwraps the value once accepted", () => {
    const outcome = elicitText(withAnswer("name", { value: "Ada" }), "name", "Your name?");

    expect(outcome).toEqual({ status: "ready", value: "Ada" });
  });

  it("carries an optional description into the schema", () => {
    const outcome = elicitText(firstRound, "name", "Your name?", { description: "Full name" });

    if (outcome.status !== "pending") throw new Error("expected pending");
    const request = outcome.result.inputRequests?.name as {
      params: { requestedSchema: { properties: { value: { description?: string } } } };
    };
    expect(request.params.requestedSchema.properties.value.description).toBe("Full name");
  });
});

describe("elicitChoice", () => {
  const choices = [
    { value: "low" as const, label: "Low" },
    { value: "high" as const, label: "High" },
  ];

  it("asks on the first round", () => {
    const outcome = elicitChoice(firstRound, "priority", "Priority?", choices);

    expect(outcome.status).toBe("pending");
  });

  it("resolves a valid choice", () => {
    const outcome = elicitChoice(
      withAnswer("priority", { choice: "high" }),
      "priority",
      "Priority?",
      choices
    );

    expect(outcome).toEqual({ status: "ready", value: "high" });
  });

  it("re-asks rather than trusting a value outside the options", () => {
    // The answer comes from an untrusted client, so it is validated.
    const outcome = elicitChoice(
      withAnswer("priority", { choice: "catastrophic" }),
      "priority",
      "Priority?",
      choices
    );

    expect(outcome.status).toBe("pending");
  });

  it("offers the options in the schema", () => {
    const outcome = elicitChoice(firstRound, "priority", "Priority?", choices);

    if (outcome.status !== "pending") throw new Error("expected pending");
    const request = outcome.result.inputRequests?.priority as {
      params: { requestedSchema: { properties: { choice: { enum: string[] } } } };
    };
    expect(request.params.requestedSchema.properties.choice.enum).toEqual(["low", "high"]);
  });
});

describe("elicitInput", () => {
  const schema = {
    type: "object" as const,
    properties: { title: { type: "string" as const } },
    required: ["title"],
  };

  it("asks on the first round", () => {
    const outcome = elicitInput(firstRound, "task", "Create a task:", schema);

    expect(outcome.status).toBe("pending");
  });

  it("returns the whole accepted object", () => {
    const outcome = elicitInput<{ title: string }>(
      withAnswer("task", { title: "Ship it" }),
      "task",
      "Create a task:",
      schema
    );

    expect(outcome).toEqual({ status: "ready", value: { title: "Ship it" } });
  });
});

describe("requestInput", () => {
  it("composes several requests into one round trip", () => {
    const combined = requestInput({
      a: textRequest("A?"),
      b: confirmationRequest("B?"),
    });

    expect(Object.keys(combined.inputRequests ?? {})).toEqual(["a", "b"]);
  });

  it("carries requestState when supplied", () => {
    const outcome = elicitText(firstRound, "name", "Your name?", { requestState: "step-2" });

    if (outcome.status !== "pending") throw new Error("expected pending");
    expect(outcome.result.requestState).toBe("step-2");
  });

  it("omits requestState when not supplied", () => {
    const outcome = elicitText(firstRound, "name", "Your name?");

    if (outcome.status !== "pending") throw new Error("expected pending");
    expect(outcome.result.requestState).toBeUndefined();
  });
});

describe("readResponse", () => {
  it("is undefined on the first round", () => {
    expect(readResponse(firstRound, "anything")).toBeUndefined();
  });

  it("returns accepted content", () => {
    expect(readResponse(withAnswer("k", { a: 1 }), "k")).toEqual({ a: 1 });
  });

  it("is undefined for a different key", () => {
    expect(readResponse(withAnswer("k", { a: 1 }), "other")).toBeUndefined();
  });
});

describe("canElicit", () => {
  it("is true when the client declared the capability", () => {
    expect(canElicit({ clientCapabilities: { elicitation: {} } })).toBe(true);
  });

  it("is false when it did not", () => {
    expect(canElicit({ clientCapabilities: {} })).toBe(false);
  });

  // Legacy HTTP carries no capabilities, which is also why it cannot elicit.
  it("is false when no capabilities are available at all", () => {
    expect(canElicit({})).toBe(false);
  });
});

describe("errors", () => {
  it("ElicitationNotSupportedError carries a default message", () => {
    const error = new ElicitationNotSupportedError();

    expect(error.name).toBe("ElicitationNotSupportedError");
    expect(error.message).toContain("not available");
  });

  it("ElicitationDeclinedError carries a default message", () => {
    const error = new ElicitationDeclinedError();

    expect(error.name).toBe("ElicitationDeclinedError");
    expect(error.message).toContain("declined");
  });
});

describe("elicitAll", () => {
  it("asks for everything outstanding in one round", () => {
    const outcome = elicitAll(firstRound, {
      name: textRequest("Your name?"),
      team: textRequest("Your team?"),
    });

    expect(outcome.status).toBe("pending");
    if (outcome.status !== "pending") return;
    expect(Object.keys(outcome.result.inputRequests ?? {})).toEqual(["name", "team"]);
  });

  it("only re-asks what is still missing", () => {
    const outcome = elicitAll(withAnswer("name", { value: "Ada" }), {
      name: textRequest("Your name?"),
      team: textRequest("Your team?"),
    });

    if (outcome.status !== "pending") throw new Error("expected pending");
    expect(Object.keys(outcome.result.inputRequests ?? {})).toEqual(["team"]);
  });

  it("returns every answer once all have arrived", () => {
    const context = {
      inputResponses: {
        name: { kind: "elicit", action: "accept", content: { value: "Ada" } },
        team: { kind: "elicit", action: "accept", content: { value: "platform" } },
      },
    } as unknown as Pick<ServerContext, "inputResponses">;

    const outcome = elicitAll(context, {
      name: textRequest("Your name?"),
      team: textRequest("Your team?"),
    });

    expect(outcome).toEqual({
      status: "ready",
      value: { name: { value: "Ada" }, team: { value: "platform" } },
    });
  });
});

describe("request builders", () => {
  it("textRequest asks for a string", () => {
    const request = textRequest("Your name?", "Full name") as {
      params: { message: string; requestedSchema: { properties: Record<string, unknown> } };
    };

    expect(request.params.message).toBe("Your name?");
    expect(request.params.requestedSchema.properties.value).toMatchObject({
      type: "string",
      description: "Full name",
    });
  });

  it("confirmationRequest asks for a boolean", () => {
    const request = confirmationRequest("Sure?") as {
      params: { requestedSchema: { properties: Record<string, { type: string }> } };
    };

    expect(request.params.requestedSchema.properties.confirm.type).toBe("boolean");
  });

  it("choiceRequest offers the given values", () => {
    const request = choiceRequest("Pick", [{ value: "a" }, { value: "b", label: "Bee" }]) as {
      params: { requestedSchema: { properties: { choice: { enum: string[] } } } };
    };

    expect(request.params.requestedSchema.properties.choice.enum).toEqual(["a", "b"]);
  });
});

describe("carryForward", () => {
  // Answers arrive one round at a time and do not accumulate, so a sequential
  // flow has to carry earlier ones itself or it re-asks forever.
  it("merges carried answers with the ones that just arrived", () => {
    const carried = carryForward({
      carriedState: { answers: { a: { kind: "elicit", action: "accept", content: { v: 1 } } } },
      inputResponses: { b: { kind: "elicit", action: "accept", content: { v: 2 } } },
    } as unknown as Pick<ServerContext, "inputResponses" | "carriedState" | "mintRequestState">);

    expect(readResponse(carried.context, "a")).toEqual({ v: 1 });
    expect(readResponse(carried.context, "b")).toEqual({ v: 2 });
  });

  it("lets a newly arrived answer supersede a carried one", () => {
    const carried = carryForward({
      carriedState: { answers: { a: { kind: "elicit", action: "accept", content: { v: 1 } } } },
      inputResponses: { a: { kind: "elicit", action: "accept", content: { v: 99 } } },
    } as unknown as Pick<ServerContext, "inputResponses" | "carriedState" | "mintRequestState">);

    expect(readResponse(carried.context, "a")).toEqual({ v: 99 });
  });

  it("signs the accumulated answers into the next round's state", async () => {
    const minted: Record<string, unknown>[] = [];
    const carried = carryForward({
      inputResponses: { a: { kind: "elicit", action: "accept", content: { v: 1 } } },
      mintRequestState: async (payload) => {
        minted.push(payload);
        return "signed-state";
      },
    } as unknown as Pick<ServerContext, "inputResponses" | "carriedState" | "mintRequestState">);

    const pending = elicitText(carried.context, "b", "B?");
    if (pending.status !== "pending") throw new Error("expected pending");
    const result = await carried.remember(pending.result);

    expect(result.requestState).toBe("signed-state");
    expect(minted[0]).toHaveProperty("answers");
  });

  it("refuses to carry state when no signing key is configured", async () => {
    const carried = carryForward({ inputResponses: {} } as Pick<
      ServerContext,
      "inputResponses" | "carriedState" | "mintRequestState"
    >);

    const pending = elicitText(carried.context, "a", "A?");
    if (pending.status !== "pending") throw new Error("expected pending");

    await expect(carried.remember(pending.result)).rejects.toThrow(ElicitationNotSupportedError);
  });
});
