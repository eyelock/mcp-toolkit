/**
 * LLM-as-Judge Module
 *
 * Provides semantic evaluation of MCP tool outputs using an LLM as the judge.
 * Useful for evaluating subjective criteria like response quality, helpfulness,
 * or adherence to complex requirements.
 */

import type { ChatMessage, LLMClient } from "../evals/index.js";
import type { JudgeVerdict } from "../schema.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Judge configuration
 */
export interface JudgeConfig {
  /** LLM client to use for judging */
  client: LLMClient;
  /** System prompt for the judge (optional) */
  systemPrompt?: string;
  /** Temperature for judge responses (default: 0) */
  temperature?: number;
  /** Whether to use chain-of-thought reasoning */
  chainOfThought?: boolean;
}

/**
 * Judgment request
 */
export interface JudgmentRequest {
  /** Criteria to evaluate against */
  criteria: string;
  /** Content to evaluate */
  content: string;
  /** Additional context (optional) */
  context?: string;
  /** Reference/expected output (optional) */
  reference?: string;
}

/**
 * Rubric-based evaluation criteria
 */
export interface RubricCriterion {
  /** Criterion name */
  name: string;
  /** Description of what this criterion evaluates */
  description: string;
  /** Weight for scoring (0-1) */
  weight: number;
}

/**
 * Rubric-based judgment result
 */
export interface RubricResult {
  /** Overall verdict */
  verdict: JudgeVerdict;
  /** Per-criterion scores */
  criterionScores: Array<{
    criterion: string;
    score: number;
    reasoning: string;
  }>;
}

// =============================================================================
// Default Prompts
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are an expert evaluator for AI system outputs. Your role is to assess whether outputs meet specific criteria with accuracy and fairness.

Guidelines:
- Be objective and consistent in your evaluations
- Consider edge cases and nuances
- Provide clear reasoning for your judgments
- Score on a 0-1 scale where 0 is complete failure and 1 is perfect`;

const CHAIN_OF_THOUGHT_PROMPT = `Before providing your final judgment, think through the evaluation step by step:
1. Identify the key requirements in the criteria
2. Check each requirement against the content
3. Note any partial matches or edge cases
4. Determine the overall assessment`;

// =============================================================================
// LLM Judge
// =============================================================================

/**
 * LLM-as-Judge for semantic evaluation
 *
 * @example
 * ```typescript
 * const judge = new LLMJudge({
 *   client: createAnthropicClient({ model: "claude-sonnet-4-20250514" }),
 * });
 *
 * const verdict = await judge.evaluate({
 *   criteria: "Response should be helpful and accurate",
 *   content: "The answer is 42",
 *   context: "User asked: What is the meaning of life?",
 * });
 * ```
 */
export class LLMJudge {
  private readonly client: LLMClient;
  private readonly systemPrompt: string;
  private readonly chainOfThought: boolean;

  constructor(config: JudgeConfig) {
    this.client = config.client;
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.chainOfThought = config.chainOfThought ?? false;
  }

  /**
   * Evaluate content against criteria
   */
  async evaluate(request: JudgmentRequest): Promise<JudgeVerdict> {
    const prompt = this.buildEvaluationPrompt(request);
    const messages: ChatMessage[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: prompt },
    ];

    const response = await this.client.chat(messages);
    return this.parseVerdict(response.content, request.criteria);
  }

  /**
   * Evaluate content against a rubric with multiple criteria
   */
  async evaluateWithRubric(
    content: string,
    rubric: RubricCriterion[],
    context?: string
  ): Promise<RubricResult> {
    const criterionScores: RubricResult["criterionScores"] = [];

    for (const criterion of rubric) {
      const verdict = await this.evaluate({
        criteria: `${criterion.name}: ${criterion.description}`,
        content,
        context,
      });

      criterionScores.push({
        criterion: criterion.name,
        score: verdict.score,
        reasoning: verdict.reasoning,
      });
    }

    // Calculate weighted score
    const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0);
    const weightedScore =
      totalWeight > 0
        ? criterionScores.reduce((sum, cs, i) => {
            const rubricItem = rubric[i];
            return sum + cs.score * (rubricItem?.weight ?? 1);
          }, 0) / totalWeight
        : 0;

    // Determine pass/fail based on weighted score (>= 0.7 passes)
    const passed = weightedScore >= 0.7;

    return {
      verdict: {
        passed,
        score: weightedScore,
        reasoning: this.summarizeRubricResults(criterionScores),
        criteria: rubric.map((c) => c.name).join(", "),
      },
      criterionScores,
    };
  }

  /**
   * Compare content against a reference output
   */
  async compareToReference(
    content: string,
    reference: string,
    criteria?: string
  ): Promise<JudgeVerdict> {
    return this.evaluate({
      criteria: criteria ?? "Content should match the reference in meaning and quality",
      content,
      reference,
    });
  }

  /**
   * Binary pass/fail evaluation
   */
  async passFail(content: string, criteria: string, context?: string): Promise<boolean> {
    const verdict = await this.evaluate({ criteria, content, context });
    return verdict.passed;
  }

  /**
   * Build evaluation prompt
   */
  private buildEvaluationPrompt(request: JudgmentRequest): string {
    let prompt = `## Evaluation Criteria
${request.criteria}

## Content to Evaluate
${request.content}`;

    if (request.context) {
      prompt += `

## Context
${request.context}`;
    }

    if (request.reference) {
      prompt += `

## Reference Output
${request.reference}`;
    }

    if (this.chainOfThought) {
      prompt += `

${CHAIN_OF_THOUGHT_PROMPT}`;
    }

    prompt += `

## Instructions
Evaluate the content against the criteria. Respond in JSON format:
{
  "passed": true/false,
  "score": 0.0-1.0,
  "reasoning": "detailed explanation"
}

Only output the JSON, nothing else.`;

    return prompt;
  }

  /**
   * Parse verdict from LLM response
   */
  private parseVerdict(response: string, criteria: string): JudgeVerdict {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          passed: false,
          score: 0,
          reasoning: "Could not parse judge response",
          criteria,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        passed: Boolean(parsed.passed),
        score: typeof parsed.score === "number" ? Math.min(1, Math.max(0, parsed.score)) : 0,
        reasoning: String(parsed.reasoning || ""),
        criteria,
      };
    } catch {
      return {
        passed: false,
        score: 0,
        reasoning: "Failed to parse judge response JSON",
        criteria,
      };
    }
  }

  /**
   * Summarize rubric evaluation results
   */
  private summarizeRubricResults(scores: RubricResult["criterionScores"]): string {
    const summaries = scores.map((s) => `${s.criterion}: ${(s.score * 100).toFixed(0)}%`);
    return summaries.join("; ");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an LLM judge
 */
export function createLLMJudge(config: JudgeConfig): LLMJudge {
  return new LLMJudge(config);
}

// =============================================================================
// Preset Rubrics
// =============================================================================

/**
 * Common evaluation rubrics for MCP tools
 */
export const PRESET_RUBRICS = {
  /**
   * General quality rubric
   */
  quality: [
    {
      name: "Accuracy",
      description: "The output is factually correct and free of errors",
      weight: 0.4,
    },
    {
      name: "Completeness",
      description: "The output addresses all aspects of the request",
      weight: 0.3,
    },
    {
      name: "Clarity",
      description: "The output is clear and easy to understand",
      weight: 0.3,
    },
  ] as RubricCriterion[],

  /**
   * Tool behavior rubric
   */
  toolBehavior: [
    {
      name: "Correctness",
      description: "The tool produces the expected results for the given inputs",
      weight: 0.5,
    },
    {
      name: "Error Handling",
      description: "The tool handles errors gracefully and provides useful feedback",
      weight: 0.3,
    },
    {
      name: "Efficiency",
      description: "The tool completes in a reasonable time without unnecessary operations",
      weight: 0.2,
    },
  ] as RubricCriterion[],

  /**
   * User experience rubric
   */
  userExperience: [
    {
      name: "Helpfulness",
      description: "The output is useful and addresses the user's needs",
      weight: 0.4,
    },
    {
      name: "Tone",
      description: "The tone is appropriate and professional",
      weight: 0.2,
    },
    {
      name: "Actionability",
      description: "The output provides clear next steps or actions",
      weight: 0.4,
    },
  ] as RubricCriterion[],
};
