/**
 * @mcp-toolkit/testing
 *
 * Testing harness and evals framework for MCP Toolkit.
 *
 * This package provides two main capabilities:
 *
 * 1. **Unit Test Harness** - For testing MCP tools, resources, and prompts
 *    in isolation without requiring a full MCP server or LLM connection.
 *
 * 2. **Evals Framework** - For running scripted, deterministic evaluations
 *    against real LLM providers with support for LLM-as-Judge assertions.
 *
 * @example Test Harness
 * ```typescript
 * import { createTestHarness, assertToolResult } from "@mcp-toolkit/testing/harness";
 *
 * const harness = createTestHarness({
 *   tools: {
 *     my_tool: async (args, ctx) => ({
 *       content: [{ type: "text", text: `Hello ${args.name}` }],
 *     }),
 *   },
 * });
 *
 * const { result } = await harness.callTool("my_tool", { name: "World" });
 * assertToolResult(result, { contentContains: "Hello World" });
 * ```
 *
 * @example Evals Framework
 * ```typescript
 * import { createEvalRunner, createAnthropicClient } from "@mcp-toolkit/testing/evals";
 * import { createTestHarness } from "@mcp-toolkit/testing/harness";
 *
 * const runner = createEvalRunner({
 *   harness: createTestHarness({ tools }),
 *   llmClient: createAnthropicClient({ model: "claude-sonnet-4-20250514" }),
 * });
 *
 * const result = await runner.runScenario({
 *   name: "basic-test",
 *   prompt: "Use my_tool",
 *   toolCalls: [{ tool: "my_tool", arguments: {} }],
 *   assertions: [{ type: "tool-called", tool: "my_tool" }],
 * });
 * ```
 *
 * @packageDocumentation
 */

// Evals Framework
export type {
  ChatMessage,
  ChatResponse,
  EvalOptions,
  EvalRunnerConfig,
  LLMClient,
  LLMClientFactory,
} from "./evals/index.js";
export {
  createAnthropicClient,
  createEvalRunner,
  createMockLLMClient,
  EvalRunner,
  evaluateAssertion,
} from "./evals/index.js";

// Test Harness
export type {
  HarnessContext,
  HarnessToolResult,
  PromptHandler,
  ResourceHandler,
  TestHarnessConfig,
  ToolHandler,
} from "./harness/index.js";

export {
  assertToolResult,
  createTestHarness,
  runTestCase,
  runTestCases,
  TestHarness,
} from "./harness/index.js";
// LLM-as-Judge
export type {
  JudgeConfig,
  JudgmentRequest,
  RubricCriterion,
  RubricResult,
} from "./judge/index.js";
export {
  createLLMJudge,
  LLMJudge,
  PRESET_RUBRICS,
} from "./judge/index.js";
// Reporters
export type {
  Reporter,
  ReporterOptions,
  ReportFormat,
} from "./reporters/index.js";
export {
  consoleReporter,
  formatResult,
  getReporter,
  htmlReporter,
  jsonReporter,
  markdownReporter,
} from "./reporters/index.js";
// Schema types
export type {
  Assertion,
  AssertionResult,
  AssertionType,
  EvalResult,
  EvalScenario,
  EvalSuite,
  EvalSuiteResult,
  ExpectedToolResult,
  JudgeVerdict,
  LLMConfig,
  LLMProvider,
  MockToolCall,
  ScriptedToolCall,
  TestCase,
  ToolCallResult,
} from "./schema.js";
export {
  AssertionResultSchema,
  AssertionSchema,
  AssertionTypeSchema,
  EvalResultSchema,
  EvalScenarioSchema,
  EvalSuiteResultSchema,
  EvalSuiteSchema,
  ExpectedToolResultSchema,
  JudgeVerdictSchema,
  LLMConfigSchema,
  LLMProviderSchema,
  MockToolCallSchema,
  ScriptedToolCallSchema,
  TestCaseSchema,
  ToolCallResultSchema,
} from "./schema.js";
