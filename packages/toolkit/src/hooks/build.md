# Build Guidance

You are in the Build phase of the toolkit workflow. You'll implement the MCP server components following the approved plan.

## Implementation Patterns

### Tool Implementation

```typescript
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// 1. Define input schema
const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

// 2. Create handler
async function handleCreateTask(
  input: z.infer<typeof CreateTaskInputSchema>
): Promise<CallToolResult> {
  // Validate input
  const validated = CreateTaskInputSchema.parse(input);

  // Perform operation
  const task = await storage.createTask(validated);

  // Return result
  return {
    content: [{
      type: "text",
      text: JSON.stringify(task, null, 2)
    }]
  };
}

// 3. Register with server
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "create_task") {
    return handleCreateTask(request.params.arguments);
  }
});
```

### Resource Implementation

```typescript
// 1. Define resource template
const taskResourceTemplate = {
  uriTemplate: "task:///{id}",
  name: "Task",
  description: "A single task by ID",
  mimeType: "application/json"
};

// 2. Create handler
async function handleReadTask(uri: URL): Promise<string> {
  const id = uri.pathname.slice(1); // Remove leading /
  const task = await storage.getTask(id);

  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  return JSON.stringify(task, null, 2);
}

// 3. Register with server
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = new URL(request.params.uri);

  if (uri.protocol === "task:") {
    const content = await handleReadTask(uri);
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: content
      }]
    };
  }
});
```

### Prompt Implementation

```typescript
// 1. Define prompt
const debugPrompt = {
  name: "debug_task",
  description: "Help debug a task issue",
  arguments: [
    {
      name: "task_id",
      description: "ID of the task to debug",
      required: true
    }
  ]
};

// 2. Create handler
async function handleDebugPrompt(
  args: Record<string, string>
): Promise<GetPromptResult> {
  const task = await storage.getTask(args.task_id);

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please help me debug this task:\n\n${JSON.stringify(task, null, 2)}`
        }
      }
    ]
  };
}
```

## Best Practices

### Error Handling

```typescript
try {
  const result = await operation();
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }],
    isError: true
  };
}
```

### Validation

Always validate inputs using Zod schemas before processing.

### Progress Reporting

For long operations, use progress notifications:

```typescript
const reporter = createProgressReporter(meta);
await reporter.report(0.5, "Processing items...");
```

### Cancellation

Check for cancellation in long loops:

```typescript
for (const item of items) {
  checkCancelled(signal);
  await processItem(item);
}
```

## Next Steps

After implementation:
- Run tests to verify functionality
- Proceed to Review phase for summary
