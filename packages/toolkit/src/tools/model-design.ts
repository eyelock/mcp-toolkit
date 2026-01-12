/**
 * Model Design Tool
 *
 * Guides the LLM through designing a domain model conversationally.
 * Supports actions: start, add-entity, update-entity, remove-entity, show, finalize.
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  type DomainModel,
  type EntityDefinition,
  type ModelDesignInput,
  ModelDesignInputSchema,
  createToolkitStorage,
} from "../model/index.js";

/**
 * Tool definition for model design
 */
export const modelDesignTool: Tool = {
  name: "toolkit:model:design",
  description:
    "Design a domain model for your MCP server. Use 'start' to begin a new model, " +
    "'add-entity' to add entities, 'update-entity' to modify, 'remove-entity' to delete, " +
    "'show' to display the current model, and 'finalize' when design is complete.",
  inputSchema: zodToJsonSchema(ModelDesignInputSchema) as Tool["inputSchema"],
};

/**
 * Format an entity for display
 */
function formatEntity(entity: EntityDefinition): string {
  const lines: string[] = [];
  lines.push(`## ${entity.name}`);
  lines.push(entity.description);
  lines.push("");
  lines.push("**Properties:**");
  for (const prop of entity.properties) {
    const required = prop.required ? "" : "?";
    const desc = prop.description ? ` - ${prop.description}` : "";
    lines.push(`- \`${prop.name}${required}\`: ${prop.type}${desc}`);
  }
  if (entity.relationships && entity.relationships.length > 0) {
    lines.push("");
    lines.push("**Relationships:**");
    for (const rel of entity.relationships) {
      const desc = rel.description ? ` - ${rel.description}` : "";
      lines.push(`- → \`${rel.target}\` (${rel.type})${desc}`);
    }
  }
  return lines.join("\n");
}

/**
 * Format the entire model for display
 */
function formatModel(model: DomainModel): string {
  const lines: string[] = [];
  lines.push(`# ${model.name}`);
  lines.push(`_${model.description}_`);
  lines.push(`Version: ${model.version}`);
  lines.push("");

  if (model.entities.length === 0) {
    lines.push("_No entities defined yet. Use 'add-entity' to add your first entity._");
  } else {
    lines.push(`**${model.entities.length} Entities:**`);
    lines.push("");
    for (const entity of model.entities) {
      lines.push(formatEntity(entity));
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Handle model design tool call
 */
export async function handleModelDesign(
  args: unknown,
  _context: unknown
): Promise<CallToolResult> {
  // Validate input
  const parseResult = ModelDesignInputSchema.safeParse(args);
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

  const input = parseResult.data as ModelDesignInput;
  const storage = createToolkitStorage();

  switch (input.action) {
    case "start": {
      if (!input.name || !input.description) {
        return {
          content: [
            {
              type: "text",
              text: "To start a new model, provide 'name' (kebab-case) and 'description'.",
            },
          ],
          isError: true,
        };
      }

      if (storage.hasModel()) {
        return {
          content: [
            {
              type: "text",
              text: `A model already exists at ${storage.getModelPath()}. Use 'show' to view it or delete the file to start fresh.`,
            },
          ],
          isError: true,
        };
      }

      const result = storage.initModel(input.name, input.description);
      if (!result.success) {
        return {
          content: [{ type: "text", text: `Failed to create model: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Created new model: **${input.name}**`,
              "",
              `Model file: ${storage.getModelPath()}`,
              "",
              "Next steps:",
              "1. Use 'add-entity' to define your first entity",
              "2. Each entity needs: name (PascalCase), description, and properties",
              "3. Use 'show' anytime to see your model",
              "4. Use 'finalize' when your model is complete",
            ].join("\n"),
          },
        ],
      };
    }

    case "add-entity": {
      if (!input.entity) {
        return {
          content: [
            {
              type: "text",
              text: "To add an entity, provide the 'entity' object with name, description, and properties.",
            },
          ],
          isError: true,
        };
      }

      const result = storage.addEntity(input.entity);
      if (!result.success) {
        return {
          content: [{ type: "text", text: `Failed to add entity: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Added entity: **${input.entity.name}**`,
              "",
              formatEntity(input.entity),
              "",
              `Model now has ${result.data?.entities.length} entities.`,
            ].join("\n"),
          },
        ],
      };
    }

    case "update-entity": {
      if (!input.name || !input.entity) {
        return {
          content: [
            {
              type: "text",
              text: "To update an entity, provide 'name' (entity to update) and 'entity' (new definition).",
            },
          ],
          isError: true,
        };
      }

      const result = storage.updateEntity(input.name, input.entity);
      if (!result.success) {
        return {
          content: [{ type: "text", text: `Failed to update entity: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Updated entity: **${input.entity.name}**`,
              "",
              formatEntity(input.entity),
            ].join("\n"),
          },
        ],
      };
    }

    case "remove-entity": {
      if (!input.name) {
        return {
          content: [
            {
              type: "text",
              text: "To remove an entity, provide 'name' of the entity to remove.",
            },
          ],
          isError: true,
        };
      }

      const result = storage.removeEntity(input.name);
      if (!result.success) {
        return {
          content: [{ type: "text", text: `Failed to remove entity: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Removed entity: **${input.name}**`,
              "",
              `Model now has ${result.data?.entities.length} entities.`,
            ].join("\n"),
          },
        ],
      };
    }

    case "show": {
      const result = storage.loadModel();
      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: "text",
              text: "No model found. Use 'start' action to create a new model.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: formatModel(result.data),
          },
        ],
      };
    }

    case "finalize": {
      const result = storage.loadModel();
      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: "text",
              text: "No model to finalize. Use 'start' to create a model first.",
            },
          ],
          isError: true,
        };
      }

      const model = result.data;
      if (model.entities.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Cannot finalize an empty model. Add at least one entity first.",
            },
          ],
          isError: true,
        };
      }

      // Update state to indicate design is complete
      storage.updateState({ phase: "generate", model });

      return {
        content: [
          {
            type: "text",
            text: [
              "Model design complete!",
              "",
              formatModel(model),
              "",
              "Next steps:",
              "1. Use 'toolkit:generate' to generate code from your model",
              "2. Choose a generation tier: 'definitions', 'stubs', or 'full'",
              "3. Review the generated code and customize as needed",
            ].join("\n"),
          },
        ],
      };
    }

    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown action: ${input.action}. Valid actions: start, add-entity, update-entity, remove-entity, show, finalize`,
          },
        ],
        isError: true,
      };
  }
}
