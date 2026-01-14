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
import { McpTestHarness } from "@mcp-toolkit/testing/harness";

describe("my tool", () => {
  let harness: McpTestHarness;

  beforeEach(() => {
    harness = new McpTestHarness();
  });

  it("should handle valid input", async () => {
    const result = await harness.callTool("my_tool", {
      query: "test query",
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("test");
  });
});
```

### Evals Framework

Run evaluations against tool implementations:

```typescript
import { EvalRunner, createMockLLMClient } from "@mcp-toolkit/testing/evals";

const runner = new EvalRunner({
  client: createMockLLMClient([
    { content: "Expected response" },
  ]),
});

const results = await runner.run([
  {
    name: "basic test",
    input: { query: "test" },
    expectedOutput: "Expected response",
  },
]);
```

### Judge System

Automatically assess response quality:

```typescript
import { ResponseJudge } from "@mcp-toolkit/testing/judge";

const judge = new ResponseJudge({
  criteria: ["accuracy", "completeness", "relevance"],
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

Generate structured test reports:

```typescript
import { TestReporter } from "@mcp-toolkit/testing/reporters";

const reporter = new TestReporter();

reporter.addResult({
  name: "test-1",
  passed: true,
  duration: 100,
});

const report = reporter.generate();
console.log(report.summary);
console.log(report.details);
```

## API Reference

### McpTestHarness

```typescript
class McpTestHarness {
  // Call a tool with arguments
  callTool(name: string, args: unknown): Promise<CallToolResult>;

  // Read a resource
  readResource(uri: string): Promise<ReadResourceResult>;

  // Get a prompt
  getPrompt(name: string, args: Record<string, string>): Promise<GetPromptResult>;

  // Register custom tools for testing
  registerTool(tool: Tool, handler: ToolHandler): void;
}
```

### EvalRunner

```typescript
class EvalRunner {
  constructor(config: {
    client: LLMClient;
    timeout?: number;
  });

  run(cases: EvalCase[]): Promise<EvalResult[]>;
}
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
// Main entry
import { McpTestHarness, EvalRunner, ResponseJudge } from "@mcp-toolkit/testing";

// Subpath exports
import { McpTestHarness } from "@mcp-toolkit/testing/harness";
import { EvalRunner, createMockLLMClient } from "@mcp-toolkit/testing/evals";
import { ResponseJudge } from "@mcp-toolkit/testing/judge";
import { TestReporter } from "@mcp-toolkit/testing/reporters";
```
