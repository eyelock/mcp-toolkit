# @mcp-toolkit/testing

Testing harness and evaluation framework for MCP tools and workflows.

## Features

- **Test Harness**: Mock MCP server for testing tools in isolation
- **Evals Framework**: Run evaluations with real or mock LLM clients
- **Judge System**: Automated response quality assessment
- **Reporters**: Structured test result reporting

## Installation

```bash
pnpm add @mcp-toolkit/testing
```

## Usage

### Test Harness

Test MCP tools without running a full server:

```typescript
import { createTestHarness, assertToolResult } from "@mcp-toolkit/testing/harness";

describe("my tool", () => {
  const harness = createTestHarness({
    tools: {
      my_tool: async (args) => ({
        content: [{ type: "text", text: `Query: ${args.query}` }],
      }),
    },
  });

  it("should handle valid input", async () => {
    const { result } = await harness.callTool("my_tool", {
      query: "test query",
    });

    assertToolResult(result, { contentContains: "test" });
  });
});
```

### Evals Framework

Run evaluations against tool implementations:

```typescript
import { createEvalRunner, createMockLLMClient } from "@mcp-toolkit/testing/evals";
import { createTestHarness } from "@mcp-toolkit/testing/harness";

const runner = createEvalRunner({
  harness: createTestHarness({ tools: myTools }),
  llmClient: createMockLLMClient([
    { content: "Expected response" },
  ]),
});

const result = await runner.runScenario({
  name: "basic test",
  prompt: "Test the tool",
  toolCalls: [{ tool: "my_tool", arguments: {} }],
  assertions: [{ type: "tool-called", tool: "my_tool" }],
});
```

### Judge System

LLM-as-Judge for automated response quality assessment:

```typescript
import { createLLMJudge, PRESET_RUBRICS } from "@mcp-toolkit/testing/judge";
import { createAnthropicClient } from "@mcp-toolkit/testing/evals";

const judge = createLLMJudge({
  llmClient: createAnthropicClient({ model: "claude-sonnet-4-20250514" }),
  rubric: PRESET_RUBRICS.correctness,
});

const verdict = await judge.evaluate({
  input: "What is 2+2?",
  output: "The answer is 4.",
  expected: "4",
});

console.log(verdict.score);    // 0-1 score
console.log(verdict.feedback); // Detailed feedback
```

### Reporters

Generate structured test reports in multiple formats:

```typescript
import { getReporter, formatResult } from "@mcp-toolkit/testing/reporters";

const reporter = getReporter("markdown"); // or "json", "html", "console"

const evalResult = { /* from runner.runScenario() */ };
const output = reporter(evalResult);
console.log(output);

// Or format individual results
const formatted = formatResult(evalResult, "markdown");
```

## API Reference

### TestHarness

```typescript
interface TestHarnessConfig {
  tools?: Record<string, ToolHandler>;
  resources?: Record<string, ResourceHandler>;
  prompts?: Record<string, PromptHandler>;
}

const harness = createTestHarness(config);
const { result } = await harness.callTool(name, args);
```

### EvalRunner

```typescript
interface EvalRunnerConfig {
  harness: TestHarness;
  llmClient: LLMClient;
  timeout?: number;
}

const runner = createEvalRunner(config);
const result = await runner.runScenario(scenario);
const results = await runner.runSuite(suite);
```

### LLM Clients

```typescript
// Mock client for testing (no API calls)
const mockClient = createMockLLMClient([
  { content: "Response 1" },
  { content: "Response 2" },
]);

// Real Anthropic client (requires API key)
const realClient = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-20250514",
  maxTokens: 1024,
});
```

## Build Commands

```bash
pnpm build          # Build package
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm test:coverage  # With coverage
pnpm typecheck      # Type check
```

## Exports

```typescript
// Main entry - everything re-exported
import {
  createTestHarness,
  createEvalRunner,
  createLLMJudge,
} from "@mcp-toolkit/testing";

// Subpath exports
import { TestHarness, createTestHarness, assertToolResult } from "@mcp-toolkit/testing/harness";
import { EvalRunner, createEvalRunner, createMockLLMClient, createAnthropicClient } from "@mcp-toolkit/testing/evals";
import { LLMJudge, createLLMJudge, PRESET_RUBRICS } from "@mcp-toolkit/testing/judge";
import { getReporter, formatResult, jsonReporter, markdownReporter } from "@mcp-toolkit/testing/reporters";
```
