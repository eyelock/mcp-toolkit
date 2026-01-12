/**
 * Setup Guide Prompt
 *
 * Provides guidance for setting up MCP clients.
 */

import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";

/**
 * Prompt for setup guidance
 */
export const setupGuidePrompt: Prompt = {
  name: "toolkit-setup-guide",
  description: "Get guidance on setting up your MCP server with different clients",
  arguments: [
    {
      name: "client",
      description: "Target client (claude-desktop, cursor, vscode, cli)",
      required: false,
    },
  ],
};

/**
 * Get the setup guide prompt
 */
export async function getSetupGuidePrompt(
  args: Record<string, string> | undefined
): Promise<GetPromptResult> {
  const client = args?.client;

  if (client) {
    return getClientSpecificGuide(client);
  }

  return {
    description: "General setup guidance for MCP clients",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Help me set up my MCP server with a client.",
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `# MCP Server Setup Guide

The MCP Toolkit can help you configure your server for any of these clients:

## Supported Clients

### 1. Claude Desktop 🖥️
The official Claude desktop application with full MCP support.
- **Platform**: macOS, Windows, Linux
- **Best for**: General-purpose AI assistance

### 2. Cursor 💻
AI-powered code editor with integrated MCP.
- **Platform**: macOS, Windows, Linux
- **Best for**: Coding and development

### 3. VS Code 📝
Popular code editor with MCP extension.
- **Platform**: macOS, Windows, Linux
- **Best for**: Development with existing VS Code workflow

### 4. CLI 🔧
Command-line interface for scripting and automation.
- **Platform**: Any with Node.js
- **Best for**: Automation and scripting

## Quick Setup

Use the setup tool to configure any client:

\`\`\`
toolkit:setup:client
client: "claude-desktop" | "cursor" | "vscode" | "cli"
\`\`\`

## Verify Configuration

Check if your clients are properly configured:

\`\`\`
toolkit:setup:verify
\`\`\`

## Which client would you like to set up?

Tell me which client you're using, and I'll provide detailed setup instructions.`,
        },
      },
    ],
  };
}

/**
 * Get client-specific setup guide
 */
function getClientSpecificGuide(client: string): GetPromptResult {
  const guides: Record<string, { title: string; steps: string }> = {
    "claude-desktop": {
      title: "Claude Desktop Setup",
      steps: `# Claude Desktop Setup

## Prerequisites
- Claude Desktop installed
- Your MCP server built (run \`npm run build\`)

## Configuration Steps

### 1. Locate Config File
The config file location depends on your OS:

| OS | Path |
|----|------|
| macOS | ~/Library/Application Support/Claude/claude_desktop_config.json |
| Windows | %APPDATA%/Claude/claude_desktop_config.json |
| Linux | ~/.config/claude/claude_desktop_config.json |

### 2. Add Server Configuration
Add your server to the \`mcpServers\` section:

\`\`\`json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
\`\`\`

### 3. Automatic Setup
Or use the toolkit to configure automatically:

\`\`\`
toolkit:setup:client
client: "claude-desktop"
\`\`\`

### 4. Restart Claude Desktop
After configuration, restart Claude Desktop to load the server.

### 5. Verify
Check that your tools appear in Claude's available tools list.`,
    },

    cursor: {
      title: "Cursor Setup",
      steps: `# Cursor Setup

## Prerequisites
- Cursor IDE installed
- Your MCP server built (run \`npm run build\`)

## Configuration Steps

### 1. Create Config File
Create \`.cursor/mcp.json\` in your project root:

\`\`\`json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
\`\`\`

### 2. Automatic Setup
Or use the toolkit to configure automatically:

\`\`\`
toolkit:setup:client
client: "cursor"
\`\`\`

### 3. Restart Cursor
After configuration, restart Cursor to load the server.

### 4. Verify
Open Cursor Settings > MCP to see your server listed.`,
    },

    vscode: {
      title: "VS Code Setup",
      steps: `# VS Code Setup

## Prerequisites
- VS Code installed
- MCP extension installed
- Your MCP server built (run \`npm run build\`)

## Configuration Steps

### 1. Install MCP Extension
Search for "MCP" in the VS Code Extensions marketplace.

### 2. Add to Settings
Add to \`.vscode/settings.json\`:

\`\`\`json
{
  "mcp.servers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
\`\`\`

### 3. Automatic Setup
Or use the toolkit to configure automatically:

\`\`\`
toolkit:setup:client
client: "vscode"
\`\`\`

### 4. Reload Window
Press Cmd/Ctrl+Shift+P and run "Reload Window".`,
    },

    cli: {
      title: "CLI Setup",
      steps: `# CLI Setup

## Prerequisites
- Node.js installed
- Your MCP server built (run \`npm run build\`)

## Configuration Steps

### 1. Create Config
Create \`~/.mcp-toolkit/config.json\`:

\`\`\`json
{
  "server": {
    "command": "node",
    "args": ["./dist/index.js"]
  }
}
\`\`\`

### 2. Automatic Setup
Or use the toolkit to configure automatically:

\`\`\`
toolkit:setup:client
client: "cli"
\`\`\`

### 3. Test Connection
Run the CLI to verify:

\`\`\`bash
mcp-toolkit --help
\`\`\``,
    },
  };

  const guide = guides[client];

  if (!guide) {
    return {
      description: "Unknown client",
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `Unknown client: ${client}. Supported clients: claude-desktop, cursor, vscode, cli`,
          },
        },
      ],
    };
  }

  return {
    description: guide.title,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me set up my MCP server with ${client}.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: guide.steps,
        },
      },
    ],
  };
}
