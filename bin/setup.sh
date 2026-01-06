#!/bin/bash
#
# MCP Toolkit Setup Script
#
# Run this after cloning with degit to customize the project:
#   degit eyelock/mcp-toolkit my-server
#   cd my-server
#   ./bin/setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       MCP Toolkit Setup Script         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Get project details
read -p "Project name (kebab-case, e.g., my-api-server): " PROJECT_NAME
read -p "Package scope (e.g., @myorg or @username): " PACKAGE_SCOPE
read -p "Description: " DESCRIPTION
read -p "Author name: " AUTHOR

# Validate project name
if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9-]+$ ]]; then
    echo -e "${RED}Error: Project name must be kebab-case (lowercase letters, numbers, hyphens)${NC}"
    exit 1
fi

# Validate package scope
if [[ ! "$PACKAGE_SCOPE" =~ ^@[a-z0-9-]+$ ]]; then
    echo -e "${RED}Error: Package scope must start with @ and be lowercase${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Configuring project...${NC}"
echo ""

# Create derived names
PROJECT_UPPER=$(echo "$PROJECT_NAME" | tr '[:lower:]-' '[:upper:]_')
PROJECT_PASCAL=$(echo "$PROJECT_NAME" | sed -r 's/(^|-)([a-z])/\U\2/g')

echo "  Project name:  $PROJECT_NAME"
echo "  Package scope: $PACKAGE_SCOPE"
echo "  Env prefix:    $PROJECT_UPPER"
echo "  Display name:  $PROJECT_PASCAL"
echo ""

# Replace placeholders in all relevant files
echo -e "${BLUE}Updating package names...${NC}"

# Find and replace in JSON, TypeScript, and Markdown files
find . -type f \( -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" \) \
    -not -path "./node_modules/*" \
    -not -path "./.git/*" \
    -not -path "./bin/setup.sh" \
    -exec sed -i '' \
        -e "s/@mcp-toolkit/${PACKAGE_SCOPE}/g" \
        -e "s/mcp-toolkit/${PROJECT_NAME}/g" \
        -e "s/MCP_TOOLKIT/${PROJECT_UPPER}/g" \
        -e "s/MCP Toolkit/${PROJECT_PASCAL}/g" \
        {} \;

# Update root package.json with metadata
echo -e "${BLUE}Updating package.json metadata...${NC}"

if command -v jq &> /dev/null; then
    # Use jq if available
    tmp=$(mktemp)
    jq --arg desc "$DESCRIPTION" --arg author "$AUTHOR" \
        '.description = $desc | .author = $author' \
        package.json > "$tmp" && mv "$tmp" package.json
else
    echo -e "${YELLOW}Note: Install jq for better JSON handling${NC}"
fi

# Update bin names in CLI package
echo -e "${BLUE}Updating CLI binary name...${NC}"
if [ -f "packages/cli/package.json" ]; then
    sed -i '' "s/mcp-toolkit-cli/${PROJECT_NAME}-cli/g" packages/cli/package.json
    sed -i '' "s/mcp-toolkit-cli/${PROJECT_NAME}-cli/g" packages/cli/bin/run.js 2>/dev/null || true
fi

# Initialize fresh git repo
echo -e "${BLUE}Initializing git repository...${NC}"
rm -rf .git
git init
git add .
git commit -m "Initial commit from mcp-toolkit template

Project: ${PROJECT_NAME}
Scope: ${PACKAGE_SCOPE}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Setup Complete!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Install dependencies:"
echo "     ${BLUE}pnpm install${NC}"
echo ""
echo "  2. Build the project:"
echo "     ${BLUE}pnpm build${NC}"
echo ""
echo "  3. Run tests:"
echo "     ${BLUE}pnpm test${NC}"
echo ""
echo "  4. Start the MCP server:"
echo "     ${BLUE}pnpm --filter ${PACKAGE_SCOPE}/mcp start${NC}"
echo ""
echo "  5. Or use the CLI:"
echo "     ${BLUE}pnpm --filter ${PACKAGE_SCOPE}/cli run cli --help${NC}"
echo ""
