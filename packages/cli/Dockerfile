# MCP Toolkit CLI Dockerfile
#
# Build:
#   docker build -t mcp-toolkit-cli .
#
# Run:
#   docker run mcp-toolkit-cli init my-project
#   docker run mcp-toolkit-cli status

FROM node:20-alpine AS base
RUN corepack enable

# Build stage
FROM base AS builder
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared ./packages/shared
COPY packages/model ./packages/model
COPY packages/provider ./packages/provider
COPY packages/cli ./packages/cli

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@mcp-toolkit/cli

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/packages/cli/dist ./dist
COPY --from=builder /app/packages/cli/bin ./bin
COPY --from=builder /app/packages/cli/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 cliuser
USER cliuser

ENTRYPOINT ["node", "bin/run.js"]
CMD ["--help"]
