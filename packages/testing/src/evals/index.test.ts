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
