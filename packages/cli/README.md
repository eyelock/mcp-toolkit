# @mcp-toolkit/cli

Command-line interface for MCP Toolkit, built with [OCLIF](https://oclif.io/).

## Features

- **Init Command**: Initialize project configuration
- **Status Command**: Check current session state
- **Extensible**: Easy to add new commands following OCLIF patterns

## Installation

```bash
pnpm add @mcp-toolkit/cli
```

## Usage

### Running Commands

```bash
# Via pnpm script
pnpm cli init
pnpm cli status

# Via node directly
node bin/run.js init
node bin/run.js status

# Show help
node bin/run.js --help
```

### Init Command

Initialize a new project configuration:

```bash
mcp-toolkit-cli init my-project
mcp-toolkit-cli init my-project --all-features
mcp-toolkit-cli init my-project --no-tools --prompts
```

Arguments:
- `projectName`: Project name (kebab-case, required)

Flags:
- `--tools / --no-tools`: Enable/disable tools (default: enabled)
- `--resources / --no-resources`: Enable/disable resources (default: enabled)
- `--prompts / --no-prompts`: Enable/disable prompts (default: disabled)
- `--sampling / --no-sampling`: Enable/disable sampling (default: disabled)
- `--all-features`: Enable all features

### Status Command

Check current session state:

```bash
mcp-toolkit-cli status
```

## Adding New Commands

Create a new file in `src/commands/`:

```typescript
// src/commands/my-command.ts
import { Command, Flags } from "@oclif/core";

export default class MyCommand extends Command {
  static override description = "Description of my command";

  static override flags = {
    option: Flags.string({
      char: "o",
      description: "An option flag",
    }),
  };

  static override args = {
    name: Args.string({
      description: "A positional argument",
      required: true,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(MyCommand);

    // Implementation
    this.log(`Running with ${args.name} and ${flags.option}`);
  }
}
```

## Project Structure

```
src/
├── commands/
│   ├── init.ts       # Initialize configuration
│   └── status.ts     # Check session status
└── index.ts          # CLI entry point
```

## Sharing Logic with MCP Server

The CLI and MCP server share business logic through the core and model packages:

```typescript
import { MemoryProvider } from "@mcp-toolkit/core";
import { SessionConfigSchema } from "@mcp-toolkit/model";

// Same provider used by MCP server
const provider = new MemoryProvider();

// Same schema validation
const config = SessionConfigSchema.parse(input);
```

## Build Commands

```bash
pnpm build          # Build package
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm test:coverage  # With coverage
pnpm typecheck      # Type check
pnpm cli            # Run CLI (after build)
```

## OCLIF Configuration

The CLI is configured in `package.json`:

```json
{
  "oclif": {
    "bin": "mcp-toolkit-cli",
    "dirname": "mcp-toolkit",
    "commands": "./dist/commands",
    "topicSeparator": " "
  }
}
```
