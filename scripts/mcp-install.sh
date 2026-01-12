#!/usr/bin/env bash
#
# Install MCP configuration to IDE clients
# Usage: ./scripts/mcp-install.sh [cursor|vscode|claude|all]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/mcp.config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check for jq
check_jq() {
  if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed."
    echo "  Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
  fi
}

# Read servers from canonical config
get_servers() {
  jq -c '.servers' "$CONFIG_FILE"
}

# Install to Cursor (.cursor/mcp.json)
install_cursor() {
  local target_dir="$ROOT_DIR/.cursor"
  local target_file="$target_dir/mcp.json"

  mkdir -p "$target_dir"

  # Transform to Cursor format: { "mcpServers": { ... } }
  local servers
  servers=$(get_servers)

  # Cursor needs absolute paths for the command
  local config
  config=$(echo "$servers" | jq --arg root "$ROOT_DIR" '
    to_entries | map(
      .value.args = (.value.args | map(
        if startswith("packages/") then "\($root)/\(.)" else . end
      ))
    ) | from_entries | { mcpServers: . }
  ')

  echo "$config" | jq '.' > "$target_file"
  log_info "Cursor: $target_file"
}

# Install to VS Code (.vscode/settings.json)
install_vscode() {
  local target_dir="$ROOT_DIR/.vscode"
  local target_file="$target_dir/settings.json"

  mkdir -p "$target_dir"

  # Transform to VS Code format: { "mcp.servers": { ... } }
  local servers
  servers=$(get_servers)

  # VS Code needs absolute paths
  local mcp_config
  mcp_config=$(echo "$servers" | jq --arg root "$ROOT_DIR" '
    to_entries | map(
      .value.args = (.value.args | map(
        if startswith("packages/") then "\($root)/\(.)" else . end
      ))
    ) | from_entries
  ')

  # Merge with existing settings if present
  if [[ -f "$target_file" ]]; then
    local existing
    existing=$(cat "$target_file" 2>/dev/null || echo "{}")
    # Validate JSON
    if ! echo "$existing" | jq '.' > /dev/null 2>&1; then
      log_warn "Invalid JSON in $target_file, backing up and replacing"
      cp "$target_file" "$target_file.backup"
      existing="{}"
    fi
    echo "$existing" | jq --argjson mcp "$mcp_config" '. + { "mcp.servers": $mcp }' > "$target_file"
  else
    echo "{}" | jq --argjson mcp "$mcp_config" '{ "mcp.servers": $mcp }' > "$target_file"
  fi

  log_info "VS Code: $target_file"
}

# Install to Claude Desktop
install_claude() {
  local config_dir
  local target_file

  # Determine OS-specific config location
  case "$(uname -s)" in
    Darwin)
      config_dir="$HOME/Library/Application Support/Claude"
      ;;
    Linux)
      config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/Claude"
      ;;
    MINGW*|CYGWIN*|MSYS*)
      config_dir="$APPDATA/Claude"
      ;;
    *)
      log_error "Unsupported OS for Claude Desktop"
      return 1
      ;;
  esac

  target_file="$config_dir/claude_desktop_config.json"

  if [[ ! -d "$config_dir" ]]; then
    log_warn "Claude Desktop config directory not found: $config_dir"
    log_warn "Is Claude Desktop installed?"
    return 1
  fi

  # Transform to Claude format: { "mcpServers": { ... } }
  local servers
  servers=$(get_servers)

  # Claude Desktop needs absolute paths
  local mcp_config
  mcp_config=$(echo "$servers" | jq --arg root "$ROOT_DIR" '
    to_entries | map(
      .value.args = (.value.args | map(
        if startswith("packages/") then "\($root)/\(.)" else . end
      ))
    ) | from_entries
  ')

  # Merge with existing config if present
  if [[ -f "$target_file" ]]; then
    local existing
    existing=$(cat "$target_file" 2>/dev/null || echo "{}")
    if ! echo "$existing" | jq '.' > /dev/null 2>&1; then
      log_warn "Invalid JSON in $target_file, backing up and replacing"
      cp "$target_file" "$target_file.backup"
      existing="{}"
    fi
    # Merge mcpServers objects
    echo "$existing" | jq --argjson mcp "$mcp_config" '
      .mcpServers = ((.mcpServers // {}) + $mcp)
    ' > "$target_file"
  else
    echo "{}" | jq --argjson mcp "$mcp_config" '{ "mcpServers": $mcp }' > "$target_file"
  fi

  log_info "Claude Desktop: $target_file"
}

# Show current config
show_config() {
  echo "Canonical config ($CONFIG_FILE):"
  jq '.' "$CONFIG_FILE"
}

# Main
main() {
  check_jq

  if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "Config file not found: $CONFIG_FILE"
    exit 1
  fi

  local target="${1:-all}"

  echo "Installing MCP configuration..."
  echo ""

  case "$target" in
    cursor)
      install_cursor
      ;;
    vscode)
      install_vscode
      ;;
    claude)
      install_claude
      ;;
    all)
      install_cursor
      install_vscode
      install_claude || true  # Don't fail if Claude not installed
      ;;
    show)
      show_config
      ;;
    *)
      echo "Usage: $0 [cursor|vscode|claude|all|show]"
      exit 1
      ;;
  esac

  echo ""
  echo "Done! Restart your IDE to pick up the changes."
}

main "$@"
