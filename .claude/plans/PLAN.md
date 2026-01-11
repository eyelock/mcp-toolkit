# MCP Toolkit Implementation Plan

A boilerplate/starter template for building full-featured MCP servers with CLI parity, inspired by ACME patterns.

## Overview

| Attribute | Value |
|-----------|-------|
| Package Scope | `@eyelock/mcp-toolkit` |
| Template Mechanism | `degit eyelock/mcp-toolkit my-server` |
| License | MIT |
| MCP Scope | Full-featured (tools, resources, prompts, sampling) |
| CLI Parity | Optional but scaffolded |
| Infrastructure | Docker support (Dockerfiles + dev container) |

---

## Core Patterns (from ACME)

### 1. Zod as Source of Truth
- All schemas in `@mcp-toolkit/model/src/schema.ts`
- Every field has `.describe()` for self-documentation
- Input schemas derived via `.pick()`, `.extend()`, `.partial()`
- No manual redefinition - always derive

### 2. MCP Transport Abstraction
- stdio mode for local/inspector use
- SSE/HTTP mode for remote deployment
- Bearer token auth for HTTP
- Single codebase, multiple transports

### 3. Provider Pattern
- Pluggable storage backends
- Interface-driven design
- In-memory reference implementation (no external deps)

---

## Primary Example: Session Init

Instead of abstract schema examples, the toolkit demonstrates patterns through a **session-init** flow:

```
┌─────────────────────────────────────────────────────────┐
│  MCP Toolkit - Session Init                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Welcome! Let's configure your session.                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ What's your project name?                        │   │
│  │ ○ Use current directory name                     │   │
│  │ ○ Enter custom name                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Which features do you want enabled?              │   │
│  │ ☑ Tools                                          │   │
│  │ ☑ Resources                                      │   │
│  │ ☐ Prompts                                        │   │
│  │ ☐ Sampling                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

This demonstrates:
- **Elicitation patterns** - Multi-question forms with options
- **Assistant prompts** - Context-aware MCP prompts
- **Schema derivation** - Session config schema with Zod
- **Provider usage** - Persisting session state
- **Full round-trip** - MCP server actually working

---

## Project Structure

```
mcp-toolkit/
├── bin/
│   ├── setup.sh                    # Interactive project renaming
│   └── dev/
│       ├── mcp-http.sh             # Run MCP in HTTP mode
│       ├── mcp-inspector.sh        # Run with MCP inspector
│       └── docker-build.sh         # Build Docker images locally
│
├── .devcontainer/
│   ├── devcontainer.json           # VS Code / Codespaces config
│   └── Dockerfile                  # Dev container image
│
├── packages/
│   ├── model/                      # @mcp-toolkit/model
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── schema.ts           # Zod schemas (source of truth)
│   │       └── schema.test.ts
│   │
│   ├── mcp/                        # @mcp-toolkit/mcp
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts            # Server entry point
│   │       ├── server.ts           # MCP server setup
│   │       ├── transport/
│   │       │   ├── index.ts
│   │       │   ├── stdio.ts
│   │       │   └── http.ts
│   │       ├── tools/
│   │       │   ├── index.ts        # Tool registration
│   │       │   └── session-init.ts # Session init tool
│   │       ├── resources/
│   │       │   ├── index.ts
│   │       │   └── session.ts      # Session resource
│   │       ├── prompts/
│   │       │   ├── index.ts
│   │       │   └── welcome.ts      # Welcome prompt
│   │       ├── elicitation/
│   │       │   ├── index.ts
│   │       │   └── session-init.ts # Elicitation handler
│   │       └── sampling/
│   │           └── index.ts        # Sampling patterns
│   │
│   ├── cli/                        # @mcp-toolkit/cli (optional)
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── bin/
│   │   │   └── run.js
│   │   └── src/
│   │       ├── index.ts
│   │       └── commands/
│   │           ├── init.ts         # CLI mirror of session-init
│   │           └── status.ts       # Show session status
│   │
│   ├── storage/                    # @mcp-toolkit/storage
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── interface.ts        # Provider contract
│   │       ├── memory.ts           # In-memory implementation
│   │       └── memory.test.ts
│   │
│   └── shared/                     # Shared build configs
│       ├── eslint/
│       │   └── package.json
│       ├── typescript/
│       │   ├── package.json
│       │   └── base.json
│       ├── vitest/
│       │   └── package.json
│       └── esbuild/
│           └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Build, lint, test
│       └── docker.yml              # Docker image builds
│
├── docs/
│   ├── README.md                   # Main documentation
│   ├── getting-started.md          # Quick start guide
│   ├── patterns/
│   │   ├── zod-schemas.md          # Schema patterns
│   │   ├── cli-parity.md           # CLI/MCP parity
│   │   ├── providers.md            # Provider pattern
│   │   └── elicitation.md          # Elicitation patterns
│   └── customization/
│       ├── adding-tools.md         # How to add tools
│       ├── adding-resources.md     # How to add resources
│       └── adding-providers.md     # How to add providers
│
├── turbo.json
├── package.json
├── .gitignore
├── LICENSE                         # MIT
└── README.md                       # Project overview + setup
```

---

## Setup Script (`bin/setup.sh`)

Interactive script that runs after `degit`:

```bash
#!/bin/bash
# MCP Toolkit Setup Script

echo "🔧 MCP Toolkit Setup"
echo ""

# Gather info
read -p "Project name (kebab-case): " PROJECT_NAME
read -p "Package scope (@org or @username): " PACKAGE_SCOPE
read -p "Description: " DESCRIPTION
read -p "Author: " AUTHOR

# Validate
if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo "Error: Project name must be kebab-case"
  exit 1
fi

# Replace placeholders
echo "Updating package names..."
find . -type f \( -name "*.json" -o -name "*.ts" -o -name "*.md" \) -exec sed -i '' \
  -e "s/@mcp-toolkit/${PACKAGE_SCOPE}/g" \
  -e "s/mcp-toolkit/${PROJECT_NAME}/g" \
  {} \;

# Update package.json metadata
# ... (jq commands for description, author, etc.)

# Initialize git
rm -rf .git
git init
git add .
git commit -m "Initial commit from mcp-toolkit template"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  cd ${PROJECT_NAME}"
echo "  yarn install"
echo "  yarn dev"
```

---

## Documentation Plan

### `README.md` (root)
- What is MCP Toolkit
- Quick start (degit + setup.sh)
- Project structure overview
- Links to detailed docs

### `docs/getting-started.md`
- Prerequisites (Node 20+, Yarn 4)
- Step-by-step setup
- Running the example (session-init)
- Testing with MCP Inspector
- Building Docker images

### `docs/patterns/` (4 files)
- **zod-schemas.md**: Schema-first design, derivation patterns, self-documentation
- **cli-parity.md**: Why parity matters, how to maintain it, when to skip
- **providers.md**: Interface design, implementing new providers
- **elicitation.md**: Multi-question flows, validation, state management

### `docs/customization/` (3 files)
- **adding-tools.md**: Step-by-step tool creation, registration, testing
- **adding-resources.md**: Resource patterns, subscriptions
- **adding-providers.md**: Provider interface, testing contract

---

## Implementation Phases

### Phase 1: Foundation
| Task | Description |
|------|-------------|
| 1.1 | Initialize monorepo (package.json, turbo.json, yarn workspaces) |
| 1.2 | Create shared configs (eslint, typescript, vitest, esbuild) |
| 1.3 | Create `@mcp-toolkit/model` with session schema |
| 1.4 | Create `@mcp-toolkit/storage` with memory implementation |
| 1.5 | Basic CI workflow (build, lint, test) |

### Phase 2: MCP Server
| Task | Description |
|------|-------------|
| 2.1 | Create `@mcp-toolkit/mcp` package structure |
| 2.2 | Implement transport abstraction (stdio + HTTP) |
| 2.3 | Implement session-init tool with elicitation |
| 2.4 | Implement session resource |
| 2.5 | Implement welcome prompt |
| 2.6 | Add sampling example |
| 2.7 | MCP server Dockerfile |

### Phase 3: CLI (Optional but Scaffolded)
| Task | Description |
|------|-------------|
| 3.1 | Create `@mcp-toolkit/cli` with OCLIF |
| 3.2 | Implement `init` command (mirrors session-init) |
| 3.3 | Implement `status` command |
| 3.4 | CLI Dockerfile |

### Phase 4: Developer Experience
| Task | Description |
|------|-------------|
| 4.1 | Create `.devcontainer/` setup |
| 4.2 | Create `bin/setup.sh` |
| 4.3 | Create `bin/dev/` helper scripts |
| 4.4 | Docker build workflow |

### Phase 5: Documentation
| Task | Description |
|------|-------------|
| 5.1 | Root README.md |
| 5.2 | docs/getting-started.md |
| 5.3 | docs/patterns/*.md (4 files) |
| 5.4 | docs/customization/*.md (3 files) |

### Phase 6: Polish
| Task | Description |
|------|-------------|
| 6.1 | Test full degit + setup.sh flow |
| 6.2 | Verify all examples work |
| 6.3 | License file |
| 6.4 | Final review and cleanup |

---

## Placeholder Tokens

These will be replaced by `bin/setup.sh`:

| Token | Description | Example Replacement |
|-------|-------------|---------------------|
| `@mcp-toolkit` | Package scope | `@eyelock/my-server` |
| `mcp-toolkit` | Project name (kebab) | `my-server` |
| `MCP Toolkit` | Display name | `My Server` |
| `MCP_TOOLKIT` | Env var prefix | `MY_SERVER` |

---

## What's NOT Included (vs ACME)

- git-notes provider (ACME-specific)
- ACME domain types (effort, thought, task, review, rule, standard)
- AWS CodeArtifact publishing
- S3 release uploads
- Changesets versioning
- Complex multi-step elicitation flows
- Terraform infrastructure

---

## Success Criteria

- [ ] `degit eyelock/mcp-toolkit my-server` works
- [ ] `bin/setup.sh` renames all placeholders correctly
- [ ] `yarn install && yarn build` succeeds
- [ ] Session-init example works in MCP Inspector
- [ ] CLI `init` command mirrors MCP tool
- [ ] Docker images build and run
- [ ] Dev container works in VS Code
- [ ] All documentation is accurate and helpful

---

## Open Items

1. **MCP SDK version**: Pin to latest stable or allow range?
2. **Node version**: 20 LTS or also support 18?
3. **Yarn version**: 4.12.0 to match ACME?
4. **Example provider**: Just memory, or add file-based too?
