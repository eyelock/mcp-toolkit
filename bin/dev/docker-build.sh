#!/bin/bash
#
# Build Docker images locally
#
# Usage:
#   ./bin/dev/docker-build.sh           # Build all
#   ./bin/dev/docker-build.sh mcp       # Build MCP server only
#   ./bin/dev/docker-build.sh cli       # Build CLI only
#

set -e

IMAGE_PREFIX=${IMAGE_PREFIX:-mcp-toolkit}
VERSION=${VERSION:-latest}

build_mcp() {
    echo "Building MCP server image..."
    docker build \
        -f packages/mcp/Dockerfile \
        -t "$IMAGE_PREFIX-mcp:$VERSION" \
        .
    echo "  Built: $IMAGE_PREFIX-mcp:$VERSION"
}

build_cli() {
    echo "Building CLI image..."
    docker build \
        -f packages/cli/Dockerfile \
        -t "$IMAGE_PREFIX-cli:$VERSION" \
        .
    echo "  Built: $IMAGE_PREFIX-cli:$VERSION"
}

case "${1:-all}" in
    mcp)
        build_mcp
        ;;
    cli)
        build_cli
        ;;
    all)
        build_mcp
        echo ""
        build_cli
        ;;
    *)
        echo "Usage: $0 [mcp|cli|all]"
        exit 1
        ;;
esac

echo ""
echo "Done!"
echo ""
echo "Run the images:"
echo "  docker run -p 3000:3000 $IMAGE_PREFIX-mcp:$VERSION"
echo "  docker run $IMAGE_PREFIX-cli:$VERSION --help"
