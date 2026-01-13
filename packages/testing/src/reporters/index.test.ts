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
