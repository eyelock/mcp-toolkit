/**
 * Clients Resource
 *
 * Provides access to client configuration examples via MCP resource templates.
 */

import type { ReadResourceResult, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";

/**
 * Resource template for client configurations
 */
export const clientsResourceTemplate: ResourceTemplate = {
  uriTemplate: "toolkit://clients/{name}/config",
  name: "Client Configurations",
  description: "Example configurations for different MCP clients",
  mimeType: "application/json",
};

/**
 * Client configuration examples
 */
const clientConfigs: Record<string, { config: object; instructions: string }> = {
  "claude-desktop": {
    config: {
      mcpServers: {
        "my-mcp-server": {
          command: "node",
          args: ["./dist/index.js"],
        },
      },
    },
    instructions: `
# Claude Desktop Configuration

1. Open Claude Desktop settings
2. Navigate to the MCP configuration
3. Add the following to your config file:

**macOS**: ~/Library/Application Support/Claude/claude_desktop_config.json
**Windows**: %APPDATA%/Claude/claude_desktop_config.json
**Linux**: ~/.config/claude/claude_desktop_config.json

After adding the configuration, restart Claude Desktop.
`,
  },

  cursor: {
    config: {
      mcpServers: {
        "my-mcp-server": {
          command: "node",
          args: ["./dist/index.js"],
        },
      },
    },
    instructions: `
# Cursor Configuration

1. Create or edit .cursor/mcp.json in your project root
2. Add the server configuration
3. Restart Cursor

You can also configure globally in Cursor Settings > MCP.
`,
  },

  vscode: {
    config: {
      "mcp.servers": {
        "my-mcp-server": {
          command: "node",
          args: ["./dist/index.js"],
        },
      },
    },
    instructions: `
# VS Code Configuration

1. Install the MCP extension from the marketplace
2. Add the configuration to .vscode/settings.json
3. Reload the VS Code window (Cmd/Ctrl+Shift+P > Reload Window)

You can also configure globally in VS Code settings.
`,
  },

  cli: {
    config: {
      server: {
        command: "node",
        args: ["./dist/index.js"],
      },
      transport: "stdio",
    },
    instructions: `
# CLI Configuration

1. Save the configuration to ~/.mcp-toolkit/config.json
2. Run the CLI: mcp-toolkit
3. Use --help to see available commands

You can also specify a different config file with --config flag.
`,
  },
};

/**
 * Read a client configuration resource
 */
export async function readClientConfigResource(
  clientName: string
): Promise<ReadResourceResult | null> {
  const client = clientConfigs[clientName];

  if (!client) {
    return null;
  }

  return {
    contents: [
      {
        uri: `toolkit://clients/${clientName}/config`,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            config: client.config,
            instructions: client.instructions,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Get available client names
 */
export function getClientNames(): string[] {
  return Object.keys(clientConfigs);
}
