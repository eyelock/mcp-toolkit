#!/bin/bash
#
# Run MCP server in HTTP mode
#
# Usage:
#   ./bin/dev/mcp-http.sh
#   ./bin/dev/mcp-http.sh --port 8080
#   ./bin/dev/mcp-http.sh --token mysecret
#

set -e

PORT=${PORT:-3000}
HOST=${HOST:-localhost}
TOKEN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --token)
            TOKEN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build first
echo "Building @mcp-toolkit/mcp..."
pnpm --filter @mcp-toolkit/mcp build

echo ""
echo "Starting MCP HTTP server..."
echo "  Host: $HOST"
echo "  Port: $PORT"
if [ -n "$TOKEN" ]; then
    echo "  Auth: Bearer token enabled"
fi
echo ""

# Construct command
CMD="pnpm --filter @mcp-toolkit/mcp start:http --host $HOST --port $PORT"
if [ -n "$TOKEN" ]; then
    CMD="$CMD --token $TOKEN"
fi

# Run
eval $CMD
