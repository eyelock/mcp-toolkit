/**
 * Reporters Tests
 */

import { describe, it, expect } from "vitest";
import {
  jsonReporter,
  markdownReporter,
  htmlReporter,
  consoleReporter,
  getReporter,
  formatResult,
} from "./index.js";
import type { EvalResult, EvalSuiteResult } from "../schema.js";

const mockEvalResult: EvalResult = {
  scenario: "test-scenario",
  passed: true,
  score: 0.9,
  durationMs: 150,
  toolCalls: [{ tool: "test_tool", arguments: { key: "value" }, result: {}, durationMs: 10 }],
  assertions: [
    {
      assertion: { type: "tool-called", tool: "test_tool", weight: 1 },
      passed: true,
      score: 1,
    },
  ],
  llmResponse: "Test response",
};

const mockSuiteResult: EvalSuiteResult = {
  suite: "test-suite",
  passed: true,
  totalScenarios: 2,
  passedScenarios: 2,
  failedScenarios: 0,
  score: 0.95,
  durationMs: 300,
  results: [mockEvalResult, { ...mockEvalResult, scenario: "scenario-2" }],
  timestamp: "2024-01-15T10:00:00.000Z",
};

describe("jsonReporter", () => {
  describe("formatResult", () => {
    it("formats eval result as JSON", () => {
      const output = jsonReporter.formatResult(mockEvalResult);
      const parsed = JSON.parse(output);
      expect(parsed.scenario).toBe("test-scenario");
      expect(parsed.passed).toBe(true);
    });

    it("includes tool calls when option is set", () => {
      const output = jsonReporter.formatResult(mockEvalResult, { includeToolCalls: true });
      const parsed = JSON.parse(output);
      expect(parsed.toolCalls).toBeDefined();
      expect(parsed.toolCalls).toHaveLength(1);
    });

    it("includes assertions when option is set", () => {
      const output = jsonReporter.formatResult(mockEvalResult, { includeAssertions: true });
      const parsed = JSON.parse(output);
      expect(parsed.assertions).toBeDefined();
      expect(parsed.assertions).toHaveLength(1);
    });

    it("pretty prints when option is set", () => {
      const output = jsonReporter.formatResult(mockEvalResult, { prettyJson: true });
      expect(output).toContain("\n");
    });
  });

  describe("formatSuiteResult", () => {
    it("formats suite result as JSON", () => {
      const output = jsonReporter.formatSuiteResult(mockSuiteResult);
      const parsed = JSON.parse(output);
      expect(parsed.suite).toBe("test-suite");
      expect(parsed.totalScenarios).toBe(2);
    });

    it("includes timestamp when option is set", () => {
      const output = jsonReporter.formatSuiteResult(mockSuiteResult, { includeTimestamps: true });
      const parsed = JSON.parse(output);
      expect(parsed.timestamp).toBeDefined();
    });

    it("filters to failed only when option is set", () => {
      const failingResult: EvalSuiteResult = {
        ...mockSuiteResult,
        results: [
          { ...mockEvalResult, passed: true },
          { ...mockEvalResult, scenario: "failing", passed: false },
        ],
      };
      const output = jsonReporter.formatSuiteResult(failingResult, { failedOnly: true });
      const parsed = JSON.parse(output);
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].scenario).toBe("failing");
    });
  });
});

describe("markdownReporter", () => {
  describe("formatResult", () => {
    it("formats eval result as markdown", () => {
      const output = markdownReporter.formatResult(mockEvalResult);
      expect(output).toContain("## ✅ test-scenario");
      expect(output).toContain("**Status:** Passed");
      expect(output).toContain("90.0%");
    });

    it("shows error icon for failed result", () => {
      const failedResult: EvalResult = { ...mockEvalResult, passed: false };
      const output = markdownReporter.formatResult(failedResult);
      expect(output).toContain("## ❌");
    });

    it("includes error message when present", () => {
      const errorResult: EvalResult = { ...mockEvalResult, error: "Something went wrong" };
      const output = markdownReporter.formatResult(errorResult);
      expect(output).toContain("Something went wrong");
    });

    it("includes tool calls section when option is set", () => {
      const output = markdownReporter.formatResult(mockEvalResult, { includeToolCalls: true });
      expect(output).toContain("### Tool Calls");
      expect(output).toContain("test_tool");
    });

    it("includes assertions section when option is set", () => {
      const output = markdownReporter.formatResult(mockEvalResult, { includeAssertions: true });
      expect(output).toContain("### Assertions");
      expect(output).toContain("tool-called");
    });
  });

  describe("formatSuiteResult", () => {
    it("formats suite result as markdown", () => {
      const output = markdownReporter.formatSuiteResult(mockSuiteResult);
      expect(output).toContain("# ✅ test-suite");
      expect(output).toContain("## Summary");
      expect(output).toContain("| Metric | Value |");
      expect(output).toContain("2/2");
    });

    it("includes timestamp in table when option is set", () => {
      const output = markdownReporter.formatSuiteResult(mockSuiteResult, {
        includeTimestamps: true,
      });
      expect(output).toContain("Timestamp");
      expect(output).toContain("2024-01-15");
    });
  });
});

describe("htmlReporter", () => {
  describe("formatResult", () => {
    it("formats eval result as HTML", () => {
      const output = htmlReporter.formatResult(mockEvalResult);
      expect(output).toContain('<div class="eval-result passed">');
      expect(output).toContain("test-scenario");
    });

    it("uses failed class for failed result", () => {
      const failedResult: EvalResult = { ...mockEvalResult, passed: false };
      const output = htmlReporter.formatResult(failedResult);
      expect(output).toContain('<div class="eval-result failed">');
    });

    it("escapes HTML in content", () => {
      const result: EvalResult = {
        ...mockEvalResult,
        scenario: "<script>alert('xss')</script>",
      };
      const output = htmlReporter.formatResult(result);
      expect(output).not.toContain("<script>");
      expect(output).toContain("&lt;script&gt;");
    });
  });

  describe("formatSuiteResult", () => {
    it("formats suite result as full HTML document", () => {
      const output = htmlReporter.formatSuiteResult(mockSuiteResult);
      expect(output).toContain("<!DOCTYPE html>");
      expect(output).toContain("<title>Eval Results: test-suite</title>");
      expect(output).toContain("</html>");
    });

    it("includes CSS styles", () => {
      const output = htmlReporter.formatSuiteResult(mockSuiteResult);
      expect(output).toContain("<style>");
      expect(output).toContain(".eval-result");
    });

    it("includes timestamp when option is set", () => {
      const output = htmlReporter.formatSuiteResult(mockSuiteResult, {
        includeTimestamps: true,
      });
      expect(output).toContain("<th>Timestamp</th>");
      expect(output).toContain("2024-01-15");
    });
  });
});

describe("consoleReporter", () => {
  describe("formatResult", () => {
    it("formats eval result for console", () => {
      const output = consoleReporter.formatResult(mockEvalResult);
      expect(output).toContain("test-scenario");
      expect(output).toContain("90%");
      expect(output).toContain("150ms");
    });

    it("uses green check for passed", () => {
      const output = consoleReporter.formatResult(mockEvalResult);
      expect(output).toContain("\x1b[32m✓\x1b[0m");
    });

    it("uses red X for failed", () => {
      const failedResult: EvalResult = { ...mockEvalResult, passed: false };
      const output = consoleReporter.formatResult(failedResult);
      expect(output).toContain("\x1b[31m✗\x1b[0m");
    });

    it("shows error in red when present", () => {
      const errorResult: EvalResult = { ...mockEvalResult, error: "Error message" };
      const output = consoleReporter.formatResult(errorResult);
      expect(output).toContain("\x1b[31mError:");
    });
  });

  describe("formatSuiteResult", () => {
    it("formats suite result for console", () => {
      const output = consoleReporter.formatSuiteResult(mockSuiteResult);
      expect(output).toContain("test-suite");
      expect(output).toContain("95.0%");
      expect(output).toContain("2/2");
      expect(output).toContain("2 passing, 0 failing");
    });
  });
});

describe("getReporter", () => {
  it("returns json reporter", () => {
    expect(getReporter("json")).toBe(jsonReporter);
  });

  it("returns markdown reporter", () => {
    expect(getReporter("markdown")).toBe(markdownReporter);
  });

  it("returns html reporter", () => {
    expect(getReporter("html")).toBe(htmlReporter);
  });

  it("returns console reporter", () => {
    expect(getReporter("console")).toBe(consoleReporter);
  });

  it("defaults to json reporter for unknown format", () => {
    // @ts-expect-error - testing invalid input
    expect(getReporter("unknown")).toBe(jsonReporter);
  });
});

describe("formatResult", () => {
  it("formats eval result with specified format", () => {
    const output = formatResult(mockEvalResult, "json");
    const parsed = JSON.parse(output);
    expect(parsed.scenario).toBe("test-scenario");
  });

  it("formats suite result with specified format", () => {
    const output = formatResult(mockSuiteResult, "json");
    const parsed = JSON.parse(output);
    expect(parsed.suite).toBe("test-suite");
  });

  it("defaults to console format", () => {
    const output = formatResult(mockEvalResult);
    expect(output).toContain("✓");
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe("Reporter Edge Cases", () => {
  describe("Empty Results", () => {
    const emptyResult: EvalResult = {
      scenario: "empty-scenario",
      passed: true,
      score: 1,
      durationMs: 0,
      toolCalls: [],
      assertions: [],
    };

    const emptySuiteResult: EvalSuiteResult = {
      suite: "empty-suite",
      passed: true,
      totalScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
      score: 1,
      durationMs: 0,
      results: [],
      timestamp: "2024-01-15T10:00:00.000Z",
    };

    it("json handles empty tool calls and assertions", () => {
      const output = jsonReporter.formatResult(emptyResult, {
        includeToolCalls: true,
        includeAssertions: true,
      });
      const parsed = JSON.parse(output);
      expect(parsed.toolCalls).toEqual([]);
      expect(parsed.assertions).toEqual([]);
    });

    it("markdown handles empty tool calls gracefully", () => {
      const output = markdownReporter.formatResult(emptyResult, { includeToolCalls: true });
      // Should not contain the "Tool Calls" section when empty
      expect(output).not.toContain("### Tool Calls");
    });

    it("markdown handles empty assertions gracefully", () => {
      const output = markdownReporter.formatResult(emptyResult, { includeAssertions: true });
      // Should not contain the "Assertions" section when empty
      expect(output).not.toContain("### Assertions");
    });

    it("html handles empty suite results", () => {
      const output = htmlReporter.formatSuiteResult(emptySuiteResult);
      expect(output).toContain("<!DOCTYPE html>");
      expect(output).toContain("0/0"); // Shows 0/0 passed
    });

    it("console handles empty suite results", () => {
      const output = consoleReporter.formatSuiteResult(emptySuiteResult);
      expect(output).toContain("0/0");
      expect(output).toContain("0 passing, 0 failing");
    });

    it("json handles empty suite results", () => {
      const output = jsonReporter.formatSuiteResult(emptySuiteResult);
      const parsed = JSON.parse(output);
      expect(parsed.results).toEqual([]);
      expect(parsed.totalScenarios).toBe(0);
    });
  });

  describe("Tool Call Errors", () => {
    const errorToolCallResult: EvalResult = {
      scenario: "error-tool-call",
      passed: false,
      score: 0.5,
      durationMs: 100,
      toolCalls: [
        {
          tool: "failing_tool",
          arguments: { input: "test" },
          result: {},
          durationMs: 50,
          error: "Tool execution failed: timeout",
        },
        {
          tool: "success_tool",
          arguments: {},
          result: { data: "ok" },
          durationMs: 10,
        },
      ],
      assertions: [],
    };

    it("markdown renders tool call errors", () => {
      const output = markdownReporter.formatResult(errorToolCallResult, { includeToolCalls: true });
      expect(output).toContain("### Tool Calls");
      expect(output).toContain("failing_tool");
      expect(output).toContain("Error: Tool execution failed: timeout");
    });

    it("html renders tool call errors", () => {
      const output = htmlReporter.formatResult(errorToolCallResult, { includeToolCalls: true });
      expect(output).toContain("Tool execution failed: timeout");
      expect(output).toContain('class="error"');
    });

    it("console renders tool call errors with status icons", () => {
      const output = consoleReporter.formatResult(errorToolCallResult, { includeToolCalls: true });
      // Check for red X for failing tool
      expect(output).toContain("failing_tool");
      expect(output).toContain("Tool execution failed: timeout");
      // Check for green check for success tool
      expect(output).toContain("success_tool");
    });
  });

  describe("Assertion Messages", () => {
    const assertionMessageResult: EvalResult = {
      scenario: "assertion-messages",
      passed: false,
      score: 0.5,
      durationMs: 100,
      toolCalls: [],
      assertions: [
        {
          assertion: { type: "contains", value: "expected text", weight: 1 },
          passed: true,
          score: 1,
          message: "Found expected text in response",
        },
        {
          assertion: { type: "llm-judge", criteria: "Is response helpful?", weight: 1 },
          passed: false,
          score: 0.3,
          message: "Response lacks specific details and actionable information",
        },
      ],
    };

    it("markdown renders assertion messages", () => {
      const output = markdownReporter.formatResult(assertionMessageResult, {
        includeAssertions: true,
      });
      expect(output).toContain("### Assertions");
      expect(output).toContain("Found expected text");
      expect(output).toContain("Response lacks specific details");
    });

    it("html renders assertion messages", () => {
      const output = htmlReporter.formatResult(assertionMessageResult, { includeAssertions: true });
      expect(output).toContain("Found expected text");
      expect(output).toContain("Response lacks specific details");
      expect(output).toContain('class="message"');
    });

    it("console only shows messages for failed assertions", () => {
      const output = consoleReporter.formatResult(assertionMessageResult, {
        includeAssertions: true,
      });
      // Should contain the failure message
      expect(output).toContain("Response lacks specific details");
      // Should NOT contain the success message (console only shows failure messages)
      expect(output).not.toContain("Found expected text");
    });
  });

  describe("Boundary Scores", () => {
    const zeroScoreResult: EvalResult = {
      scenario: "zero-score",
      passed: false,
      score: 0,
      durationMs: 100,
      toolCalls: [],
      assertions: [],
    };

    const perfectScoreResult: EvalResult = {
      scenario: "perfect-score",
      passed: true,
      score: 1,
      durationMs: 100,
      toolCalls: [],
      assertions: [],
    };

    it("markdown formats 0% score correctly", () => {
      const output = markdownReporter.formatResult(zeroScoreResult);
      expect(output).toContain("0.0%");
    });

    it("markdown formats 100% score correctly", () => {
      const formatted = markdownReporter.formatResult(perfectScoreResult);
      expect(formatted).toContain("100.0%");
    });

    it("console formats boundary scores correctly", () => {
      const zeroOutput = consoleReporter.formatResult(zeroScoreResult);
      expect(zeroOutput).toContain("(0%)");

      const perfectOutput = consoleReporter.formatResult(perfectScoreResult);
      expect(perfectOutput).toContain("(100%)");
    });

    it("html formats boundary scores correctly", () => {
      const zeroOutput = htmlReporter.formatResult(zeroScoreResult);
      expect(zeroOutput).toContain("0.0%");

      const perfectOutput = htmlReporter.formatResult(perfectScoreResult);
      expect(perfectOutput).toContain("100.0%");
    });
  });

  describe("Special Characters", () => {
    const specialCharsResult: EvalResult = {
      scenario: "Test with \"quotes\" & <brackets> and 'apostrophes'",
      passed: true,
      score: 0.8,
      durationMs: 100,
      toolCalls: [
        {
          tool: "test_tool",
          arguments: { query: '<script>alert("xss")</script>' },
          result: {},
          durationMs: 10,
        },
      ],
      assertions: [],
      error: 'Error: "Invalid" <input> & output',
    };

    it("html escapes all special characters in scenario name", () => {
      const output = htmlReporter.formatResult(specialCharsResult);
      expect(output).toContain("&quot;quotes&quot;");
      expect(output).toContain("&amp;");
      expect(output).toContain("&lt;brackets&gt;");
      expect(output).toContain("&#39;apostrophes&#39;");
    });

    it("html escapes special characters in error messages", () => {
      const output = htmlReporter.formatResult(specialCharsResult);
      expect(output).toContain("&quot;Invalid&quot;");
      expect(output).toContain("&lt;input&gt;");
    });

    it("html escapes special characters in tool arguments", () => {
      const output = htmlReporter.formatResult(specialCharsResult, { includeToolCalls: true });
      expect(output).not.toContain("<script>");
      expect(output).toContain("&lt;script&gt;");
    });

    it("json handles special characters without escaping markdown", () => {
      const output = jsonReporter.formatResult(specialCharsResult);
      const parsed = JSON.parse(output);
      // JSON should preserve the original characters (escaped in JSON format)
      expect(parsed.scenario).toContain('"quotes"');
      expect(parsed.scenario).toContain("<brackets>");
    });

    it("markdown preserves special characters", () => {
      const output = markdownReporter.formatResult(specialCharsResult);
      // Markdown doesn't need HTML escaping
      expect(output).toContain('"quotes"');
      expect(output).toContain("<brackets>");
    });
  });

  describe("Long Duration Values", () => {
    const longDurationResult: EvalResult = {
      scenario: "long-duration",
      passed: true,
      score: 1,
      durationMs: 123456789,
      toolCalls: [],
      assertions: [],
    };

    const longSuiteResult: EvalSuiteResult = {
      suite: "long-suite",
      passed: true,
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      score: 1,
      durationMs: 987654321,
      results: [longDurationResult],
      timestamp: "2024-01-15T10:00:00.000Z",
    };

    it("formats large millisecond values for results", () => {
      const output = consoleReporter.formatResult(longDurationResult);
      expect(output).toContain("123456789ms");
    });

    it("formats large duration in seconds for suite", () => {
      const output = consoleReporter.formatSuiteResult(longSuiteResult);
      // 987654321ms = 987654.32s
      expect(output).toContain("987654.32s");
    });
  });

  describe("Failed Only Filter", () => {
    const mixedSuiteResult: EvalSuiteResult = {
      suite: "mixed-results",
      passed: false,
      totalScenarios: 4,
      passedScenarios: 2,
      failedScenarios: 2,
      score: 0.5,
      durationMs: 400,
      results: [
        { ...mockEvalResult, scenario: "pass-1", passed: true },
        { ...mockEvalResult, scenario: "fail-1", passed: false },
        { ...mockEvalResult, scenario: "pass-2", passed: true },
        { ...mockEvalResult, scenario: "fail-2", passed: false },
      ],
      timestamp: "2024-01-15T10:00:00.000Z",
    };

    it("markdown shows only failed results when failedOnly is true", () => {
      const output = markdownReporter.formatSuiteResult(mixedSuiteResult, { failedOnly: true });
      expect(output).toContain("fail-1");
      expect(output).toContain("fail-2");
      expect(output).not.toContain("pass-1");
      expect(output).not.toContain("pass-2");
    });

    it("html shows only failed results when failedOnly is true", () => {
      const output = htmlReporter.formatSuiteResult(mixedSuiteResult, { failedOnly: true });
      expect(output).toContain("fail-1");
      expect(output).toContain("fail-2");
      expect(output).not.toContain("pass-1");
      expect(output).not.toContain("pass-2");
    });

    it("console shows only failed results when failedOnly is true", () => {
      const output = consoleReporter.formatSuiteResult(mixedSuiteResult, { failedOnly: true });
      expect(output).toContain("fail-1");
      expect(output).toContain("fail-2");
      expect(output).not.toContain("pass-1");
      expect(output).not.toContain("pass-2");
    });

    it("shows all results when failedOnly is false", () => {
      const output = markdownReporter.formatSuiteResult(mixedSuiteResult, { failedOnly: false });
      expect(output).toContain("fail-1");
      expect(output).toContain("fail-2");
      expect(output).toContain("pass-1");
      expect(output).toContain("pass-2");
    });
  });

  describe("No LLM Response", () => {
    const noResponseResult: EvalResult = {
      scenario: "no-response",
      passed: false,
      score: 0,
      durationMs: 100,
      toolCalls: [],
      assertions: [],
      // llmResponse is undefined
    };

    it("json handles missing llmResponse", () => {
      const output = jsonReporter.formatResult(noResponseResult);
      const parsed = JSON.parse(output);
      expect(parsed.llmResponse).toBeUndefined();
    });

    it("reporters handle missing llmResponse gracefully", () => {
      // These should not throw
      expect(() => markdownReporter.formatResult(noResponseResult)).not.toThrow();
      expect(() => htmlReporter.formatResult(noResponseResult)).not.toThrow();
      expect(() => consoleReporter.formatResult(noResponseResult)).not.toThrow();
    });
  });

  describe("Combined Options", () => {
    it("handles all options enabled simultaneously", () => {
      const fullOptions = {
        includeToolCalls: true,
        includeAssertions: true,
        includeTimestamps: true,
        prettyJson: true,
        failedOnly: false,
      };

      const output = jsonReporter.formatSuiteResult(mockSuiteResult, fullOptions);
      const parsed = JSON.parse(output);

      expect(parsed.timestamp).toBeDefined();
      expect(parsed.results[0].toolCalls).toBeDefined();
      expect(parsed.results[0].assertions).toBeDefined();
    });
  });
});
