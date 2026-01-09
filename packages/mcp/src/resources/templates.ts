/**
 * Resource Templates
 *
 * Demonstrates MCP resource templates for parameterized resources.
 * Resource templates use URI Templates (RFC 6570) to define resources
 * that can be accessed with dynamic parameters.
 *
 * ## Template Pattern
 *
 * Each template follows this pattern:
 * 1. Define the ResourceTemplate with uriTemplate, name, description
 * 2. Create a handler function that receives extracted params + context
 * 3. Register the template with its handler in the registry
 *
 * ## URI Template Syntax (RFC 6570 subset)
 *
 * - `{var}` - Simple string expansion
 * - Multiple params: `resource:///{type}/{id}`
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/server/resources
 * @see https://datatracker.ietf.org/doc/html/rfc6570
 */

import type { ReadResourceResult, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "../server.js";

// =============================================================================
// Template Handler Types
// =============================================================================

/**
 * Handler function for a resource template
 */
export type TemplateHandler = (
  params: Record<string, string>,
  context: ServerContext
) => Promise<ReadResourceResult>;

/**
 * Log entries resource template
 *
 * This template demonstrates a parameterized resource for accessing log entries.
 * The {date} parameter allows clients to request logs for a specific date.
 *
 * Example URIs that match this template:
 * - log:///2024-01-15 (logs for January 15, 2024)
 * - log:///2024-12-25 (logs for December 25, 2024)
 */
export const LOG_ENTRIES_TEMPLATE: ResourceTemplate = {
  uriTemplate: "log:///{date}",
  name: "Log Entries",
  description: "Server activity logs for a specific date (YYYY-MM-DD format)",
  mimeType: "application/json",
};

/**
 * Feature configuration resource template
 *
 * This template allows accessing configuration for specific features.
 * The {feature} parameter specifies which feature's config to retrieve.
 *
 * Example URIs:
 * - config:///tools (tools configuration)
 * - config:///sampling (sampling configuration)
 */
export const FEATURE_CONFIG_TEMPLATE: ResourceTemplate = {
  uriTemplate: "config:///{feature}",
  name: "Feature Configuration",
  description: "Configuration for a specific MCP feature",
  mimeType: "application/json",
};

/**
 * Delegation configuration resource template
 *
 * This template demonstrates a multi-parameter resource.
 * Access delegation configuration for specific tools and their modes.
 *
 * Example URIs:
 * - delegation:///session_init:client_discovery (specific delegation point)
 * - delegation:///code_review:analyze (code review tool delegation)
 *
 * Parameters:
 * - {tool} - Tool name (may include : for delegation points like "session_init:client_discovery")
 */
export const DELEGATION_CONFIG_TEMPLATE: ResourceTemplate = {
  uriTemplate: "delegation:///{tool}",
  name: "Tool Delegation Configuration",
  description: "Delegation configuration for a specific tool or delegation point",
  mimeType: "application/json",
};

// =============================================================================
// Template Registry
// =============================================================================

/**
 * Template registry entry combining template definition with handler
 */
interface TemplateRegistryEntry {
  template: ResourceTemplate;
  handler: TemplateHandler;
}

/**
 * Template registry - maps URI templates to their handlers
 *
 * Using a Map provides O(1) lookup and maintains insertion order.
 * Each entry combines the ResourceTemplate metadata with its handler function.
 */
const templateRegistry = new Map<string, TemplateRegistryEntry>();

/**
 * Register a resource template with its handler
 */
export function registerTemplate(template: ResourceTemplate, handler: TemplateHandler): void {
  templateRegistry.set(template.uriTemplate, { template, handler });
}

/**
 * Get all registered templates
 */
export function getRegisteredTemplates(): ResourceTemplate[] {
  return Array.from(templateRegistry.values()).map((entry) => entry.template);
}

/**
 * All available resource templates (for backward compatibility)
 */
export const resourceTemplates: ResourceTemplate[] = [
  LOG_ENTRIES_TEMPLATE,
  FEATURE_CONFIG_TEMPLATE,
  DELEGATION_CONFIG_TEMPLATE,
];

/**
 * Register all resource templates
 */
export function registerResourceTemplates(): ResourceTemplate[] {
  return resourceTemplates;
}

/**
 * Simple URI template parameter extraction
 *
 * Extracts parameters from a URI based on a template pattern.
 * This is a simplified implementation - production code may need
 * a full RFC 6570 parser for complex templates.
 *
 * @param template - The URI template (e.g., "log:///{date}")
 * @param uri - The actual URI to match (e.g., "log:///2024-01-15")
 * @returns Extracted parameters or null if no match
 */
export function extractTemplateParams(
  template: string,
  uri: string
): Record<string, string> | null {
  // Convert template to regex pattern
  // Simple implementation: replace {param} with a capture group
  const paramNames: string[] = [];
  const pattern = template.replace(/\{([^}]+)\}/g, (_match, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });

  const regex = new RegExp(`^${pattern}$`);
  const match = uri.match(regex);

  if (!match) {
    return null;
  }

  // Build params object from captured groups
  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    const value = match[index + 1];
    if (value !== undefined) {
      params[name] = decodeURIComponent(value);
    }
  });

  return params;
}

/**
 * Check if a URI matches a template
 */
export function matchesTemplate(template: string, uri: string): boolean {
  return extractTemplateParams(template, uri) !== null;
}

/**
 * Read log entries for a specific date
 *
 * @param date - Date in YYYY-MM-DD format
 * @param context - Server context (unused in this example)
 */
export async function readLogEntries(
  date: string,
  _context: ServerContext
): Promise<ReadResourceResult> {
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return {
      contents: [
        {
          uri: `log:///${date}`,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              error: "Invalid date format",
              expected: "YYYY-MM-DD",
              received: date,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // In a real implementation, this would query actual log storage
  // For this example, we return mock data
  const mockLogs = {
    date,
    entries: [
      {
        timestamp: `${date}T09:00:00Z`,
        level: "info",
        message: "Server started",
        metadata: { version: "1.0.0" },
      },
      {
        timestamp: `${date}T09:15:00Z`,
        level: "debug",
        message: "Session initialized",
        metadata: { sessionId: "abc-123" },
      },
      {
        timestamp: `${date}T10:30:00Z`,
        level: "info",
        message: "Tool executed: server-info",
        metadata: { duration: 45 },
      },
    ],
    count: 3,
  };

  return {
    contents: [
      {
        uri: `log:///${date}`,
        mimeType: "application/json",
        text: JSON.stringify(mockLogs, null, 2),
      },
    ],
  };
}

/**
 * Read feature configuration
 *
 * @param feature - Feature name (tools, resources, prompts, sampling)
 * @param context - Server context
 */
export async function readFeatureConfig(
  feature: string,
  context: ServerContext
): Promise<ReadResourceResult> {
  const validFeatures = ["tools", "resources", "prompts", "sampling"];

  if (!validFeatures.includes(feature)) {
    return {
      contents: [
        {
          uri: `config:///${feature}`,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              error: "Unknown feature",
              validFeatures,
              received: feature,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Get session to check feature status
  const result = await context.provider.getSession();
  const session = result.data;

  if (!session) {
    return {
      contents: [
        {
          uri: `config:///${feature}`,
          mimeType: "application/json",
          text: JSON.stringify({ error: "No active session" }, null, 2),
        },
      ],
    };
  }

  const config = {
    feature,
    enabled: session.features[feature as keyof typeof session.features] ?? false,
    description: getFeatureDescription(feature),
    project: session.projectName,
  };

  return {
    contents: [
      {
        uri: `config:///${feature}`,
        mimeType: "application/json",
        text: JSON.stringify(config, null, 2),
      },
    ],
  };
}

/**
 * Get description for a feature
 */
function getFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    tools: "Callable functions that the LLM can invoke",
    resources: "Data sources exposed to the LLM",
    prompts: "Reusable prompt templates",
    sampling: "LLM completion requests from the server",
  };
  return descriptions[feature] ?? "Unknown feature";
}

/**
 * Read delegation configuration for a specific tool
 *
 * @param tool - Tool name or delegation point (e.g., "session_init:client_discovery")
 * @param context - Server context
 */
export async function readDelegationConfig(
  tool: string,
  context: ServerContext
): Promise<ReadResourceResult> {
  // Get the delegation config from context
  const delegationConfig = context.defaultToolDelegations ?? {};
  const toolConfig = delegationConfig[tool];

  // Build response showing current configuration
  const config = {
    tool,
    configured: toolConfig !== undefined,
    settings: toolConfig ?? {
      mode: "local-only",
      fallbackEnabled: true,
      delegationTimeout: undefined,
    },
    availableModes: ["local-only", "delegate-first", "delegate-only"],
    description: getDelegationModeDescription(toolConfig?.mode ?? "local-only"),
  };

  return {
    contents: [
      {
        uri: `delegation:///${tool}`,
        mimeType: "application/json",
        text: JSON.stringify(config, null, 2),
      },
    ],
  };
}

/**
 * Get description for a delegation mode
 */
function getDelegationModeDescription(mode: string): string {
  const descriptions: Record<string, string> = {
    "local-only": "Always execute locally, never delegate to host LLM",
    "delegate-first": "Try delegating to host LLM first, fallback to local on failure",
    "delegate-only": "Must delegate to host LLM, error if sampling unavailable",
  };
  return descriptions[mode] ?? "Unknown mode";
}

/**
 * Handle a templated resource read
 *
 * This function routes templated URIs to their appropriate handlers.
 * Templates are checked in order of specificity (most specific first).
 */
export async function handleTemplatedResourceRead(
  uri: string,
  context: ServerContext
): Promise<ReadResourceResult | null> {
  // Try log entries template
  const logParams = extractTemplateParams(LOG_ENTRIES_TEMPLATE.uriTemplate, uri);
  if (logParams?.date) {
    return readLogEntries(logParams.date, context);
  }

  // Try feature config template
  const configParams = extractTemplateParams(FEATURE_CONFIG_TEMPLATE.uriTemplate, uri);
  if (configParams?.feature) {
    return readFeatureConfig(configParams.feature, context);
  }

  // Try delegation config template
  const delegationParams = extractTemplateParams(DELEGATION_CONFIG_TEMPLATE.uriTemplate, uri);
  if (delegationParams?.tool) {
    return readDelegationConfig(delegationParams.tool, context);
  }

  // No template matched
  return null;
}

// =============================================================================
// Registry Initialization
// =============================================================================

/**
 * Initialize the template registry with all built-in templates
 *
 * This function registers all built-in templates with their handlers.
 * Custom templates can be added after initialization using registerTemplate().
 */
export function initializeTemplateRegistry(): void {
  // Log entries - date-based logs
  registerTemplate(LOG_ENTRIES_TEMPLATE, async (params, context) => {
    return readLogEntries(params.date ?? "", context);
  });

  // Feature config - MCP feature settings
  registerTemplate(FEATURE_CONFIG_TEMPLATE, async (params, context) => {
    return readFeatureConfig(params.feature ?? "", context);
  });

  // Delegation config - tool delegation settings
  registerTemplate(DELEGATION_CONFIG_TEMPLATE, async (params, context) => {
    return readDelegationConfig(params.tool ?? "", context);
  });
}

/**
 * Handle a templated resource read using the registry
 *
 * This is an alternative to handleTemplatedResourceRead that uses
 * the template registry. Use this for custom template extensions.
 */
export async function handleTemplatedResourceReadFromRegistry(
  uri: string,
  context: ServerContext
): Promise<ReadResourceResult | null> {
  for (const [uriTemplate, entry] of templateRegistry) {
    const params = extractTemplateParams(uriTemplate, uri);
    if (params) {
      return entry.handler(params, context);
    }
  }
  return null;
}
