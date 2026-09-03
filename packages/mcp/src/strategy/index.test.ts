/**
 * Tool Delegation Tests
 */

import type { ToolDelegationConfig } from "@mcp-toolkit/model";
import { describe, expect, it } from "vitest";
import {
  classifyTool,
  classifyToolByName,
  clientSupportsSampling,
  DEFAULT_DELEGATION_TIMEOUT_MS,
  DelegationUnavailableError,
  ExecutionStrategyError,
  executeWithDelegation,
  extractTextFromSamplingResponse,
  getClientCapabilities,
  getToolsByClassification,
  resolveToolDelegation,
  toolBenefitsFromSampling,
  toolRequiresSampling,
} from "./index.js";

describe("Tool Delegation", () => {
  describe("resolveToolDelegation", () => {
    it("returns default values when no config provided", () => {
      const result = resolveToolDelegation("my_tool");

      expect(result.mode).toBe("local-only");
      expect(result.fallbackEnabled).toBe(true);
      expect(result.delegationTimeout).toBeUndefined();
    });

    it("returns default values when tool not in config", () => {
      const config: ToolDelegationConfig = {
        other_tool: { mode: "delegate-first" },
      };

      const result = resolveToolDelegation("my_tool", config);

      expect(result.mode).toBe("local-only");
      expect(result.fallbackEnabled).toBe(true);
    });

    it("returns configured values when tool in config", () => {
      const config: ToolDelegationConfig = {
        my_tool: {
          mode: "delegate-first",
          delegationTimeout: 60000,
          fallbackEnabled: false,
        },
      };

      const result = resolveToolDelegation("my_tool", config);

      expect(result.mode).toBe("delegate-first");
      expect(result.delegationTimeout).toBe(60000);
      expect(result.fallbackEnabled).toBe(false);
    });

    it("applies defaults for missing fields in partial config", () => {
      const config: ToolDelegationConfig = {
        my_tool: { mode: "delegate-only" },
      };

      const result = resolveToolDelegation("my_tool", config);

      expect(result.mode).toBe("delegate-only");
      expect(result.fallbackEnabled).toBe(true); // Default
      expect(result.delegationTimeout).toBeUndefined();
    });

    it("handles namespaced tool names", () => {
      const config: ToolDelegationConfig = {
        "session_init:client_discovery": { mode: "delegate-first" },
      };

      const result = resolveToolDelegation("session_init:client_discovery", config);

      expect(result.mode).toBe("delegate-first");
    });
  });

  describe("Tool Classification", () => {
    describe("classifyTool", () => {
      it('classifies local-only as "implementation"', () => {
        expect(classifyTool("local-only")).toBe("implementation");
      });

      it('classifies delegate-first as "sampling"', () => {
        expect(classifyTool("delegate-first")).toBe("sampling");
      });

      it('classifies delegate-only as "sampling"', () => {
        expect(classifyTool("delegate-only")).toBe("sampling");
      });
    });

    describe("classifyToolByName", () => {
      it("classifies unconfigured tools as implementation", () => {
        const classification = classifyToolByName("unknown_tool", {});

        expect(classification).toBe("implementation");
      });

      it("classifies delegate-first tools as sampling", () => {
        const config: ToolDelegationConfig = {
          my_tool: { mode: "delegate-first" },
        };

        const classification = classifyToolByName("my_tool", config);

        expect(classification).toBe("sampling");
      });

      it("handles undefined config", () => {
        const classification = classifyToolByName("my_tool");

        expect(classification).toBe("implementation");
      });
    });

    describe("getToolsByClassification", () => {
      const config: ToolDelegationConfig = {
        "session_init:client_discovery": { mode: "delegate-first" },
        "code_review:analyze": { mode: "delegate-only" },
        server_info: { mode: "local-only" },
        session_status: { mode: "local-only" },
      };

      it("returns sampling tools", () => {
        const tools = getToolsByClassification("sampling", config);

        expect(tools).toContain("session_init:client_discovery");
        expect(tools).toContain("code_review:analyze");
        expect(tools).toHaveLength(2);
      });

      it("returns implementation tools", () => {
        const tools = getToolsByClassification("implementation", config);

        expect(tools).toContain("server_info");
        expect(tools).toContain("session_status");
        expect(tools).toHaveLength(2);
      });

      it("returns empty array for undefined config", () => {
        const tools = getToolsByClassification("sampling");

        expect(tools).toEqual([]);
      });

      it("handles tools without explicit mode (defaults to local-only)", () => {
        const partialConfig: ToolDelegationConfig = {
          tool_with_timeout: { delegationTimeout: 5000 },
        };

        const implTools = getToolsByClassification("implementation", partialConfig);
        const samplingTools = getToolsByClassification("sampling", partialConfig);

        expect(implTools).toContain("tool_with_timeout");
        expect(samplingTools).toHaveLength(0);
      });
    });

    describe("toolRequiresSampling", () => {
      const config: ToolDelegationConfig = {
        required: { mode: "delegate-only" },
        optional: { mode: "delegate-first" },
        local: { mode: "local-only" },
      };

      it("returns true for delegate-only tools", () => {
        expect(toolRequiresSampling("required", config)).toBe(true);
      });

      it("returns false for delegate-first tools", () => {
        expect(toolRequiresSampling("optional", config)).toBe(false);
      });

      it("returns false for local-only tools", () => {
        expect(toolRequiresSampling("local", config)).toBe(false);
      });

      it("returns false for unconfigured tools", () => {
        expect(toolRequiresSampling("unknown", config)).toBe(false);
      });
    });

    describe("toolBenefitsFromSampling", () => {
      const config: ToolDelegationConfig = {
        required: { mode: "delegate-only" },
        optional: { mode: "delegate-first" },
        local: { mode: "local-only" },
      };

      it("returns true for delegate-first tools", () => {
        expect(toolBenefitsFromSampling("optional", config)).toBe(true);
      });

      it("returns false for delegate-only tools", () => {
        expect(toolBenefitsFromSampling("required", config)).toBe(false);
      });

      it("returns false for local-only tools", () => {
        expect(toolBenefitsFromSampling("local", config)).toBe(false);
      });

      it("returns false for unconfigured tools", () => {
        expect(toolBenefitsFromSampling("unknown", config)).toBe(false);
      });
    });
  });

  describe("clientSupportsSampling", () => {
    // Reads the capabilities the request carried, not a private field on the
    // server object - under the stateless protocol they arrive per request.
    it("is true when the client declared sampling", () => {
      expect(clientSupportsSampling({ clientCapabilities: { sampling: {} } })).toBe(true);
    });

    it("is false when it did not", () => {
      expect(clientSupportsSampling({ clientCapabilities: {} })).toBe(false);
    });

    it("is false when no capabilities are available (legacy HTTP)", () => {
      expect(clientSupportsSampling({})).toBe(false);
    });

    it("is false for an undefined context", () => {
      expect(clientSupportsSampling(undefined)).toBe(false);
    });
  });

  describe("getClientCapabilities", () => {
    it("returns the declared capabilities", () => {
      expect(getClientCapabilities({ clientCapabilities: { sampling: {} } })).toEqual({
        sampling: {},
      });
    });

    it("is undefined when absent", () => {
      expect(getClientCapabilities({})).toBeUndefined();
      expect(getClientCapabilities(undefined)).toBeUndefined();
    });
  });

  describe("extractTextFromSamplingResponse", () => {
    it("extracts text from string content", () => {
      const result = extractTextFromSamplingResponse({
        role: "assistant",
        model: "test",
        content: "Hello, world!",
      });

      expect(result).toBe("Hello, world!");
    });

    it("extracts text from object with text field", () => {
      const result = extractTextFromSamplingResponse({
        role: "assistant",
        model: "test",
        content: { text: "Hello from object" } as unknown as { type: "text"; text: string },
      });

      expect(result).toBe("Hello from object");
    });

    it("extracts text from array of content blocks", () => {
      const result = extractTextFromSamplingResponse({
        role: "assistant",
        model: "test",
        content: [
          { type: "text", text: "Line 1" },
          { type: "text", text: "Line 2" },
        ],
      });

      expect(result).toBe("Line 1\nLine 2");
    });

    it("filters non-text blocks from array", () => {
      const result = extractTextFromSamplingResponse({
        role: "assistant",
        model: "test",
        content: [
          { type: "text", text: "Text content" },
          { type: "image", data: "..." } as unknown as { type: "text"; text: string },
          { type: "text", text: "More text" },
        ],
      });

      expect(result).toBe("Text content\nMore text");
    });

    it("returns stringified content for unknown content types", () => {
      const result = extractTextFromSamplingResponse({
        role: "assistant",
        model: "test",
        content: 12345 as unknown as string,
      });

      expect(result).toBe("12345");
    });
  });

  describe("executeWithDelegation", () => {
    const spec = {
      key: "test_delegation",
      build: () => ({
        messages: [{ role: "user" as const, content: { type: "text" as const, text: "who?" } }],
        maxTokens: 50,
      }),
      parse: (result: { content: { text?: string } }) =>
        result.content.text === "unusable" ? undefined : `delegated:${result.content.text}`,
    };

    const local = async () => "local-result";

    /** Context for the first round: capability present, no answer yet. */
    const canSample = { clientCapabilities: { sampling: {} } };

    /** Context for the resumed round, carrying the LLM's answer. */
    function withAnswer(text: string) {
      return {
        clientCapabilities: { sampling: {} },
        inputResponses: {
          test_delegation: { role: "assistant", model: "m", content: { type: "text", text } },
        },
      } as never;
    }

    describe("local-only", () => {
      it("never asks the LLM, even when it could", async () => {
        const result = await executeWithDelegation(canSample, {}, spec, local, {
          mode: "local-only",
          toolName: "t",
        });

        expect(result.outcome).toBe("local");
        expect(result.result).toBe("local-result");
        expect(result.delegationAttempted).toBe(false);
      });
    });

    describe("delegate-first", () => {
      it("asks on the first round and returns a request to hand back", async () => {
        const result = await executeWithDelegation(canSample, {}, spec, local, {
          mode: "delegate-first",
          toolName: "t",
        });

        expect(result.outcome).toBe("pending");
        expect(result.delegationAttempted).toBe(true);
        const request = result.request as { inputRequests?: Record<string, unknown> };
        expect(request.inputRequests?.test_delegation).toBeDefined();
      });

      it("uses the answer on the resumed round", async () => {
        const result = await executeWithDelegation(withAnswer("opus"), {}, spec, local, {
          mode: "delegate-first",
          toolName: "t",
        });

        expect(result.outcome).toBe("delegated");
        expect(result.result).toBe("delegated:opus");
      });

      it("falls back to local when the answer is unusable", async () => {
        const result = await executeWithDelegation(withAnswer("unusable"), {}, spec, local, {
          mode: "delegate-first",
          toolName: "t",
        });

        expect(result.outcome).toBe("fallback-local");
        expect(result.result).toBe("local-result");
        expect(result.delegationError).toBeDefined();
      });

      it("goes straight to local when the client cannot sample", async () => {
        // Legacy HTTP, or a client that never declared the capability.
        const result = await executeWithDelegation({}, {}, spec, local, {
          mode: "delegate-first",
          toolName: "t",
        });

        expect(result.outcome).toBe("local");
        expect(result.delegationAttempted).toBe(false);
      });

      it("throws on an unusable answer when fallback is disabled", async () => {
        await expect(
          executeWithDelegation(withAnswer("unusable"), {}, spec, local, {
            mode: "delegate-first",
            fallbackEnabled: false,
            toolName: "t",
          })
        ).rejects.toThrow(ExecutionStrategyError);
      });
    });

    describe("delegate-only", () => {
      it("asks on the first round", async () => {
        const result = await executeWithDelegation(canSample, {}, spec, local, {
          mode: "delegate-only",
          toolName: "t",
        });

        expect(result.outcome).toBe("pending");
      });

      it("uses the answer on the resumed round", async () => {
        const result = await executeWithDelegation(withAnswer("opus"), {}, spec, local, {
          mode: "delegate-only",
          toolName: "t",
        });

        expect(result.outcome).toBe("delegated");
      });

      it("throws when the client cannot sample", async () => {
        await expect(
          executeWithDelegation({}, {}, spec, local, { mode: "delegate-only", toolName: "t" })
        ).rejects.toThrow(DelegationUnavailableError);
      });

      it("never falls back to local on an unusable answer", async () => {
        await expect(
          executeWithDelegation(withAnswer("unusable"), {}, spec, local, {
            mode: "delegate-only",
            toolName: "t",
          })
        ).rejects.toThrow(ExecutionStrategyError);
      });
    });

    it("defaults the request key to the tool name", async () => {
      const unkeyed = { build: spec.build, parse: spec.parse };
      const result = await executeWithDelegation(canSample, {}, unkeyed, local, {
        mode: "delegate-first",
        toolName: "my_tool",
      });

      const request = result.request as { inputRequests?: Record<string, unknown> };
      expect(request.inputRequests?.my_tool).toBeDefined();
    });

    it("reports elapsed time", async () => {
      const result = await executeWithDelegation(canSample, {}, spec, local, {
        mode: "local-only",
        toolName: "t",
      });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Constants", () => {
    it("exports default delegation timeout", () => {
      expect(DEFAULT_DELEGATION_TIMEOUT_MS).toBe(30_000);
    });
  });
});
