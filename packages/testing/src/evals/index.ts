/**
 * Evals Framework
 *
 * Provides scripted, deterministic evaluation of MCP tools against real LLM providers.
 * Designed for integration testing where tool calls follow a predetermined sequence.
 */

import type {
  Assertion,
  AssertionResult,
  EvalResult,
  EvalScenario,
  EvalSuite,
  EvalSuiteResult,
  LLMConfig,
  ToolCallResult,
} from "../schema.js";
import type { TestHarness } from "../harness/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * LLM client interface for provider abstraction
 */
export interface LLMClient {
  /**
   * Send a message and get a response
   */
  chat(messages: ChatMessage[]): Promise<ChatResponse>;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Chat response format
 */
export interface ChatResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

/**
 * LLM client factory type
 */
export type LLMClientFactory = (config: LLMConfig) => LLMClient;

/**
 * Eval runner configuration
 */
export interface EvalRunnerConfig {
  /** Test harness for tool execution */
  harness: TestHarness;
  /** LLM client for evaluations */
  llmClient?: LLMClient;
  /** LLM configuration (used if llmClient not provided) */
  llmConfig?: LLMConfig;
  /** LLM client factory */
  clientFactory?: LLMClientFactory;
  /** Judge client for LLM-as-Judge assertions (can be different from main client) */
  judgeClient?: LLMClient;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Eval execution options
 */
export interface EvalOptions {
  /** Tags to filter scenarios */
  tags?: string[];
  /** Only run scenarios matching these names */
  names?: string[];
  /** Skip scenarios matching these names */
  skip?: string[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// =============================================================================
// Assertion Evaluators
// =============================================================================

/**
 * Evaluate a single assertion against eval results
 */
export function evaluateAssertion(
  assertion: Assertion,
  toolCalls: ToolCallResult[],
  llmResponse: string | undefined
): AssertionResult {
  const baseResult = {
    assertion,
    passed: false,
    score: 0,
  };

  switch (assertion.type) {
    case "tool-called": {
      if (!assertion.tool) {
        return { ...baseResult, message: "Missing tool name for tool-called assertion" };
      }
      const called = toolCalls.some((tc) => tc.tool === assertion.tool);
      return {
        ...baseResult,
        passed: called,
        score: called ? 1 : 0,
        message: called ? undefined : `Tool "${assertion.tool}" was not called`,
      };
    }

    case "tool-not-called": {
      if (!assertion.tool) {
        return { ...baseResult, message: "Missing tool name for tool-not-called assertion" };
      }
      const notCalled = !toolCalls.some((tc) => tc.tool === assertion.tool);
      return {
        ...baseResult,
        passed: notCalled,
        score: notCalled ? 1 : 0,
        message: notCalled
          ? undefined
          : `Tool "${assertion.tool}" was called but shouldn't have been`,
      };
    }

    case "tool-args-match": {
      if (!assertion.tool || !assertion.args) {
        return { ...baseResult, message: "Missing tool or args for tool-args-match assertion" };
      }
      const toolCall = toolCalls.find((tc) => tc.tool === assertion.tool);
      if (!toolCall) {
        return { ...baseResult, message: `Tool "${assertion.tool}" was not called` };
      }
      const argsMatch = objectContains(toolCall.arguments, assertion.args);
      return {
        ...baseResult,
        passed: argsMatch,
        score: argsMatch ? 1 : 0,
        message: argsMatch ? undefined : "Tool args did not match expected",
      };
    }

    case "response-contains": {
      if (!assertion.text) {
        return { ...baseResult, message: "Missing text for response-contains assertion" };
      }
      const contains = llmResponse?.includes(assertion.text) ?? false;
      return {
        ...baseResult,
        passed: contains,
        score: contains ? 1 : 0,
        message: contains ? undefined : `Response did not contain "${assertion.text}"`,
      };
    }

    case "response-matches": {
      if (!assertion.pattern) {
        return { ...baseResult, message: "Missing pattern for response-matches assertion" };
      }
      const regex = new RegExp(assertion.pattern);
      const matches = regex.test(llmResponse ?? "");
      return {
        ...baseResult,
        passed: matches,
        score: matches ? 1 : 0,
        message: matches ? undefined : `Response did not match pattern "${assertion.pattern}"`,
      };
    }

    case "llm-judge": {
      // LLM-as-Judge requires async evaluation, return placeholder
      // Actual evaluation happens in evaluateAssertionAsync
      return {
        ...baseResult,
        message: "LLM-as-Judge requires async evaluation",
      };
    }

    case "custom": {
      if (!assertion.fn) {
        return { ...baseResult, message: "Missing function for custom assertion" };
      }
      try {
        const passed = assertion.fn({ toolCalls, llmResponse });
        return {
          ...baseResult,
          passed,
          score: passed ? 1 : 0,
        };
      } catch (error) {
        return {
          ...baseResult,
          message: `Custom assertion threw: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    default:
      return { ...baseResult, message: `Unknown assertion type: ${assertion.type}` };
  }
}

/**
 * Check if an object contains all properties from another object
 */
function objectContains(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) {
      return false;
    }
    if (typeof value === "object" && value !== null) {
      if (typeof actual[key] !== "object" || actual[key] === null) {
        return false;
      }
      if (
        !objectContains(actual[key] as Record<string, unknown>, value as Record<string, unknown>)
      ) {
        return false;
      }
    } else if (actual[key] !== value) {
      return false;
    }
  }
  return true;
}

// =============================================================================
// Eval Runner
// =============================================================================

/**
 * Eval Runner for executing scripted evaluations
 *
 * @example
 * ```typescript
 * const runner = new EvalRunner({
 *   harness: createTestHarness({ tools: { my_tool: handler } }),
 *   llmConfig: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
 * });
 *
 * const result = await runner.runScenario({
 *   name: "basic-tool-call",
 *   prompt: "Use my_tool to do something",
 *   toolCalls: [{ tool: "my_tool", arguments: { input: "test" } }],
 *   assertions: [{ type: "tool-called", tool: "my_tool" }],
 * });
 * ```
 */
export class EvalRunner {
  private readonly harness: TestHarness;
  private readonly llmClient?: LLMClient;
  private readonly judgeClient?: LLMClient;
  private readonly signal?: AbortSignal;

  constructor(config: EvalRunnerConfig) {
    this.harness = config.harness;
    this.signal = config.signal;

    // Create LLM client from config if not provided
    if (config.llmClient) {
      this.llmClient = config.llmClient;
    } else if (config.llmConfig && config.clientFactory) {
      this.llmClient = config.clientFactory(config.llmConfig);
    }

    this.judgeClient = config.judgeClient ?? this.llmClient;
  }

  /**
   * Run a single eval scenario
   */
  async runScenario(scenario: EvalScenario): Promise<EvalResult> {
    const start = performance.now();
    const toolCalls: ToolCallResult[] = [];
    const assertions: AssertionResult[] = [];
    let llmResponse: string | undefined;

    try {
      // Check for cancellation
      if (this.signal?.aborted) {
        throw new Error("Evaluation cancelled");
      }

      // Execute scripted tool calls
      for (const scriptedCall of scenario.toolCalls) {
        const callStart = performance.now();
        const { result } = await this.harness.callTool(scriptedCall.tool, scriptedCall.arguments);

        const toolCallResult: ToolCallResult = {
          tool: scriptedCall.tool,
          arguments: scriptedCall.arguments,
          result,
          durationMs: performance.now() - callStart,
        };

        // Check scripted call expectations
        if (scriptedCall.expectedResult) {
          if (
            scriptedCall.expectedResult.isError !== undefined &&
            result.isError !== scriptedCall.expectedResult.isError
          ) {
            toolCallResult.error = `Expected isError=${scriptedCall.expectedResult.isError}, got ${result.isError}`;
          }
        }

        toolCalls.push(toolCallResult);

        // Check for cancellation between calls
        if (this.signal?.aborted) {
          throw new Error("Evaluation cancelled");
        }
      }

      // Get LLM response if client is available and prompt exists
      if (this.llmClient && scenario.prompt) {
        const response = await this.llmClient.chat([{ role: "user", content: scenario.prompt }]);
        llmResponse = response.content;
      }

      // Evaluate assertions
      for (const assertion of scenario.assertions) {
        const result = await this.evaluateAssertionAsync(assertion, toolCalls, llmResponse);
        assertions.push(result);
      }

      // Calculate score based on scoring criteria
      const { passed, score } = this.calculateScore(scenario, assertions);

      return {
        scenario: scenario.name,
        passed,
        score,
        durationMs: performance.now() - start,
        toolCalls,
        assertions,
        llmResponse,
      };
    } catch (error) {
      return {
        scenario: scenario.name,
        passed: false,
        score: 0,
        durationMs: performance.now() - start,
        toolCalls,
        assertions,
        llmResponse,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run multiple scenarios
   */
  async runScenarios(scenarios: EvalScenario[], options?: EvalOptions): Promise<EvalResult[]> {
    const filtered = this.filterScenarios(scenarios, options);
    const results: EvalResult[] = [];

    for (const scenario of filtered) {
      if (this.signal?.aborted || options?.signal?.aborted) {
        break;
      }
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run an entire eval suite
   */
  async runSuite(suite: EvalSuite, options?: EvalOptions): Promise<EvalSuiteResult> {
    const start = performance.now();

    // Run setup
    if (suite.setup) {
      await suite.setup();
    }

    try {
      const results = await this.runScenarios(suite.scenarios, options);
      const passedScenarios = results.filter((r) => r.passed).length;
      const totalScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

      return {
        suite: suite.name,
        passed: passedScenarios === results.length,
        totalScenarios: results.length,
        passedScenarios,
        failedScenarios: results.length - passedScenarios,
        score: totalScore,
        durationMs: performance.now() - start,
        results,
        timestamp: new Date().toISOString(),
      };
    } finally {
      // Run teardown
      if (suite.teardown) {
        await suite.teardown();
      }
    }
  }

  /**
   * Evaluate an assertion asynchronously (for LLM-as-Judge)
   */
  private async evaluateAssertionAsync(
    assertion: Assertion,
    toolCalls: ToolCallResult[],
    llmResponse: string | undefined
  ): Promise<AssertionResult> {
    // Handle LLM-as-Judge separately
    if (assertion.type === "llm-judge") {
      return this.evaluateLLMJudge(assertion, toolCalls, llmResponse);
    }

    // Use sync evaluation for other types
    return evaluateAssertion(assertion, toolCalls, llmResponse);
  }

  /**
   * Evaluate LLM-as-Judge assertion
   */
  private async evaluateLLMJudge(
    assertion: Assertion,
    toolCalls: ToolCallResult[],
    llmResponse: string | undefined
  ): Promise<AssertionResult> {
    if (!this.judgeClient) {
      return {
        assertion,
        passed: false,
        score: 0,
        message: "No judge client configured for LLM-as-Judge assertion",
      };
    }

    if (!assertion.criteria) {
      return {
        assertion,
        passed: false,
        score: 0,
        message: "Missing criteria for LLM-as-Judge assertion",
      };
    }

    try {
      const judgePrompt = this.buildJudgePrompt(assertion.criteria, toolCalls, llmResponse);
      const response = await this.judgeClient.chat([{ role: "user", content: judgePrompt }]);
      const verdict = this.parseJudgeResponse(response.content);

      return {
        assertion,
        passed: verdict.passed,
        score: verdict.score,
        message: verdict.reasoning,
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        score: 0,
        message: `LLM-as-Judge failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Build prompt for LLM-as-Judge
   */
  private buildJudgePrompt(
    criteria: string,
    toolCalls: ToolCallResult[],
    llmResponse: string | undefined
  ): string {
    const toolCallsSummary = toolCalls
      .map((tc) => `- ${tc.tool}(${JSON.stringify(tc.arguments)}) -> ${JSON.stringify(tc.result)}`)
      .join("\n");

    return `You are an evaluator judging whether a system's behavior meets specific criteria.

## Criteria
${criteria}

## Tool Calls Made
${toolCallsSummary || "No tool calls"}

## Response
${llmResponse || "No response"}

## Instructions
Evaluate whether the behavior above meets the criteria. Respond in JSON format:
{
  "passed": true/false,
  "score": 0.0-1.0,
  "reasoning": "explanation"
}

Only output the JSON, nothing else.`;
  }

  /**
   * Parse LLM-as-Judge response
   */
  private parseJudgeResponse(response: string): {
    passed: boolean;
    score: number;
    reasoning: string;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { passed: false, score: 0, reasoning: "Could not parse judge response" };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        passed: Boolean(parsed.passed),
        score: typeof parsed.score === "number" ? Math.min(1, Math.max(0, parsed.score)) : 0,
        reasoning: String(parsed.reasoning || ""),
      };
    } catch {
      return { passed: false, score: 0, reasoning: "Failed to parse judge response JSON" };
    }
  }

  /**
   * Calculate pass/fail and score based on scoring criteria
   */
  private calculateScore(
    scenario: EvalScenario,
    assertions: AssertionResult[]
  ): { passed: boolean; score: number } {
    if (assertions.length === 0) {
      return { passed: true, score: 1 };
    }

    const { passCriteria, threshold } = scenario.scoring;

    switch (passCriteria) {
      case "all-assertions": {
        const passed = assertions.every((a) => a.passed);
        const score = assertions.reduce((sum, a) => sum + a.score, 0) / assertions.length;
        return { passed, score };
      }

      case "any-assertion": {
        const passed = assertions.some((a) => a.passed);
        const score = Math.max(...assertions.map((a) => a.score));
        return { passed, score };
      }

      case "weighted-threshold": {
        const totalWeight = scenario.assertions.reduce((sum, a) => sum + a.weight, 0);
        const weightedScore = assertions.reduce((sum, a, i) => {
          const scenarioAssertion = scenario.assertions[i];
          const weight = scenarioAssertion?.weight ?? 1;
          return sum + a.score * weight;
        }, 0);
        const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
        return { passed: score >= threshold, score };
      }

      default:
        return { passed: false, score: 0 };
    }
  }

  /**
   * Filter scenarios based on options
   */
  private filterScenarios(scenarios: EvalScenario[], options?: EvalOptions): EvalScenario[] {
    if (!options) return scenarios;

    return scenarios.filter((scenario) => {
      // Filter by names
      if (options.names && options.names.length > 0) {
        if (!options.names.includes(scenario.name)) return false;
      }

      // Filter by skip
      if (options.skip?.includes(scenario.name)) {
        return false;
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        if (!options.tags.some((tag) => scenario.tags.includes(tag))) return false;
      }

      return true;
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an eval runner
 */
export function createEvalRunner(config: EvalRunnerConfig): EvalRunner {
  return new EvalRunner(config);
}

// =============================================================================
// LLM Client Implementations
// =============================================================================

/**
 * Create an Anthropic LLM client
 */
export function createAnthropicClient(config: LLMConfig): LLMClient {
  // Dynamic import to avoid bundling if not used
  return {
    async chat(messages: ChatMessage[]): Promise<ChatResponse> {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });

      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        messages: messages.map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        })),
      });

      const textContent = response.content.find((c) => c.type === "text");
      return {
        content: textContent?.type === "text" ? textContent.text : "",
      };
    },
  };
}

/**
 * Create a mock LLM client for testing
 */
export function createMockLLMClient(responses: ChatResponse[]): LLMClient {
  let callIndex = 0;
  return {
    async chat(): Promise<ChatResponse> {
      if (responses.length === 0) {
        return { content: "" };
      }
      const index = callIndex % responses.length;
      const response = responses[index];
      callIndex++;
      return response ?? { content: "" };
    },
  };
}
