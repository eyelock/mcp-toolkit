/**
 * LLM-as-Judge Tests
 */

import { describe, expect, it, vi } from "vitest";
import type { LLMClient } from "../evals/index.js";
import { LLMJudge, PRESET_RUBRICS, createLLMJudge } from "./index.js";

function createMockJudgeClient(response: string): LLMClient {
  return {
    async chat() {
      return { content: response };
    },
  };
}

describe("LLMJudge", () => {
  describe("evaluate", () => {
    it("parses valid JSON verdict", async () => {
      const client = createMockJudgeClient(
        JSON.stringify({
          passed: true,
          score: 0.9,
          reasoning: "Content meets criteria",
        })
      );

      const judge = new LLMJudge({ client });
      const verdict = await judge.evaluate({
        criteria: "Content should be helpful",
        content: "This is helpful content",
      });

      expect(verdict.passed).toBe(true);
      expect(verdict.score).toBe(0.9);
      expect(verdict.reasoning).toBe("Content meets criteria");
      expect(verdict.criteria).toBe("Content should be helpful");
    });

    it("handles invalid JSON response", async () => {
      const client = createMockJudgeClient("Invalid response");

      const judge = new LLMJudge({ client });
      const verdict = await judge.evaluate({
        criteria: "Test criteria",
        content: "Test content",
      });

      expect(verdict.passed).toBe(false);
      expect(verdict.score).toBe(0);
      expect(verdict.reasoning).toContain("Could not parse");
    });

    it("extracts JSON from mixed response", async () => {
      const client = createMockJudgeClient(
        `Here's my analysis:\n${JSON.stringify({ passed: true, score: 0.8, reasoning: "Good" })}\n\nEnd of response.`
      );

      const judge = new LLMJudge({ client });
      const verdict = await judge.evaluate({
        criteria: "Test",
        content: "Test",
      });

      expect(verdict.passed).toBe(true);
      expect(verdict.score).toBe(0.8);
    });

    it("clamps score to valid range", async () => {
      const client = createMockJudgeClient(
        JSON.stringify({ passed: true, score: 1.5, reasoning: "High" })
      );

      const judge = new LLMJudge({ client });
      const verdict = await judge.evaluate({
        criteria: "Test",
        content: "Test",
      });

      expect(verdict.score).toBe(1);
    });

    it("includes context in prompt", async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: JSON.stringify({ passed: true, score: 1, reasoning: "OK" }),
      });
      const client: LLMClient = { chat: chatSpy };

      const judge = new LLMJudge({ client });
      await judge.evaluate({
        criteria: "Be helpful",
        content: "Response",
        context: "User asked for help",
      });

      expect(chatSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("User asked for help"),
          }),
        ])
      );
    });

    it("includes reference in prompt", async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: JSON.stringify({ passed: true, score: 1, reasoning: "OK" }),
      });
      const client: LLMClient = { chat: chatSpy };

      const judge = new LLMJudge({ client });
      await judge.evaluate({
        criteria: "Match reference",
        content: "Actual",
        reference: "Expected",
      });

      expect(chatSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("Expected"),
          }),
        ])
      );
    });
  });

  describe("evaluateWithRubric", () => {
    it("evaluates multiple criteria", async () => {
      const client = createMockJudgeClient(
        JSON.stringify({ passed: true, score: 0.8, reasoning: "Good" })
      );

      const judge = new LLMJudge({ client });
      const result = await judge.evaluateWithRubric("Test content", [
        { name: "Accuracy", description: "Is accurate", weight: 0.5 },
        { name: "Clarity", description: "Is clear", weight: 0.5 },
      ]);

      expect(result.criterionScores).toHaveLength(2);
      expect(result.verdict.passed).toBe(true);
    });

    it("calculates weighted score", async () => {
      let callCount = 0;
      const client: LLMClient = {
        async chat() {
          callCount++;
          const score = callCount === 1 ? 1.0 : 0.5;
          return {
            content: JSON.stringify({ passed: true, score, reasoning: "OK" }),
          };
        },
      };

      const judge = new LLMJudge({ client });
      const result = await judge.evaluateWithRubric("Test", [
        { name: "High", description: "High weight", weight: 0.8 },
        { name: "Low", description: "Low weight", weight: 0.2 },
      ]);

      // Weighted: (1.0 * 0.8 + 0.5 * 0.2) / 1.0 = 0.9
      expect(result.verdict.score).toBe(0.9);
      expect(result.verdict.passed).toBe(true); // >= 0.7
    });

    it("determines pass/fail based on 0.7 threshold", async () => {
      const client = createMockJudgeClient(
        JSON.stringify({ passed: true, score: 0.5, reasoning: "Mediocre" })
      );

      const judge = new LLMJudge({ client });
      const result = await judge.evaluateWithRubric("Test", [
        { name: "Only", description: "Only criterion", weight: 1 },
      ]);

      expect(result.verdict.passed).toBe(false); // 0.5 < 0.7
    });
  });

  describe("compareToReference", () => {
    it("compares content to reference", async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: JSON.stringify({ passed: true, score: 0.9, reasoning: "Close match" }),
      });
      const client: LLMClient = { chat: chatSpy };

      const judge = new LLMJudge({ client });
      const verdict = await judge.compareToReference("The quick brown fox", "A quick brown fox");

      expect(verdict.passed).toBe(true);
      expect(chatSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("A quick brown fox"),
          }),
        ])
      );
    });

    it("uses custom criteria if provided", async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: JSON.stringify({ passed: true, score: 1, reasoning: "OK" }),
      });
      const client: LLMClient = { chat: chatSpy };

      const judge = new LLMJudge({ client });
      await judge.compareToReference("Content", "Reference", "Custom criteria");

      expect(chatSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("Custom criteria"),
          }),
        ])
      );
    });
  });

  describe("passFail", () => {
    it("returns true for passing content", async () => {
      const client = createMockJudgeClient(
        JSON.stringify({ passed: true, score: 1, reasoning: "Passed" })
      );

      const judge = new LLMJudge({ client });
      const result = await judge.passFail("Good content", "Is good");

      expect(result).toBe(true);
    });

    it("returns false for failing content", async () => {
      const client = createMockJudgeClient(
        JSON.stringify({ passed: false, score: 0, reasoning: "Failed" })
      );

      const judge = new LLMJudge({ client });
      const result = await judge.passFail("Bad content", "Is good");

      expect(result).toBe(false);
    });
  });

  describe("chain of thought", () => {
    it("includes CoT prompt when enabled", async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: JSON.stringify({ passed: true, score: 1, reasoning: "OK" }),
      });
      const client: LLMClient = { chat: chatSpy };

      const judge = new LLMJudge({ client, chainOfThought: true });
      await judge.evaluate({ criteria: "Test", content: "Test" });

      expect(chatSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("think through"),
          }),
        ])
      );
    });
  });
});

describe("createLLMJudge", () => {
  it("creates a judge instance", () => {
    const client = createMockJudgeClient("{}");
    const judge = createLLMJudge({ client });
    expect(judge).toBeInstanceOf(LLMJudge);
  });
});

describe("PRESET_RUBRICS", () => {
  it("exports quality rubric", () => {
    expect(PRESET_RUBRICS.quality).toBeDefined();
    expect(PRESET_RUBRICS.quality).toHaveLength(3);
    expect(PRESET_RUBRICS.quality[0].name).toBe("Accuracy");
  });

  it("exports toolBehavior rubric", () => {
    expect(PRESET_RUBRICS.toolBehavior).toBeDefined();
    expect(PRESET_RUBRICS.toolBehavior).toHaveLength(3);
    expect(PRESET_RUBRICS.toolBehavior[0].name).toBe("Correctness");
  });

  it("exports userExperience rubric", () => {
    expect(PRESET_RUBRICS.userExperience).toBeDefined();
    expect(PRESET_RUBRICS.userExperience).toHaveLength(3);
    expect(PRESET_RUBRICS.userExperience[0].name).toBe("Helpfulness");
  });

  it("has valid weight distribution", () => {
    for (const rubric of Object.values(PRESET_RUBRICS)) {
      const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 5);
    }
  });
});

describe("LLMJudge JSON Parsing Edge Cases", () => {
  it("handles malformed JSON in response", async () => {
    const client: LLMClient = {
      async chat() {
        return {
          content: '{ "passed": true, "score": invalid_syntax }',
        };
      },
    };

    const judge = new LLMJudge({ client });
    const result = await judge.evaluate({
      criteria: "Test criteria",
      content: "Test content",
    });

    // JSON.parse should fail, triggering catch block
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasoning).toContain("parse");
  });

  it("handles response with no JSON object", async () => {
    const client: LLMClient = {
      async chat() {
        return {
          content: "This response has no JSON at all, just plain text",
        };
      },
    };

    const judge = new LLMJudge({ client });
    const result = await judge.evaluate({
      criteria: "Test criteria",
      content: "Test content",
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasoning).toContain("Could not parse");
  });
});
