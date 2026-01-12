/**
 * Status Command
 *
 * CLI equivalent of session_status MCP tool.
 * Demonstrates CLI/MCP parity pattern.
 */

import { createMemoryProvider } from "@mcp-toolkit/core";
import { Command, Flags } from "@oclif/core";

export default class Status extends Command {
  static override description = "Show current session status and configuration";

  static override examples = ["<%= config.bin %> status", "<%= config.bin %> status --json"];

  static override flags = {
    json: Flags.boolean({
      description: "Output as JSON",
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Status);

    // Use provider (in real implementation, this would read persisted state)
    const provider = createMemoryProvider();
    const result = await provider.getSession();

    if (!result.data) {
      if (flags.json) {
        this.log(JSON.stringify({ error: "No active session" }, null, 2));
      } else {
        this.log("");
        this.log("No active session.");
        this.log("");
        this.log("Run 'mcp-toolkit-cli init <project-name>' to create one.");
        this.log("");
      }
      return;
    }

    const session = result.data;

    if (flags.json) {
      this.log(JSON.stringify(session, null, 2));
      return;
    }

    const enabledFeatures = Object.entries(session.features)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    this.log("");
    this.log("Session Status");
    this.log("──────────────");
    this.log(`  Project:  ${session.projectName}`);
    this.log(`  Features: ${enabledFeatures.join(", ") || "none"}`);
    this.log(`  Created:  ${session.createdAt}`);
    this.log(`  Updated:  ${session.updatedAt}`);
    this.log("");
  }
}
