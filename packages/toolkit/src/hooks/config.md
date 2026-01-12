# Toolkit Configuration

You are starting the MCP Toolkit configuration workflow. This is a **blocking** phase - you must complete configuration before proceeding with other toolkit operations.

## Your Task

Gather the following information from the user using elicitation:

1. **Project Name** (required)
   - Must be in kebab-case (e.g., `my-mcp-server`)
   - Used as the package name and server identity

2. **Purpose** (required)
   - What will this MCP server be used for?
   - Examples: "Development tooling", "Data analysis", "Content management"

3. **Domain** (required)
   - Primary industry or domain
   - Examples: "Software Engineering", "Finance", "Healthcare", "Education"

4. **Features** (with defaults)
   - Tools: Enable MCP tools (default: true)
   - Resources: Enable MCP resources (default: true)
   - Prompts: Enable MCP prompts (default: false)
   - Sampling: Enable server-initiated LLM calls (default: false)

## Elicitation Flow

Use the elicitation helpers to gather this information interactively:

```typescript
const config = await elicitInput<ToolkitConfig>(server,
  "Let's configure your MCP Toolkit. Please provide the following details:",
  {
    type: "object",
    properties: {
      projectName: {
        type: "string",
        title: "Project Name",
        description: "Name for your MCP server (kebab-case)",
        minLength: 1,
        maxLength: 100
      },
      purpose: {
        type: "string",
        title: "Purpose",
        description: "What will this server be used for?"
      },
      domain: {
        type: "string",
        title: "Domain",
        description: "Primary industry or domain"
      },
      enableTools: {
        type: "boolean",
        title: "Enable Tools",
        description: "Allow clients to call server tools",
        default: true
      },
      enableResources: {
        type: "boolean",
        title: "Enable Resources",
        description: "Allow clients to read server resources",
        default: true
      },
      enablePrompts: {
        type: "boolean",
        title: "Enable Prompts",
        description: "Provide prompt templates to clients",
        default: false
      },
      enableSampling: {
        type: "boolean",
        title: "Enable Sampling",
        description: "Allow server to make LLM calls",
        default: false
      }
    },
    required: ["projectName", "purpose", "domain"]
  }
);
```

## After Configuration

Once configuration is complete:

1. Store the configuration using the session provider
2. Mark the config hook as completed via `markWorkflowHookCompleted`
3. The workflow will automatically proceed to the Model phase

## Claude Code Permissions (If Running in Claude Code)

If you are Claude running in Claude Code, check and optimize the project's permission settings for a smoother development experience.

### Check Current Settings

1. Look for `.claude/settings.local.json` in the project root
2. If it doesn't exist, or has minimal permissions, suggest creating/updating it

### Analyze Package Scripts

Read `package.json` and identify the available scripts. Common patterns to auto-allow:

**Build & Development:**
- `Bash(pnpm build:*)` / `Bash(pnpm dev:*)`
- `Bash(pnpm --filter * build:*)` / `Bash(pnpm --filter * dev:*)`
- `Bash(turbo run build:*)` / `Bash(turbo run dev:*)`

**Testing:**
- `Bash(pnpm test:*)` / `Bash(pnpm --filter * test:*)`
- `Bash(turbo run test:*)` / `Bash(vitest:*)`

**Code Quality:**
- `Bash(pnpm lint:*)` / `Bash(pnpm format:*)`
- `Bash(pnpm typecheck:*)` / `Bash(pnpm check:*)`
- `Bash(biome check:*)` / `Bash(biome format:*)` / `Bash(biome lint:*)`
- `Bash(tsc:*)`

**Cleanup:**
- `Bash(pnpm clean:*)` / `Bash(turbo run clean:*)`

**Documentation:**
- `Bash(pnpm docs:*)` / `Bash(node scripts/*)`

### Recommended Settings Template

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm build:*)",
      "Bash(pnpm dev:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm clean:*)",
      "Bash(pnpm check:*)",
      "Bash(pnpm format:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(pnpm docs:*)",
      "Bash(pnpm --filter * build:*)",
      "Bash(pnpm --filter * dev:*)",
      "Bash(pnpm --filter * test:*)",
      "Bash(pnpm --filter * clean:*)",
      "Bash(pnpm --filter * check:*)",
      "Bash(pnpm --filter * typecheck:*)",
      "Bash(turbo run build:*)",
      "Bash(turbo run dev:*)",
      "Bash(turbo run test:*)",
      "Bash(turbo run clean:*)",
      "Bash(turbo run typecheck:*)",
      "Bash(biome check:*)",
      "Bash(biome format:*)",
      "Bash(biome lint:*)",
      "Bash(vitest:*)",
      "Bash(tsc:*)",
      "Bash(node scripts/*)"
    ]
  }
}
```

### What to Exclude

Do NOT auto-allow commands that:
- Install dependencies (`pnpm install`, `pnpm add`)
- Publish packages (`pnpm publish`, `changeset`, `release:*`)
- Modify git history (`git push --force`, `git reset --hard`)
- Run arbitrary network commands

### Suggest to User

If settings are missing or incomplete, ask the user:

> "I noticed your Claude Code permissions aren't optimized for this project. Based on your package.json scripts, I can suggest auto-allowing safe build/test/lint commands. Would you like me to create or update `.claude/settings.local.json`?"

Wait for explicit approval before creating or modifying the file.

## Workflow Blocking

Until this configuration completes:
- All `toolkit:*` tools will return a blocking error
- The user will be prompted to complete configuration first
- Other non-toolkit tools remain available
