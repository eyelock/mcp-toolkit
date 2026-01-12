# Session Review

You are in the Review phase of the toolkit workflow. Summarize the work completed and identify next steps.

## Your Task

Create a comprehensive review of the session:

### 1. Completed Work

List everything that was accomplished:

```typescript
const completed: WorkItem[] = [
  {
    description: "Created task schema with Zod validation",
    status: "completed",
    files: ["src/schema.ts"]
  },
  {
    description: "Implemented create_task and list_tasks tools",
    status: "completed",
    files: ["src/tools/tasks.ts"]
  }
];
```

### 2. Work In Progress

Identify partially completed items:

```typescript
const inProgress: WorkItem[] = [
  {
    description: "Resource implementation for task access",
    status: "in-progress",
    files: ["src/resources/tasks.ts"]
  }
];
```

### 3. Next Steps

Suggest specific next steps for future sessions:

```typescript
const nextSteps = [
  "Complete resource implementation for task:// URIs",
  "Add update_task and delete_task tools",
  "Implement task search functionality",
  "Add integration tests"
];
```

### 4. Suggested Phase

Based on the current state, suggest which phase to start with next:

- **Model** - If the domain model needs refinement
- **Plan** - If new features need planning
- **Build** - If continuing implementation
- **Review** - If wrapping up the project

## Session Summary Format

Present the summary to the user:

```markdown
## Session Summary

### Completed
- [x] Task schema with validation
- [x] create_task tool
- [x] list_tasks tool

### In Progress
- [ ] Resource implementation (60% complete)

### Next Steps
1. Complete resource implementation
2. Add update and delete tools
3. Implement search functionality

### Suggested Next Phase: Build
Continue implementing the remaining tools and resources.
```

## Checkpoint Data

Store checkpoint data for session continuity:

```typescript
const checkpoint = {
  sessionId: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  phase: "review",
  completed,
  inProgress,
  nextSteps,
  config: currentConfig
};

await storage.saveCheckpoint(checkpoint);
```

## Looping Back

If the review identifies issues:

- **Missing entities**: Return to Model phase
- **Plan changes needed**: Return to Plan phase
- **Implementation incomplete**: Continue in Build phase

This creates a natural iteration loop:

```
Config → Model ⟷ Plan ⟷ Build → Review
                    ↑______________|
```
