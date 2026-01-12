# Implementation Planning

You are in the Plan phase of the toolkit workflow. You'll create a structured implementation plan for the MCP server.

## Your Task

Create a phased implementation plan that the user can review and approve before proceeding.

## Plan Structure

### 1. Identify Components

Based on the domain model and enabled features, identify:

- **Tools** to implement (if enabled)
- **Resources** to expose (if enabled)
- **Prompts** to provide (if enabled)
- **Sampling** use cases (if enabled)

### 2. Define Phases

Break the implementation into logical phases:

```typescript
const phases: ImplementationPhase[] = [
  {
    name: "Phase 1: Core Schema",
    description: "Define Zod schemas and TypeScript types",
    tasks: [
      "Create entity schemas",
      "Define input/output types",
      "Add validation helpers"
    ],
    files: ["src/schema.ts", "src/types.ts"],
    complexity: 2
  },
  {
    name: "Phase 2: Storage Layer",
    description: "Implement data storage and retrieval",
    tasks: [
      "Create storage interface",
      "Implement memory provider",
      "Add CRUD operations"
    ],
    files: ["src/storage/interface.ts", "src/storage/memory.ts"],
    complexity: 3
  },
  {
    name: "Phase 3: MCP Tools",
    description: "Implement tool handlers",
    tasks: [
      "Define tool schemas",
      "Implement handlers",
      "Add error handling"
    ],
    files: ["src/tools/index.ts"],
    complexity: 3
  }
];
```

### 3. Dependency Analysis

Identify external dependencies needed:

```typescript
const dependencies = [
  "zod",           // Schema validation
  "@modelcontextprotocol/sdk",  // MCP SDK
];
```

### 4. File Planning

List files to create or modify:

```typescript
const filesToCreate = [
  "src/schema.ts",
  "src/tools/index.ts",
  "src/resources/index.ts"
];

const filesToModify = [
  "package.json",      // Add dependencies
  "src/server.ts"      // Register handlers
];
```

## Approval Workflow

Present the plan to the user for approval:

1. Show the complete plan summary
2. List all phases with tasks and complexity
3. Show files that will be created/modified
4. Ask for explicit approval before proceeding

```
Would you like to proceed with this implementation plan?

- [ ] Approve and start implementation
- [ ] Request changes to the plan
- [ ] Return to Model phase to refine design
```

## After Approval

Once approved:
- Proceed to the Build phase
- Work through phases in order
- Mark tasks as completed
- Handle blockers by returning to planning
