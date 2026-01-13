/**
 * Eval Result Reporters
 *
 * Provides formatters for eval results in various formats including
 * JSON, Markdown, and HTML.
 */

import type { EvalResult, EvalSuiteResult } from "../schema.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Reporter output format
 */
export type ReportFormat = "json" | "markdown" | "html" | "console";

/**
 * Reporter options
 */
export interface ReporterOptions {
  /** Include detailed tool call results */
  includeToolCalls?: boolean;
  /** Include assertion details */
  includeAssertions?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Pretty print JSON */
  prettyJson?: boolean;
  /** Include only failed scenarios */
  failedOnly?: boolean;
}

/**
 * Reporter interface
 */
export interface Reporter {
  /** Format a single eval result */
  formatResult(result: EvalResult, options?: ReporterOptions): string;
  /** Format a suite result */
  formatSuiteResult(result: EvalSuiteResult, options?: ReporterOptions): string;
}

// =============================================================================
// JSON Reporter
// =============================================================================

/**
 * JSON reporter for machine-readable output
 */
export const jsonReporter: Reporter = {
  formatResult(result: EvalResult, options?: ReporterOptions): string {
    const filtered = filterResult(result, options);
    return options?.prettyJson ? JSON.stringify(filtered, null, 2) : JSON.stringify(filtered);
  },

  formatSuiteResult(result: EvalSuiteResult, options?: ReporterOptions): string {
    const filtered = filterSuiteResult(result, options);
    return options?.prettyJson ? JSON.stringify(filtered, null, 2) : JSON.stringify(filtered);
  },
};

// =============================================================================
// Markdown Reporter
// =============================================================================

/**
 * Markdown reporter for documentation
 */
export const markdownReporter: Reporter = {
  formatResult(result: EvalResult, options?: ReporterOptions): string {
    const lines: string[] = [];

    // Header
    const statusIcon = result.passed ? "✅" : "❌";
    lines.push(`## ${statusIcon} ${result.scenario}`);
    lines.push("");

    // Summary
    lines.push(`**Status:** ${result.passed ? "Passed" : "Failed"}`);
    lines.push(`**Score:** ${(result.score * 100).toFixed(1)}%`);
    lines.push(`**Duration:** ${result.durationMs.toFixed(0)}ms`);

    if (result.error) {
      lines.push(`**Error:** ${result.error}`);
    }

    // Tool calls
    if (options?.includeToolCalls && result.toolCalls.length > 0) {
      lines.push("");
      lines.push("### Tool Calls");
      lines.push("");
      for (const tc of result.toolCalls) {
        lines.push(`- **${tc.tool}** (${tc.durationMs.toFixed(0)}ms)`);
        lines.push(`  - Args: \`${JSON.stringify(tc.arguments)}\``);
        if (tc.error) {
          lines.push(`  - Error: ${tc.error}`);
        }
      }
    }

    // Assertions
    if (options?.includeAssertions && result.assertions.length > 0) {
      lines.push("");
      lines.push("### Assertions");
      lines.push("");
      for (const a of result.assertions) {
        const icon = a.passed ? "✅" : "❌";
        lines.push(`- ${icon} **${a.assertion.type}** (score: ${(a.score * 100).toFixed(0)}%)`);
        if (a.message) {
          lines.push(`  - ${a.message}`);
        }
      }
    }

    return lines.join("\n");
  },

  formatSuiteResult(result: EvalSuiteResult, options?: ReporterOptions): string {
    const lines: string[] = [];

    // Header
    const statusIcon = result.passed ? "✅" : "❌";
    lines.push(`# ${statusIcon} ${result.suite}`);
    lines.push("");

    // Summary
    lines.push("## Summary");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Status | ${result.passed ? "Passed" : "Failed"} |`);
    lines.push(`| Score | ${(result.score * 100).toFixed(1)}% |`);
    lines.push(`| Passed | ${result.passedScenarios}/${result.totalScenarios} |`);
    lines.push(`| Failed | ${result.failedScenarios} |`);
    lines.push(`| Duration | ${(result.durationMs / 1000).toFixed(2)}s |`);

    if (options?.includeTimestamps) {
      lines.push(`| Timestamp | ${result.timestamp} |`);
    }

    // Individual results
    lines.push("");
    lines.push("## Results");
    lines.push("");

    const scenarios = options?.failedOnly
      ? result.results.filter((r) => !r.passed)
      : result.results;

    for (const scenario of scenarios) {
      lines.push(this.formatResult(scenario, options));
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    return lines.join("\n");
  },
};

// =============================================================================
// HTML Reporter
// =============================================================================

/**
 * HTML reporter for web viewing
 */
export const htmlReporter: Reporter = {
  formatResult(result: EvalResult, options?: ReporterOptions): string {
    const statusClass = result.passed ? "passed" : "failed";
    const statusIcon = result.passed ? "✅" : "❌";

    let html = `
<div class="eval-result ${statusClass}">
  <h3>${statusIcon} ${escapeHtml(result.scenario)}</h3>
  <div class="summary">
    <span class="status">${result.passed ? "Passed" : "Failed"}</span>
    <span class="score">${(result.score * 100).toFixed(1)}%</span>
    <span class="duration">${result.durationMs.toFixed(0)}ms</span>
  </div>`;

    if (result.error) {
      html += `<div class="error">${escapeHtml(result.error)}</div>`;
    }

    if (options?.includeToolCalls && result.toolCalls.length > 0) {
      html += `
  <div class="tool-calls">
    <h4>Tool Calls</h4>
    <ul>`;
      for (const tc of result.toolCalls) {
        html += `
      <li>
        <strong>${escapeHtml(tc.tool)}</strong> (${tc.durationMs.toFixed(0)}ms)
        <code>${escapeHtml(JSON.stringify(tc.arguments))}</code>
        ${tc.error ? `<span class="error">${escapeHtml(tc.error)}</span>` : ""}
      </li>`;
      }
      html += `
    </ul>
  </div>`;
    }

    if (options?.includeAssertions && result.assertions.length > 0) {
      html += `
  <div class="assertions">
    <h4>Assertions</h4>
    <ul>`;
      for (const a of result.assertions) {
        const icon = a.passed ? "✅" : "❌";
        html += `
      <li class="${a.passed ? "passed" : "failed"}">
        ${icon} <strong>${escapeHtml(a.assertion.type)}</strong>
        <span class="score">${(a.score * 100).toFixed(0)}%</span>
        ${a.message ? `<span class="message">${escapeHtml(a.message)}</span>` : ""}
      </li>`;
      }
      html += `
    </ul>
  </div>`;
    }

    html += `
</div>`;

    return html;
  },

  formatSuiteResult(result: EvalSuiteResult, options?: ReporterOptions): string {
    const statusClass = result.passed ? "passed" : "failed";
    const statusIcon = result.passed ? "✅" : "❌";

    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Eval Results: ${escapeHtml(result.suite)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .summary-table { border-collapse: collapse; margin: 20px 0; }
    .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 8px 16px; text-align: left; }
    .summary-table th { background: #f5f5f5; }
    .eval-result { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .eval-result.passed { border-left: 4px solid #22c55e; }
    .eval-result.failed { border-left: 4px solid #ef4444; }
    .eval-result h3 { margin-top: 0; }
    .summary { display: flex; gap: 16px; color: #666; }
    .error { color: #ef4444; margin-top: 8px; }
    .tool-calls, .assertions { margin-top: 16px; }
    .tool-calls h4, .assertions h4 { margin-bottom: 8px; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .assertions li.passed { color: #22c55e; }
    .assertions li.failed { color: #ef4444; }
  </style>
</head>
<body>
  <h1>${statusIcon} ${escapeHtml(result.suite)}</h1>

  <h2>Summary</h2>
  <table class="summary-table">
    <tr><th>Status</th><td class="${statusClass}">${result.passed ? "Passed" : "Failed"}</td></tr>
    <tr><th>Score</th><td>${(result.score * 100).toFixed(1)}%</td></tr>
    <tr><th>Passed</th><td>${result.passedScenarios}/${result.totalScenarios}</td></tr>
    <tr><th>Failed</th><td>${result.failedScenarios}</td></tr>
    <tr><th>Duration</th><td>${(result.durationMs / 1000).toFixed(2)}s</td></tr>`;

    if (options?.includeTimestamps) {
      html += `
    <tr><th>Timestamp</th><td>${escapeHtml(result.timestamp)}</td></tr>`;
    }

    html += `
  </table>

  <h2>Results</h2>`;

    const scenarios = options?.failedOnly
      ? result.results.filter((r) => !r.passed)
      : result.results;

    for (const scenario of scenarios) {
      html += this.formatResult(scenario, options);
    }

    html += `
</body>
</html>`;

    return html;
  },
};

// =============================================================================
// Console Reporter
// =============================================================================

/**
 * Console reporter for terminal output
 */
export const consoleReporter: Reporter = {
  formatResult(result: EvalResult, options?: ReporterOptions): string {
    const lines: string[] = [];
    const status = result.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";

    lines.push(
      `${status} ${result.scenario} (${(result.score * 100).toFixed(0)}%) [${result.durationMs.toFixed(0)}ms]`
    );

    if (result.error) {
      lines.push(`  \x1b[31mError: ${result.error}\x1b[0m`);
    }

    if (options?.includeToolCalls && result.toolCalls.length > 0) {
      for (const tc of result.toolCalls) {
        const tcStatus = tc.error ? "\x1b[31m✗\x1b[0m" : "\x1b[32m✓\x1b[0m";
        lines.push(`  ${tcStatus} ${tc.tool} [${tc.durationMs.toFixed(0)}ms]`);
        if (tc.error) {
          lines.push(`      ${tc.error}`);
        }
      }
    }

    if (options?.includeAssertions && result.assertions.length > 0) {
      for (const a of result.assertions) {
        const aStatus = a.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
        lines.push(`  ${aStatus} ${a.assertion.type}`);
        if (a.message && !a.passed) {
          lines.push(`      ${a.message}`);
        }
      }
    }

    return lines.join("\n");
  },

  formatSuiteResult(result: EvalSuiteResult, options?: ReporterOptions): string {
    const lines: string[] = [];
    const status = result.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";

    lines.push(`\n${status} ${result.suite}`);
    lines.push(`  Score: ${(result.score * 100).toFixed(1)}%`);
    lines.push(`  Passed: ${result.passedScenarios}/${result.totalScenarios}`);
    lines.push(`  Duration: ${(result.durationMs / 1000).toFixed(2)}s`);
    lines.push("");

    const scenarios = options?.failedOnly
      ? result.results.filter((r) => !r.passed)
      : result.results;

    for (const scenario of scenarios) {
      lines.push(this.formatResult(scenario, options));
    }

    lines.push("");
    lines.push(
      `${result.passed ? "\x1b[32m" : "\x1b[31m"}${result.passedScenarios} passing, ${result.failedScenarios} failing\x1b[0m`
    );

    return lines.join("\n");
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filter result based on options
 */
function filterResult(result: EvalResult, options?: ReporterOptions): Partial<EvalResult> {
  const filtered: Partial<EvalResult> = {
    scenario: result.scenario,
    passed: result.passed,
    score: result.score,
    durationMs: result.durationMs,
  };

  if (result.error) {
    filtered.error = result.error;
  }

  if (result.llmResponse) {
    filtered.llmResponse = result.llmResponse;
  }

  if (options?.includeToolCalls) {
    filtered.toolCalls = result.toolCalls;
  }

  if (options?.includeAssertions) {
    filtered.assertions = result.assertions;
  }

  return filtered;
}

/**
 * Filter suite result based on options
 */
function filterSuiteResult(
  result: EvalSuiteResult,
  options?: ReporterOptions
): Partial<EvalSuiteResult> {
  const filtered: Partial<EvalSuiteResult> = {
    suite: result.suite,
    passed: result.passed,
    totalScenarios: result.totalScenarios,
    passedScenarios: result.passedScenarios,
    failedScenarios: result.failedScenarios,
    score: result.score,
    durationMs: result.durationMs,
  };

  if (options?.includeTimestamps) {
    filtered.timestamp = result.timestamp;
  }

  const scenarios = options?.failedOnly ? result.results.filter((r) => !r.passed) : result.results;

  filtered.results = scenarios.map((r) => filterResult(r, options) as EvalResult);

  return filtered;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Get a reporter by format
 */
export function getReporter(format: ReportFormat): Reporter {
  switch (format) {
    case "json":
      return jsonReporter;
    case "markdown":
      return markdownReporter;
    case "html":
      return htmlReporter;
    case "console":
      return consoleReporter;
    default:
      return jsonReporter;
  }
}

/**
 * Format a result with automatic format detection
 */
export function formatResult(
  result: EvalResult | EvalSuiteResult,
  format: ReportFormat = "console",
  options?: ReporterOptions
): string {
  const reporter = getReporter(format);

  if ("results" in result) {
    return reporter.formatSuiteResult(result, options);
  }
  return reporter.formatResult(result, options);
}
