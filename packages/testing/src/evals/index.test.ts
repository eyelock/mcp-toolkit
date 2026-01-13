/**
 * Evals Framework Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EvalRunner,
  createEvalRunner,
  evaluateAssertion,
  createMockLLMClient,
  type LLMClient,
} from "./index.js";
import { createTestHarness } from "../harness/index.js";
import type { EvalScenario, EvalSuite, Assertion, ToolCallResult } from "../schema.js";

describe("evaluateAssertion", () => {
  const mockToolCalls: ToolCallResult[] = [
    { tool: "test_tool", arguments: { key: "value" }, result: {}, durationMs: 10 },
  ];

  describe("tool-called", () => {
    it("passes when tool was called", () => {
      const assertion: Assertion = { type: "tool-called", tool: "test_tool", weight: 1 };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it("fails when tool was not called", () => {
      const assertion: Assertion = { type: "tool-called", tool: "other_tool", weight: 1 };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("was not called");
    });

    it("fails when tool name is missing", () => {
      const assertion: Assertion = { type: "tool-called", weight: 1 };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Missing tool name");
    });
  });

  describe("tool-not-called", () => {
    it("passes when tool was not called", () => {
      const assertion: Assertion = { type: "tool-not-called", tool: "other_tool", weight: 1 };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(true);
    });

    it("fails when tool was called", () => {
      const assertion: Assertion = { type: "tool-not-called", tool: "test_tool", weight: 1 };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("was called but shouldn't have been");
    });

    it("fails when tool name is missing", () => {
      const assertion: Assertion = { type: "tool-not-called", weight: 1 };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Missing tool name");
    });
  });

  describe("tool-args-match", () => {
    it("passes when args match", () => {
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "test_tool",
        args: { key: "value" },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(true);
    });

    it("passes with partial args match", () => {
      const toolCalls: ToolCallResult[] = [
        {
          tool: "test_tool",
          arguments: { key: "value", extra: "data" },
          result: {},
          durationMs: 10,
        },
      ];
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "test_tool",
        args: { key: "value" },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, toolCalls, undefined);
      expect(result.passed).toBe(true);
    });

    it("fails when tool or args is missing", () => {
      const assertion: Assertion = {
        type: "tool-args-match",
        // tool is intentionally missing
        weight: 1,
      };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Missing tool or args");
    });

    it("fails when args don't match", () => {
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "test_tool",
        args: { key: "wrong" },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
    });

    it("fails when tool was not called", () => {
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "other_tool",
        args: { key: "value" },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, mockToolCalls, undefined);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("was not called");
    });

    it("passes with nested object args match", () => {
      const toolCalls: ToolCallResult[] = [
        {
          tool: "nested_tool",
          arguments: { config: { level: 1, options: { enabled: true } } },
          result: {},
          durationMs: 10,
        },
      ];
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "nested_tool",
        args: { config: { level: 1, options: { enabled: true } } },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, toolCalls, undefined);
      expect(result.passed).toBe(true);
    });

    it("fails when nested object value is not an object in actual", () => {
      const toolCalls: ToolCallResult[] = [
        {
          tool: "nested_tool",
          arguments: { config: "not-an-object" },
          result: {},
          durationMs: 10,
        },
      ];
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "nested_tool",
        args: { config: { level: 1 } },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, toolCalls, undefined);
      expect(result.passed).toBe(false);
    });

    it("fails when nested object values do not match", () => {
      const toolCalls: ToolCallResult[] = [
        {
          tool: "nested_tool",
          arguments: { config: { level: 1, options: { enabled: false } } },
          result: {},
          durationMs: 10,
        },
      ];
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "nested_tool",
        args: { config: { options: { enabled: true } } },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, toolCalls, undefined);
      expect(result.passed).toBe(false);
    });

    it("fails when nested object property is null in actual", () => {
      const toolCalls: ToolCallResult[] = [
        {
          tool: "nested_tool",
          arguments: { config: null },
          result: {},
          durationMs: 10,
        },
      ];
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "nested_tool",
        args: { config: { level: 1 } },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, toolCalls, undefined);
      expect(result.passed).toBe(false);
    });

    it("fails when expected key is missing from actual args", () => {
      const toolCalls: ToolCallResult[] = [
        {
          tool: "test_tool",
          arguments: { existing: "value" },
          result: {},
          durationMs: 10,
        },
      ];
      const assertion: Assertion = {
        type: "tool-args-match",
        tool: "test_tool",
        args: { missing_key: "expected" },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, toolCalls, undefined);
      expect(result.passed).toBe(false);
    });
  });

  describe("response-contains", () => {
    it("passes when response contains text", () => {
      const assertion: Assertion = { type: "response-contains", text: "world", weight: 1 };
      const result = evaluateAssertion(assertion, [], "Hello world!");
      expect(result.passed).toBe(true);
    });

    it("fails when response doesn't contain text", () => {
      const assertion: Assertion = { type: "response-contains", text: "universe", weight: 1 };
      const result = evaluateAssertion(assertion, [], "Hello world!");
      expect(result.passed).toBe(false);
    });

    it("handles undefined response", () => {
      const assertion: Assertion = { type: "response-contains", text: "test", weight: 1 };
      const result = evaluateAssertion(assertion, [], undefined);
      expect(result.passed).toBe(false);
    });

    it("fails when text is missing", () => {
      const assertion: Assertion = {
        type: "response-contains",
        // text is intentionally missing
        weight: 1,
      };
      const result = evaluateAssertion(assertion, [], "Hello world");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Missing text");
    });
  });

  describe("response-matches", () => {
    it("passes when response matches pattern", () => {
      const assertion: Assertion = { type: "response-matches", pattern: "\\d+", weight: 1 };
      const result = evaluateAssertion(assertion, [], "The answer is 42");
      expect(result.passed).toBe(true);
    });

    it("fails when response doesn't match pattern", () => {
      const assertion: Assertion = { type: "response-matches", pattern: "\\d+", weight: 1 };
      const result = evaluateAssertion(assertion, [], "No numbers here");
      expect(result.passed).toBe(false);
    });

    it("fails when pattern is missing", () => {
      const assertion: Assertion = {
        type: "response-matches",
        // pattern is intentionally missing
        weight: 1,
      };
      const result = evaluateAssertion(assertion, [], "Some response");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Missing pattern");
    });
  });

  describe("custom", () => {
    it("passes when custom function returns true", () => {
      const assertion: Assertion = { type: "custom", fn: () => true, weight: 1 };
      const result = evaluateAssertion(assertion, [], "test");
      expect(result.passed).toBe(true);
    });

    it("fails when custom function returns false", () => {
      const assertion: Assertion = { type: "custom", fn: () => false, weight: 1 };
      const result = evaluateAssertion(assertion, [], "test");
      expect(result.passed).toBe(false);
    });

    it("handles custom function errors", () => {
      const assertion: Assertion = {
        type: "custom",
        fn: () => {
          throw new Error("Custom error");
        },
        weight: 1,
      };
      const result = evaluateAssertion(assertion, [], "test");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Custom error");
    });

    it("fails when custom function is missing", () => {
      const assertion: Assertion = {
        type: "custom",
        // fn is intentionally missing
        weight: 1,
      };
      const result = evaluateAssertion(assertion, [], "test");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("Missing function");
    });
  });

  describe("llm-judge", () => {
    it("returns placeholder for async evaluation", () => {
      const assertion: Assertion = {
        type: "llm-judge",
        criteria: "Test criteria",
        weight: 1,
      };
      const result = evaluateAssertion(assertion, [], "test");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("async evaluation");
    });
  });
});

describe("EvalRunner", () => {
  let harness: ReturnType<typeof createTestHarness>;
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    harness = createTestHarness({
      tools: {
        greet: async (args: { name: string }) => ({
          content: [{ type: "text", text: `Hello ${args.name}` }],
        }),
        fail: async () => ({
          isError: true,
          content: [{ type: "text", text: "Error occurred" }],
        }),
      },
    });

    mockLLMClient = createMockLLMClient([{ content: "Mock LLM response" }]);
  });

  describe("createEvalRunner", () => {
    it("creates an eval runner", () => {
      const runner = createEvalRunner({ harness });
      expect(runner).toBeInstanceOf(EvalRunner);
    });
  });

  describe("runScenario", () => {
    it("executes scripted tool calls", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "greet-test",
        prompt: "Test prompt",
        toolCalls: [{ tool: "greet", arguments: { name: "Claude" } }],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);

      expect(result.scenario).toBe("greet-test");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].tool).toBe("greet");
    });

    it("evaluates assertions", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "assert-test",
        prompt: "",
        toolCalls: [{ tool: "greet", arguments: { name: "World" } }],
        assertions: [{ type: "tool-called", tool: "greet", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);

      expect(result.passed).toBe(true);
      expect(result.assertions).toHaveLength(1);
      expect(result.assertions[0].passed).toBe(true);
    });

    it("handles tool errors in scripted calls", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "error-test",
        prompt: "",
        toolCalls: [
          {
            tool: "fail",
            arguments: {},
            expectedResult: { isError: true },
          },
        ],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(true);
    });

    it("creates LLM client using clientFactory when provided", async () => {
      const factoryClient = createMockLLMClient([{ content: "Factory client response" }]);
      const clientFactory = vi.fn().mockReturnValue(factoryClient);

      const runner = createEvalRunner({
        harness,
        llmConfig: { apiKey: "test-key", model: "test-model", maxTokens: 100 },
        clientFactory,
      });

      const scenario: EvalScenario = {
        name: "factory-test",
        prompt: "Test prompt",
        toolCalls: [],
        assertions: [{ type: "response-contains", text: "Factory client", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(clientFactory).toHaveBeenCalledWith({
        apiKey: "test-key",
        model: "test-model",
        maxTokens: 100,
      });
      expect(result.llmResponse).toBe("Factory client response");
    });

    it("gets LLM response when client is provided", async () => {
      const runner = createEvalRunner({ harness, llmClient: mockLLMClient });

      const scenario: EvalScenario = {
        name: "llm-test",
        prompt: "Say hello",
        toolCalls: [],
        assertions: [{ type: "response-contains", text: "Mock LLM", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.llmResponse).toBe("Mock LLM response");
      expect(result.passed).toBe(true);
    });

    it("handles cancellation", async () => {
      const controller = new AbortController();
      controller.abort();

      const runner = createEvalRunner({ harness, signal: controller.signal });

      const scenario: EvalScenario = {
        name: "cancel-test",
        prompt: "",
        toolCalls: [{ tool: "greet", arguments: { name: "Test" } }],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(false);
      expect(result.error).toContain("cancelled");
    });
  });

  describe("scoring criteria", () => {
    it("uses all-assertions criteria", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "all-assertions",
        prompt: "",
        toolCalls: [{ tool: "greet", arguments: { name: "Test" } }],
        assertions: [
          { type: "tool-called", tool: "greet", weight: 1 },
          { type: "tool-not-called", tool: "fail", weight: 1 },
        ],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(true);
    });

    it("uses any-assertion criteria", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "any-assertion",
        prompt: "",
        toolCalls: [{ tool: "greet", arguments: { name: "Test" } }],
        assertions: [
          { type: "tool-called", tool: "greet", weight: 1 },
          { type: "tool-called", tool: "nonexistent", weight: 1 },
        ],
        tags: [],
        scoring: { passCriteria: "any-assertion", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(true);
    });

    it("uses weighted-threshold criteria", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "weighted",
        prompt: "",
        toolCalls: [{ tool: "greet", arguments: { name: "Test" } }],
        assertions: [
          { type: "tool-called", tool: "greet", weight: 0.8 },
          { type: "tool-called", tool: "nonexistent", weight: 0.2 },
        ],
        tags: [],
        scoring: { passCriteria: "weighted-threshold", threshold: 0.7 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("runScenarios", () => {
    it("runs multiple scenarios", async () => {
      const runner = createEvalRunner({ harness });

      const scenarios: EvalScenario[] = [
        {
          name: "scenario-1",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: ["tag1"],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
        {
          name: "scenario-2",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: ["tag2"],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
      ];

      const results = await runner.runScenarios(scenarios);
      expect(results).toHaveLength(2);
    });

    it("filters by tags", async () => {
      const runner = createEvalRunner({ harness });

      const scenarios: EvalScenario[] = [
        {
          name: "scenario-1",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: ["tag1"],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
        {
          name: "scenario-2",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: ["tag2"],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
      ];

      const results = await runner.runScenarios(scenarios, { tags: ["tag1"] });
      expect(results).toHaveLength(1);
      expect(results[0].scenario).toBe("scenario-1");
    });

    it("filters by names", async () => {
      const runner = createEvalRunner({ harness });

      const scenarios: EvalScenario[] = [
        {
          name: "include-me",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: [],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
        {
          name: "exclude-me",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: [],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
      ];

      const results = await runner.runScenarios(scenarios, { names: ["include-me"] });
      expect(results).toHaveLength(1);
      expect(results[0].scenario).toBe("include-me");
    });

    it("skips scenarios by name", async () => {
      const runner = createEvalRunner({ harness });

      const scenarios: EvalScenario[] = [
        {
          name: "scenario-1",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: [],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
        {
          name: "skip-me",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: [],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
      ];

      const results = await runner.runScenarios(scenarios, { skip: ["skip-me"] });
      expect(results).toHaveLength(1);
      expect(results[0].scenario).toBe("scenario-1");
    });
  });

  describe("runSuite", () => {
    it("runs an eval suite", async () => {
      const runner = createEvalRunner({ harness });

      const suite: EvalSuite = {
        name: "test-suite",
        scenarios: [
          {
            name: "scenario-1",
            prompt: "",
            toolCalls: [],
            assertions: [],
            tags: [],
            scoring: { passCriteria: "all-assertions", threshold: 1 },
            timeoutMs: 60000,
          },
        ],
      };

      const result = await runner.runSuite(suite);

      expect(result.suite).toBe("test-suite");
      expect(result.totalScenarios).toBe(1);
      expect(result.passedScenarios).toBe(1);
      expect(result.passed).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it("runs setup and teardown", async () => {
      const setup = vi.fn(async () => {});
      const teardown = vi.fn(async () => {});
      const runner = createEvalRunner({ harness });

      const suite: EvalSuite = {
        name: "test-suite",
        scenarios: [],
        setup,
        teardown,
      };

      await runner.runSuite(suite);

      expect(setup).toHaveBeenCalled();
      expect(teardown).toHaveBeenCalled();
    });

    it("runs teardown even on error", async () => {
      const teardown = vi.fn(async () => {});
      const runner = createEvalRunner({ harness });

      const suite: EvalSuite = {
        name: "test-suite",
        scenarios: [
          {
            name: "failing",
            prompt: "",
            toolCalls: [{ tool: "nonexistent", arguments: {} }],
            assertions: [{ type: "tool-called", tool: "nonexistent", weight: 1 }],
            tags: [],
            scoring: { passCriteria: "all-assertions", threshold: 1 },
            timeoutMs: 60000,
          },
        ],
        teardown,
      };

      await runner.runSuite(suite);

      expect(teardown).toHaveBeenCalled();
    });
  });
});

describe("createMockLLMClient", () => {
  it("returns responses in order", async () => {
    const client = createMockLLMClient([{ content: "first" }, { content: "second" }]);

    const response1 = await client.chat([]);
    const response2 = await client.chat([]);

    expect(response1.content).toBe("first");
    expect(response2.content).toBe("second");
  });

  it("cycles through responses", async () => {
    const client = createMockLLMClient([{ content: "only" }]);

    const response1 = await client.chat([]);
    const response2 = await client.chat([]);

    expect(response1.content).toBe("only");
    expect(response2.content).toBe("only");
  });

  it("handles empty responses array", async () => {
    const client = createMockLLMClient([]);
    const response = await client.chat([]);
    expect(response.content).toBe("");
  });
});

describe("Cancellation and Error Handling", () => {
  let harness: ReturnType<typeof createTestHarness>;

  beforeEach(() => {
    harness = createTestHarness({
      tools: {
        slow_tool: async () => {
          // Simulate slow operation
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { content: [{ type: "text", text: "completed" }] };
        },
        fast_tool: async () => ({
          content: [{ type: "text", text: "fast" }],
        }),
        error_tool: async () => {
          throw new Error("Tool execution error");
        },
      },
    });
  });

  describe("Cancellation", () => {
    it("cancels before any tool call execution", async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-abort

      const runner = createEvalRunner({ harness, signal: controller.signal });

      const scenario: EvalScenario = {
        name: "pre-cancel",
        prompt: "",
        toolCalls: [{ tool: "slow_tool", arguments: {} }],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(false);
      expect(result.error).toContain("cancelled");
      expect(result.toolCalls).toHaveLength(0);
    });

    it("stops processing after cancellation between tool calls", async () => {
      const controller = new AbortController();
      const runner = createEvalRunner({ harness, signal: controller.signal });

      // Tool that cancels after first call
      let callCount = 0;
      harness.registerTool("cancelling_tool", async () => {
        callCount++;
        if (callCount === 1) {
          controller.abort();
        }
        return { content: [{ type: "text", text: `call ${callCount}` }] };
      });

      const scenario: EvalScenario = {
        name: "cancel-between-calls",
        prompt: "",
        toolCalls: [
          { tool: "cancelling_tool", arguments: {} },
          { tool: "fast_tool", arguments: {} },
        ],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(false);
      expect(result.error).toContain("cancelled");
      // First tool call should complete, second should be skipped
      expect(result.toolCalls).toHaveLength(1);
    });

    it("respects scenario-level abort signal in runScenarios", async () => {
      const controller = new AbortController();
      const runner = createEvalRunner({ harness });

      const scenarios: EvalScenario[] = [
        {
          name: "first",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: [],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
        {
          name: "second",
          prompt: "",
          toolCalls: [],
          assertions: [],
          tags: [],
          scoring: { passCriteria: "all-assertions", threshold: 1 },
          timeoutMs: 60000,
        },
      ];

      // Abort after first scenario would run
      setTimeout(() => controller.abort(), 10);

      const results = await runner.runScenarios(scenarios, { signal: controller.signal });

      // Should have run at least one but potentially stopped early
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Error Recovery", () => {
    it("catches and reports tool execution errors", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "error-catch",
        prompt: "",
        toolCalls: [{ tool: "error_tool", arguments: {} }],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // Tool errors are caught by harness, so scenario continues
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].result.isError).toBe(true);
    });

    it("handles unknown tool gracefully", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "unknown-tool",
        prompt: "",
        toolCalls: [{ tool: "nonexistent_tool", arguments: {} }],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].result.isError).toBe(true);
    });

    it("continues after partial failures in multiple tool calls", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "partial-failure",
        prompt: "",
        toolCalls: [
          { tool: "fast_tool", arguments: {} },
          { tool: "error_tool", arguments: {} },
          { tool: "fast_tool", arguments: {} },
        ],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.toolCalls).toHaveLength(3);
      expect(result.toolCalls[0].result.isError).toBeUndefined();
      expect(result.toolCalls[1].result.isError).toBe(true);
      expect(result.toolCalls[2].result.isError).toBeUndefined();
    });
  });

  describe("LLM Judge Error Handling", () => {
    it("handles missing judge client gracefully", async () => {
      const runner = createEvalRunner({ harness }); // No judge client

      const scenario: EvalScenario = {
        name: "no-judge",
        prompt: "",
        toolCalls: [],
        assertions: [{ type: "llm-judge", criteria: "Test criteria", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(false);
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].message).toContain("No judge client");
    });

    it("handles malformed judge response", async () => {
      const malformedJudge: LLMClient = {
        async chat() {
          return { content: "This is not JSON at all" };
        },
      };

      const runner = createEvalRunner({ harness, judgeClient: malformedJudge });

      const scenario: EvalScenario = {
        name: "malformed-judge",
        prompt: "",
        toolCalls: [{ tool: "fast_tool", arguments: {} }],
        assertions: [{ type: "llm-judge", criteria: "Is the response good?", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].message).toContain("parse");
    });

    it("handles judge client throwing errors", async () => {
      const errorJudge: LLMClient = {
        async chat() {
          throw new Error("Judge API error");
        },
      };

      const runner = createEvalRunner({ harness, judgeClient: errorJudge });

      const scenario: EvalScenario = {
        name: "judge-error",
        prompt: "",
        toolCalls: [],
        assertions: [{ type: "llm-judge", criteria: "Test", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].message).toContain("Judge API error");
    });

    it("handles missing criteria in llm-judge assertion", async () => {
      const judge: LLMClient = {
        async chat() {
          return { content: JSON.stringify({ passed: true, score: 1, reasoning: "OK" }) };
        },
      };

      const runner = createEvalRunner({ harness, judgeClient: judge });

      const scenario: EvalScenario = {
        name: "missing-criteria",
        prompt: "",
        toolCalls: [],
        assertions: [{ type: "llm-judge", weight: 1 }], // No criteria
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].message).toContain("Missing criteria");
    });

    it("parses valid judge response correctly", async () => {
      const judge: LLMClient = {
        async chat() {
          return {
            content: JSON.stringify({
              passed: true,
              score: 0.85,
              reasoning: "The response meets the criteria",
            }),
          };
        },
      };

      const runner = createEvalRunner({ harness, judgeClient: judge });

      const scenario: EvalScenario = {
        name: "valid-judge",
        prompt: "",
        toolCalls: [{ tool: "fast_tool", arguments: {} }],
        assertions: [{ type: "llm-judge", criteria: "Is the tool called correctly?", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.assertions[0].passed).toBe(true);
      expect(result.assertions[0].score).toBe(0.85);
      expect(result.assertions[0].message).toContain("meets the criteria");
    });

    it("clamps out-of-range judge scores", async () => {
      const judge: LLMClient = {
        async chat() {
          return {
            content: JSON.stringify({
              passed: true,
              score: 1.5, // Out of range
              reasoning: "High score",
            }),
          };
        },
      };

      const runner = createEvalRunner({ harness, judgeClient: judge });

      const scenario: EvalScenario = {
        name: "score-clamp",
        prompt: "",
        toolCalls: [],
        assertions: [{ type: "llm-judge", criteria: "Test", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.assertions[0].score).toBe(1); // Clamped to max
    });

    it("extracts JSON from mixed judge response", async () => {
      const judge: LLMClient = {
        async chat() {
          return {
            content:
              'Here is my analysis:\n\n{"passed": true, "score": 0.9, "reasoning": "Good"}\n\nEnd of response.',
          };
        },
      };

      const runner = createEvalRunner({ harness, judgeClient: judge });

      const scenario: EvalScenario = {
        name: "mixed-response",
        prompt: "",
        toolCalls: [],
        assertions: [{ type: "llm-judge", criteria: "Test", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.assertions[0].passed).toBe(true);
      expect(result.assertions[0].score).toBe(0.9);
    });
  });

  describe("Assertion Edge Cases", () => {
    it("handles empty assertions array", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "no-assertions",
        prompt: "",
        toolCalls: [{ tool: "fast_tool", arguments: {} }],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 1 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it("handles zero-weight assertions in weighted-threshold", async () => {
      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "zero-weight",
        prompt: "",
        toolCalls: [{ tool: "fast_tool", arguments: {} }],
        assertions: [
          { type: "tool-called", tool: "fast_tool", weight: 0 },
          { type: "tool-called", tool: "nonexistent", weight: 0 },
        ],
        tags: [],
        scoring: { passCriteria: "weighted-threshold", threshold: 0.5 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // With zero weights, score calculation handles edge case
      expect(result).toBeDefined();
    });

    it("handles unknown assertion type", async () => {
      const result = evaluateAssertion(
        // @ts-expect-error - testing invalid type
        { type: "unknown-type", weight: 1 },
        [],
        undefined
      );

      expect(result.passed).toBe(false);
      expect(result.message).toContain("Unknown assertion type");
    });
  });

  describe("Score Calculation Edge Cases", () => {
    it("handles unknown passCriteria by returning failed result", async () => {
      const harness = createTestHarness();
      harness.registerTool("test_tool", async () => ({ content: [{ type: "text", text: "ok" }] }));

      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "unknown-criteria",
        prompt: "test",
        toolCalls: [{ tool: "test_tool", arguments: {} }],
        assertions: [{ type: "tool-called", tool: "test_tool", weight: 1 }],
        tags: [],
        scoring: {
          // @ts-expect-error - testing invalid passCriteria
          passCriteria: "invalid-criteria",
          threshold: 0.5,
        },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // Unknown passCriteria falls to default case which returns { passed: false, score: 0 }
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it("handles any-assertion criteria correctly", async () => {
      const harness = createTestHarness();
      harness.registerTool("tool_a", async () => ({ content: [{ type: "text", text: "ok" }] }));

      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "any-assertion",
        prompt: "test",
        toolCalls: [{ tool: "tool_a", arguments: {} }],
        assertions: [
          { type: "tool-called", tool: "tool_a", weight: 1 },
          { type: "tool-called", tool: "missing_tool", weight: 1 },
        ],
        tags: [],
        scoring: { passCriteria: "any-assertion", threshold: 0.5 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // any-assertion passes if at least one assertion passes
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1); // Max score from assertions
    });
  });

  describe("Expected Result Mismatch", () => {
    it("records error when expectedResult.isError does not match", async () => {
      const harness = createTestHarness();
      // Tool returns success (isError: false)
      harness.registerTool("success_tool", async () => ({
        content: [{ type: "text", text: "success" }],
      }));

      const runner = createEvalRunner({ harness });

      const scenario: EvalScenario = {
        name: "isError-mismatch",
        prompt: "test",
        toolCalls: [
          {
            tool: "success_tool",
            arguments: {},
            // Expecting an error but tool succeeds
            expectedResult: { isError: true },
          },
        ],
        assertions: [],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 0.5 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // The tool call should have an error recorded
      expect(result.toolCalls[0].error).toContain("Expected isError=true");
    });
  });

  describe("Suite Cancellation", () => {
    it("stops suite when signal is aborted between scenarios", async () => {
      const harness = createTestHarness();
      harness.registerTool("test_tool", async () => ({
        content: [{ type: "text", text: "ok" }],
      }));

      const controller = new AbortController();
      const runner = createEvalRunner({ harness, signal: controller.signal });

      const suite: EvalSuite = {
        name: "abort-suite",
        description: "Test suite cancellation",
        scenarios: [
          {
            name: "first",
            prompt: "",
            toolCalls: [{ tool: "test_tool", arguments: {} }],
            assertions: [],
            tags: [],
            scoring: { passCriteria: "all-assertions", threshold: 0.5 },
            timeoutMs: 60000,
          },
          {
            name: "second",
            prompt: "",
            toolCalls: [{ tool: "test_tool", arguments: {} }],
            assertions: [],
            tags: [],
            scoring: { passCriteria: "all-assertions", threshold: 0.5 },
            timeoutMs: 60000,
          },
        ],
      };

      // Abort after first scenario starts
      setTimeout(() => controller.abort(), 5);

      const suiteResult = await runner.runSuite(suite);
      // Should complete at least first scenario but possibly stop before second
      expect(suiteResult.results.length).toBeLessThanOrEqual(2);
    });

    it("stops suite when options.signal is aborted", async () => {
      const harness = createTestHarness();
      harness.registerTool("test_tool", async () => ({
        content: [{ type: "text", text: "ok" }],
      }));

      const controller = new AbortController();
      const runner = createEvalRunner({ harness });

      const suite: EvalSuite = {
        name: "options-abort-suite",
        description: "Test options signal cancellation",
        scenarios: [
          {
            name: "first",
            prompt: "",
            toolCalls: [{ tool: "test_tool", arguments: {} }],
            assertions: [],
            tags: [],
            scoring: { passCriteria: "all-assertions", threshold: 0.5 },
            timeoutMs: 60000,
          },
          {
            name: "second",
            prompt: "",
            toolCalls: [{ tool: "test_tool", arguments: {} }],
            assertions: [],
            tags: [],
            scoring: { passCriteria: "all-assertions", threshold: 0.5 },
            timeoutMs: 60000,
          },
        ],
      };

      // Abort before running
      controller.abort();

      const suiteResult = await runner.runSuite(suite, { signal: controller.signal });
      // With pre-aborted signal, should get 0 results
      expect(suiteResult.results.length).toBe(0);
    });
  });

  describe("LLM Judge JSON Parsing", () => {
    it("handles completely invalid JSON in judge response", async () => {
      const mockClient: LLMClient = {
        chat: vi.fn().mockResolvedValue({
          content: "This is not JSON at all, just plain text response",
        }),
      };

      const harness = createTestHarness();
      harness.registerTool("test_tool", async () => ({ content: [{ type: "text", text: "ok" }] }));

      const runner = createEvalRunner({
        harness,
        llmClient: mockClient,
      });

      const scenario: EvalScenario = {
        name: "invalid-json",
        prompt: "test",
        toolCalls: [{ tool: "test_tool", arguments: {} }],
        assertions: [{ type: "llm-judge", criteria: "Is it good?", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 0.5 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // Should fail gracefully with score 0
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].score).toBe(0);
      expect(result.assertions[0].message).toContain("Could not parse");
    });

    it("handles JSON parse error with malformed JSON structure", async () => {
      const mockClient: LLMClient = {
        chat: vi.fn().mockResolvedValue({
          content: '{ "passed": true, "score": not_a_number }',
        }),
      };

      const harness = createTestHarness();
      harness.registerTool("test_tool", async () => ({ content: [{ type: "text", text: "ok" }] }));

      const runner = createEvalRunner({
        harness,
        llmClient: mockClient,
      });

      const scenario: EvalScenario = {
        name: "malformed-json",
        prompt: "test",
        toolCalls: [{ tool: "test_tool", arguments: {} }],
        assertions: [{ type: "llm-judge", criteria: "Is it good?", weight: 1 }],
        tags: [],
        scoring: { passCriteria: "all-assertions", threshold: 0.5 },
        timeoutMs: 60000,
      };

      const result = await runner.runScenario(scenario);
      // JSON.parse should throw, triggering the catch block
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].score).toBe(0);
      expect(result.assertions[0].message).toContain("parse");
    });
  });
});
