.PHONY: rebuild build test check lint format clean mcp mcp.stdio mcp.http cli worktree worktree.update worktree.delete help

# Build & Development
rebuild:
	pnpm clean || true
	pnpm install
	pnpm build
	pnpm lint
	pnpm test

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

check:
	pnpm check

format:
	pnpm format

clean:
	pnpm clean

# MCP Server
mcp:
	pnpm workspace @mcp-toolkit/mcp build
	npx @modelcontextprotocol/inspector pnpm workspace @mcp-toolkit/mcp start:stdio

mcp.stdio:
	pnpm workspace @mcp-toolkit/mcp build
	pnpm workspace @mcp-toolkit/mcp start:stdio

mcp.http:
	pnpm workspace @mcp-toolkit/mcp build
	pnpm workspace @mcp-toolkit/mcp start:http

# CLI
cli:
	pnpm workspace @mcp-toolkit/cli run cli --help

# Worktree Management
worktree:
	@BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$BRANCH" = "main" ]; then \
		echo "Error: Create a feature branch first: git checkout -b <branch>"; \
		exit 1; \
	fi; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "Error: Uncommitted changes. Commit or stash first."; \
		exit 1; \
	fi; \
	git worktree prune; \
	git checkout main; \
	git worktree add ../mcp-toolkit-$$BRANCH $$BRANCH; \
	echo "Worktree created: ../mcp-toolkit-$$BRANCH"

worktree.update:
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "Error: Uncommitted changes. Commit or stash first."; \
		exit 1; \
	fi; \
	BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	git fetch origin; \
	if [ "$$BRANCH" = "main" ]; then \
		git pull origin main; \
	else \
		git rebase origin/main || { echo "Resolve conflicts, then: git rebase --continue"; exit 1; }; \
	fi

worktree.delete:
	@GIT_DIR=$$(git rev-parse --git-dir 2>/dev/null); \
	GIT_COMMON=$$(git rev-parse --git-common-dir 2>/dev/null); \
	if [ "$$GIT_DIR" = "$$GIT_COMMON" ] || [ "$$GIT_DIR" = ".git" ]; then \
		echo "Error: Not in a worktree."; \
		exit 1; \
	fi; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "Error: Uncommitted changes. Commit or stash first."; \
		exit 1; \
	fi; \
	BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	git fetch origin; \
	LOCAL=$$(git rev-parse HEAD); \
	REMOTE=$$(git rev-parse origin/$$BRANCH 2>/dev/null || echo ""); \
	if [ -z "$$REMOTE" ]; then \
		echo "Error: Branch not on remote. Push first: git push -u origin $$BRANCH"; \
		exit 1; \
	fi; \
	if [ "$$LOCAL" != "$$REMOTE" ]; then \
		echo "Error: Not synced with remote. Push or pull first."; \
		exit 1; \
	fi; \
	WORKTREE=$$(basename $$(pwd)); \
	read -p "Delete worktree '$$WORKTREE'? [y/N] " CONFIRM; \
	if [ "$$CONFIRM" != "y" ] && [ "$$CONFIRM" != "Y" ]; then exit 1; fi; \
	cd .. && rm -rf "$$WORKTREE" && cd mcp-toolkit && \
	git pull && git worktree prune; \
	echo "Worktree deleted: $$WORKTREE"

help:
	@echo "Build:     rebuild build test clean"
	@echo "Quality:   check lint format"
	@echo "MCP:       mcp mcp.stdio mcp.http"
	@echo "CLI:       cli"
	@echo "Worktree:  worktree worktree.update worktree.delete"
