/**
 * Setup Client Tool
 *
 * Helps developers configure their IDE/CLI to use the MCP server.
 * Supports: Claude Desktop, Cursor, VS Code, CLI.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  type ClientTarget,
  type SetupClientInput,
  type SetupVerifyInput,
  SetupClientInputSchema,
  SetupVerifyInputSchema,
  createToolkitStorage,
} from "../model/index.js";

/**
 * Tool definition for client setup
 */
export const setupClientTool: Tool = {
  name: "toolkit:setup:client",
  description:
    "Configure an IDE or CLI to use your MCP server. " +
    "Supports: claude-desktop, cursor, vscode, cli.",
  inputSchema: zodToJsonSchema(SetupClientInputSchema) as Tool["inputSchema"],
};

/**
 * Tool definition for setup verification
 */
export const setupVerifyTool: Tool = {
  name: "toolkit:setup:verify",
  description:
    "Verify that the MCP server is correctly configured for a client. " +
    "Checks configuration files and connection.",
  inputSchema: zodToJsonSchema(SetupVerifyInputSchema) as Tool["inputSchema"],
};

/**
 * Client configuration info
 */
interface ClientConfig {
  configPath: string;
  displayName: string;
  instructions: string[];
  generateConfig: (serverPath: string, options?: Record<string, string>) => string;
}

/**
 * Get client configuration details
 */
function getClientConfig(client: ClientTarget): ClientConfig | null {
  const home = homedir();

  switch (client) {
    case "claude-desktop":
      return {
        configPath:
          process.platform === "darwin"
            ? join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
            : process.platform === "win32"
              ? join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json")
              : join(home, ".config", "claude", "claude_desktop_config.json"),
        displayName: "Claude Desktop",
        instructions: [
          "1. The configuration has been added to your Claude Desktop config",
          "2. Restart Claude Desktop to apply changes",
          "3. The MCP server should appear in Claude's available tools",
        ],
        generateConfig: (serverPath, options) => {
          const serverName = options?.serverName || "mcp-toolkit";
          return JSON.stringify(
            {
              mcpServers: {
                [serverName]: {
                  command: "node",
                  args: [serverPath],
                },
              },
            },
            null,
            2
          );
        },
      };

    case "cursor":
      return {
        configPath: join(process.cwd(), ".cursor", "mcp.json"),
        displayName: "Cursor",
        instructions: [
          "1. The configuration has been added to .cursor/mcp.json",
          "2. Restart Cursor to apply changes",
          "3. Open Cursor Settings > MCP to verify the server is listed",
        ],
        generateConfig: (serverPath, options) => {
          const serverName = options?.serverName || "mcp-toolkit";
          return JSON.stringify(
            {
              mcpServers: {
                [serverName]: {
                  command: "node",
                  args: [serverPath],
                },
              },
            },
            null,
            2
          );
        },
      };

    case "vscode":
      return {
        configPath: join(process.cwd(), ".vscode", "settings.json"),
        displayName: "VS Code",
        instructions: [
          "1. MCP configuration has been added to .vscode/settings.json",
          "2. Install the MCP extension for VS Code if not already installed",
          "3. Reload VS Code window (Cmd/Ctrl+Shift+P > Reload Window)",
        ],
        generateConfig: (serverPath, options) => {
          const serverName = options?.serverName || "mcp-toolkit";
          return JSON.stringify(
            {
              "mcp.servers": {
                [serverName]: {
                  command: "node",
                  args: [serverPath],
                },
              },
            },
            null,
            2
          );
        },
      };

    case "cli":
      return {
        configPath: join(home, ".mcp-toolkit", "config.json"),
        displayName: "CLI",
        instructions: [
          "1. Configuration saved to ~/.mcp-toolkit/config.json",
          "2. Use 'mcp-toolkit' CLI to interact with the server",
          "3. Run 'mcp-toolkit --help' for available commands",
        ],
        generateConfig: (serverPath) => {
          return JSON.stringify(
            {
              server: {
                command: "node",
                args: [serverPath],
              },
            },
            null,
            2
          );
        },
      };

    case "custom":
      return null;

    default:
      return null;
  }
}

/**
 * Detect the server entry point
 */
function detectServerPath(): string | null {
  const candidates = [
    join(process.cwd(), "dist", "index.js"),
    join(process.cwd(), "build", "index.js"),
    join(process.cwd(), "src", "index.ts"),
    join(process.cwd(), "index.js"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Handle setup client tool call
 */
export async function handleSetupClient(args: unknown, _context: unknown): Promise<CallToolResult> {
  // Validate input
  const parseResult = SetupClientInputSchema.safeParse(args);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid input: ${parseResult.error.message}`,
        },
      ],
      isError: true,
    };
  }

  const input = parseResult.data as SetupClientInput;
  const storage = createToolkitStorage();

  // Get client config
  const clientConfig = getClientConfig(input.client);
  if (!clientConfig) {
    if (input.client === "custom") {
      return {
        content: [
          {
            type: "text",
            text: [
              "**Custom Client Setup**",
              "",
              "For custom clients, you'll need to manually configure:",
              "",
              "1. **Command**: `node`",
              '2. **Args**: `["<path-to-your-server>/dist/index.js"]`',
              "3. **Transport**: stdio (most common)",
              "",
              "Example configuration:",
              "```json",
              JSON.stringify(
                {
                  command: "node",
                  args: [join(process.cwd(), "dist", "index.js")],
                },
                null,
                2
              ),
              "```",
            ].join("\n"),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Unknown client: ${input.client}`,
        },
      ],
      isError: true,
    };
  }

  // Determine server path
  const serverPath = input.serverPath || detectServerPath();
  if (!serverPath) {
    return {
      content: [
        {
          type: "text",
          text: [
            "Could not auto-detect server entry point.",
            "Please provide the 'serverPath' option pointing to your MCP server.",
            "",
            "Common locations:",
            "- dist/index.js (after build)",
            "- build/index.js",
            "- src/index.ts (with ts-node)",
          ].join("\n"),
        },
      ],
      isError: true,
    };
  }

  // Generate configuration
  const config = clientConfig.generateConfig(serverPath, input.options);

  // Write configuration
  try {
    const configDir = dirname(clientConfig.configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // For Claude Desktop, merge with existing config
    if (input.client === "claude-desktop" && existsSync(clientConfig.configPath)) {
      try {
        const existing = JSON.parse(readFileSync(clientConfig.configPath, "utf-8"));
        const newConfig = JSON.parse(config);
        existing.mcpServers = {
          ...existing.mcpServers,
          ...newConfig.mcpServers,
        };
        writeFileSync(clientConfig.configPath, JSON.stringify(existing, null, 2));
      } catch {
        writeFileSync(clientConfig.configPath, config);
      }
    } else if (input.client === "vscode" && existsSync(clientConfig.configPath)) {
      // For VS Code, merge with existing settings
      try {
        const existing = JSON.parse(readFileSync(clientConfig.configPath, "utf-8"));
        const newConfig = JSON.parse(config);
        Object.assign(existing, newConfig);
        writeFileSync(clientConfig.configPath, JSON.stringify(existing, null, 2));
      } catch {
        writeFileSync(clientConfig.configPath, config);
      }
    } else {
      writeFileSync(clientConfig.configPath, config);
    }

    // Update toolkit state
    const stateResult = storage.loadState();
    if (stateResult.success && stateResult.data) {
      const configuredClients = stateResult.data.configuredClients || [];
      if (!configuredClients.includes(input.client)) {
        configuredClients.push(input.client);
        storage.updateState({ configuredClients });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `**${clientConfig.displayName} Configured Successfully**`,
            "",
            `Config file: ${clientConfig.configPath}`,
            `Server path: ${serverPath}`,
            "",
            "**Next Steps:**",
            ...clientConfig.instructions,
            "",
            "**Configuration:**",
            "```json",
            config,
            "```",
          ].join("\n"),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to write configuration: ${error}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle setup verify tool call
 */
export async function handleSetupVerify(args: unknown, _context: unknown): Promise<CallToolResult> {
  // Validate input
  const parseResult = SetupVerifyInputSchema.safeParse(args);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid input: ${parseResult.error.message}`,
        },
      ],
      isError: true,
    };
  }

  const input = parseResult.data as SetupVerifyInput;
  const clients: ClientTarget[] = input.client
    ? [input.client]
    : ["claude-desktop", "cursor", "vscode", "cli"];

  const results: string[] = [];

  for (const client of clients) {
    const config = getClientConfig(client);
    if (!config) continue;

    const status = {
      client: config.displayName,
      configExists: existsSync(config.configPath),
      configPath: config.configPath,
      valid: false,
      error: null as string | null,
    };

    if (status.configExists) {
      try {
        const content = readFileSync(config.configPath, "utf-8");
        JSON.parse(content);
        status.valid = true;
      } catch (error) {
        status.error = `Invalid JSON: ${error}`;
      }
    }

    const icon = status.valid ? "✓" : status.configExists ? "⚠" : "✗";
    const statusText = status.valid
      ? "Configured"
      : status.configExists
        ? `Config exists but ${status.error}`
        : "Not configured";

    results.push(`${icon} **${status.client}**: ${statusText}`);
    if (input.verbose && status.configExists) {
      results.push(`  Path: ${status.configPath}`);
    }
  }

  return {
    content: [
      {
        type: "text",
        text: [
          "**Client Configuration Status**",
          "",
          ...results,
          "",
          "Use 'toolkit:setup:client' to configure a client.",
        ].join("\n"),
      },
    ],
  };
}
