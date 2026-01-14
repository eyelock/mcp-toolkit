# MCP Toolkit

A TypeScript monorepo template for building production-ready Model Context Protocol (MCP) servers.

> **Note**: This is a hobby project. Functional and tested, but expect rough edges!

## What You'll Find Here

| Guide | Description |
|-------|-------------|
| [Getting Started](getting-started.md) | Installation, setup wizard, first build |
| [MCP Reference](mcp-reference.md) | How MCP Toolkit implements the MCP specification |
| [Hooks System](hooks.md) | Contextual LLM guidance through lifecycle hooks |
| [Tool Delegation](tool-delegation.md) | Patterns for host LLM collaboration |

## Quick Links

- [GitHub Repository](https://github.com/eyelock/mcp-toolkit)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## Package Overview

| Package | Purpose |
|---------|---------|
| `@mcp-toolkit/mcp` | MCP server with tools, resources, prompts |
| `@mcp-toolkit/core` | Hook system for LLM guidance |
| `@mcp-toolkit/toolkit` | Demo workflows (optional, deletable) |
| `@mcp-toolkit/model` | Zod schemas |
| `@mcp-toolkit/cli` | CLI interface |
| `@mcp-toolkit/testing` | Test utilities |
