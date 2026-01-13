/**
 * Tool Delegation Tests
 */

import type { ToolDelegationConfig } from "@mcp-toolkit/model";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELEGATION_TIMEOUT_MS,
  DelegationUnavailableError,
  ExecutionStrategyError,
  classifyTool,
  classifyToolByName,
  clientSupportsSampling,
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
    it("returns false when server is undefined", () => {
      expect(clientSupportsSampling(undefined)).toBe(false);
    });

    it("returns false when server has no capabilities", () => {
      const mockServer = {} as unknown as Server;
      expect(clientSupportsSampling(mockServer)).toBe(false);
    });

    it("returns false when sampling capability is missing", () => {
      const mockServer = {
        _clientCapabilities: { tools: {} },
      } as unknown as Server;
      expect(clientSupportsSampling(mockServer)).toBe(false);
    });

    it("returns true when sampling capability exists", () => {
      const mockServer = {
        _clientCapabilities: { sampling: {} },
      } as unknown as Server;
      expect(clientSupportsSampling(mockServer)).toBe(true);
    });
  });

  describe("getClientCapabilities", () => {
    it("returns undefined when server is undefined", () => {
      expect(getClientCapabilities(undefined)).toBeUndefined();
    });

    it("returns client capabilities from server", () => {
      const mockServer = {
        _clientCapabilities: { sampling: {}, tools: {} },
      } as unknown as Server;
      const caps = getClientCapabilities(mockServer);
      expect(caps).toEqual({ sampling: {}, tools: {} });
    });

    it("returns undefined when server has no capabilities", () => {
      const mockServer = {} as unknown as Server;
      expect(getClientCapabilities(mockServer)).toBeUndefined();
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
    const mockServerWithSampling = {
      _clientCapabilities: { sampling: {} },
    } as unknown as Server;

    const mockServerWithoutSampling = {
      _clientCapabilities: {},
    } as unknown as Server;

    it("executes locally for local-only mode", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => ({ result: "delegated" });

      const result = await executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
        mode: "local-only",
        toolName: "test_tool",
      });

      expect(result.outcome).toBe("local");
      expect(result.result).toEqual({ result: "local" });
    });

    it("throws for delegate-only mode without sampling support", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => ({ result: "delegated" });

      await expect(
        executeWithDelegation(mockServerWithoutSampling, {}, delegateFn, localFn, {
          mode: "delegate-only",
          toolName: "test_tool",
        })
      ).rejects.toThrow(DelegationUnavailableError);
    });

    it("delegates for delegate-only mode with sampling support", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => ({ result: "delegated" });

      const result = await executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
        mode: "delegate-only",
        toolName: "test_tool",
      });

      expect(result.outcome).toBe("delegated");
      expect(result.result).toEqual({ result: "delegated" });
    });

    it("throws when delegation fails with fallback disabled", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => {
        throw new Error("Delegation error");
      };

      await expect(
        executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
          mode: "delegate-first",
          fallbackEnabled: false,
          toolName: "test_tool",
        })
      ).rejects.toThrow(ExecutionStrategyError);
    });

    it("successfully delegates in delegate-first mode", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => ({ result: "delegated-success" });

      const result = await executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
        mode: "delegate-first",
        toolName: "test_tool",
      });

      expect(result.outcome).toBe("delegated");
      expect(result.result).toEqual({ result: "delegated-success" });
      expect(result.delegationAttempted).toBe(true);
    });

    it("falls back to local when delegation fails", async () => {
      const localFn = async () => ({ result: "local-fallback" });
      const delegateFn = async () => {
        throw new Error("Delegation error");
      };

      const result = await executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
        mode: "delegate-first",
        fallbackEnabled: true,
        toolName: "test_tool",
      });

      expect(result.outcome).toBe("fallback-local");
      expect(result.result).toEqual({ result: "local-fallback" });
      expect(result.delegationError).toContain("Delegation error");
    });

    it("throws when both delegation and local fail", async () => {
      const localFn = async () => {
        throw new Error("Local error");
      };
      const delegateFn = async () => {
        throw new Error("Delegation error");
      };

      await expect(
        executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
          mode: "delegate-first",
          fallbackEnabled: true,
          toolName: "test_tool",
        })
      ).rejects.toThrow(ExecutionStrategyError);
    });

    it("uses local execution directly when sampling unavailable in delegate-first mode", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => ({ result: "delegated" });

      const result = await executeWithDelegation(
        mockServerWithoutSampling,
        {},
        delegateFn,
        localFn,
        { mode: "delegate-first", toolName: "test_tool" }
      );

      expect(result.outcome).toBe("local");
      expect(result.delegationAttempted).toBe(false);
    });

    it("throws when local execution fails for local-only mode", async () => {
      const localFn = async () => {
        throw new Error("Local execution failed");
      };
      const delegateFn = async () => ({ result: "delegated" });

      await expect(
        executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
          mode: "local-only",
          toolName: "test_tool",
        })
      ).rejects.toThrow(ExecutionStrategyError);
    });

    it("throws when delegation fails for delegate-only mode", async () => {
      const localFn = async () => ({ result: "local" });
      const delegateFn = async () => {
        throw new Error("Delegation failed");
      };

      await expect(
        executeWithDelegation(mockServerWithSampling, {}, delegateFn, localFn, {
          mode: "delegate-only",
          toolName: "test_tool",
        })
      ).rejects.toThrow(ExecutionStrategyError);
    });
  });

  describe("Constants", () => {
    it("exports default delegation timeout", () => {
      expect(DEFAULT_DELEGATION_TIMEOUT_MS).toBe(30_000);
    });
  });
});
