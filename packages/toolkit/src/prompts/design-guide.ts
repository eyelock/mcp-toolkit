/**
 * Design Guide Prompt
 *
 * Provides guidance for domain model design.
 */

import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";

/**
 * Prompt for starting the design process
 */
export const designStartPrompt: Prompt = {
  name: "toolkit-design-start",
  description: "Get guidance on starting a new domain model design",
  arguments: [
    {
      name: "domain",
      description: "Brief description of the domain you're modeling",
      required: false,
    },
  ],
};

/**
 * Prompt for designing a specific entity
 */
export const designEntityPrompt: Prompt = {
  name: "toolkit-design-entity",
  description: "Get guidance on designing a specific entity",
  arguments: [
    {
      name: "entityName",
      description: "Name of the entity you want to design",
      required: true,
    },
    {
      name: "context",
      description: "Additional context about the entity's purpose",
      required: false,
    },
  ],
};

/**
 * Get the design start prompt
 */
export async function getDesignStartPrompt(
  args: Record<string, string> | undefined
): Promise<GetPromptResult> {
  const domain = args?.domain || "your application";

  return {
    description: "Guidance for starting domain model design",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `I want to design a domain model for ${domain}. Help me get started with the MCP Toolkit.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `Great! Let's design a domain model for ${domain}. Here's how we'll approach this:

## Domain Model Design Process

### Step 1: Define Your Model
First, we'll create a new model with a name and description:

\`\`\`
toolkit:model:design
action: "start"
name: "your-model-name" (kebab-case)
description: "A brief description of what this model represents"
\`\`\`

### Step 2: Identify Core Entities
Think about the main things/concepts in your domain. Ask yourself:
- What are the primary objects users will interact with?
- What data needs to be stored and managed?
- What are the relationships between these objects?

Common entity patterns:
- **User/Account**: If your app has users
- **Content items**: Posts, Articles, Products, etc.
- **Transactions**: Orders, Payments, Bookings, etc.
- **Metadata**: Tags, Categories, Settings, etc.

### Step 3: Define Entity Properties
For each entity, define:
- **Properties**: The data fields (name, type, required, etc.)
- **Relationships**: How entities relate to each other

### Step 4: Iterate and Refine
You can always add, update, or remove entities as your understanding grows.

## Ready to Start?

Tell me more about ${domain}:
1. What are the main things/concepts in this domain?
2. What actions will users perform?
3. Are there any existing data sources we should consider?

Once you describe your domain, I'll help you identify entities and create your model.`,
        },
      },
    ],
  };
}

/**
 * Get the design entity prompt
 */
export async function getDesignEntityPrompt(
  args: Record<string, string> | undefined
): Promise<GetPromptResult> {
  const entityName = args?.entityName || "Entity";
  const context = args?.context || "";

  return {
    description: `Guidance for designing the ${entityName} entity`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me design the ${entityName} entity.${context ? ` Context: ${context}` : ""}`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `Let's design the **${entityName}** entity. Here's a structured approach:

## Entity Design: ${entityName}

### 1. Core Identity
First, consider:
- What uniquely identifies a ${entityName}?
- What's the primary use case?

### 2. Essential Properties
Every entity typically needs:

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| id | uuid | Yes | Auto-generated unique identifier |
| name/title | string | Usually | Human-readable identifier |
| description | string | Optional | Additional context |
| createdAt | datetime | Yes | When it was created |
| updatedAt | datetime | Yes | Last modification time |

### 3. Domain-Specific Properties
Based on ${entityName}, consider:
- What data does this entity hold?
- What are the business rules?
- What validations are needed?

### 4. Relationships
Think about how ${entityName} relates to other entities:
- **One-to-One**: e.g., User has one Profile
- **One-to-Many**: e.g., User has many Posts
- **Many-to-Many**: e.g., Post has many Tags

## Next Steps

To add this entity to your model:

\`\`\`
toolkit:model:design
action: "add-entity"
entity: {
  name: "${entityName}",
  description: "Description of ${entityName}",
  properties: [
    { name: "id", type: "uuid", required: true },
    // Add more properties...
  ],
  relationships: [
    // Add relationships if any...
  ]
}
\`\`\`

What specific properties should ${entityName} have?`,
        },
      },
    ],
  };
}
