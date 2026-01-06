#!/bin/bash
#
# Run MCP server with MCP Inspector for debugging
#
# Usage: ./bin/dev/mcp-inspector.sh
#

set -e

echo "Starting MCP server with Inspector..."
echo ""

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js."
    exit 1
fi

# Build the MCP package first
echo "Building @mcp-toolkit/mcp..."
pnpm --filter @mcp-toolkit/mcp build

# Run with MCP Inspector
echo ""
echo "Launching MCP Inspector..."
echo "The inspector will open in your browser."
echo ""

npx @anthropic-ai/mcp-inspector pnpm --filter @mcp-toolkit/mcp start:stdio
