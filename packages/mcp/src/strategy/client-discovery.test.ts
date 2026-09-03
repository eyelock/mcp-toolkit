/**
 * Client discovery, as a delegation round trip.
 *
 * `build` produces the question; `parse` reads the LLM's answer when the tool
 * is called again. Neither half awaits anything, which is what lets delegation
 * work on a stateless connection.
 */

import { describe, expect, it } from "vitest";
import {
  CLIENT_DISCOVERY_TIMEOUT_MS,
  clientDiscoverySpec,
  createClientDiscoveryRequest,
} from "./client-discovery.js";

/** Shape a sampling answer the way the SDK hands it back. */
function samplingAnswer(text: string) {
  return {
    role: "assistant" as const,
    model: "test-model",
    content: { type: "text" as const, text },
  } as Parameters<typeof clientDiscoverySpec.parse>[0];
}

describe("clientDiscoverySpec.build", () => {
  it("asks the LLM to identify itself", () => {
    const request = clientDiscoverySpec.build(undefined);

    expect(request.messages).toHaveLength(1);
    expect(request.messages[0]?.role).toBe("user");
    const content = request.messages[0]?.content as { text: string };
    expect(content.text).toContain("clientName");
    expect(content.text).toContain("model");
  });

  it("bounds the response", () => {
    expect(clientDiscoverySpec.build(undefined).maxTokens).toBe(500);
  });

  it("uses a stable key so the answer can be matched to the question", () => {
    expect(clientDiscoverySpec.key).toBe("client_discovery");
  });
});

describe("clientDiscoverySpec.parse", () => {
  it("returns metadata from a well-formed answer", () => {
    const parsed = clientDiscoverySpec.parse(
      samplingAnswer(
        JSON.stringify({
          clientName: "claude-desktop",
          model: "claude-opus-5",
          modelProvider: "anthropic",
        })
      ),
      undefined
    );

    expect(parsed).toMatchObject({
      clientName: "claude-desktop",
      model: "claude-opus-5",
      modelProvider: "anthropic",
    });
  });

  it("handles a markdown code block", () => {
    const parsed = clientDiscoverySpec.parse(
      samplingAnswer('```json\n{"clientName": "cursor"}\n```'),
      undefined
    );

    expect(parsed).toMatchObject({ clientName: "cursor" });
  });

  it("handles an unlabelled code block", () => {
    const parsed = clientDiscoverySpec.parse(
      samplingAnswer('```\n{"clientName": "vscode"}\n```'),
      undefined
    );

    expect(parsed).toMatchObject({ clientName: "vscode" });
  });

  it("accepts an empty object, since every field is optional", () => {
    expect(clientDiscoverySpec.parse(samplingAnswer("{}"), undefined)).toEqual({});
  });

  // undefined means "unusable answer", which the executor treats as a failed
  // delegation and falls back from.
  it("is undefined for unparseable text", () => {
    expect(clientDiscoverySpec.parse(samplingAnswer("not json at all"), undefined)).toBeUndefined();
  });

  it("is undefined when a field has the wrong type", () => {
    expect(
      clientDiscoverySpec.parse(samplingAnswer('{"clientName": 12345}'), undefined)
    ).toBeUndefined();
  });
});

describe("createClientDiscoveryRequest", () => {
  it("still builds the same request for manual flows", () => {
    const request = createClientDiscoveryRequest();

    expect(request.messages[0]?.content.text).toContain("clientName");
    expect(request.maxTokens).toBeGreaterThan(0);
  });
});

describe("constants", () => {
  it("exposes a discovery timeout", () => {
    expect(CLIENT_DISCOVERY_TIMEOUT_MS).toBe(30_000);
  });
});
