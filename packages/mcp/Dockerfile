# MCP Toolkit Server Dockerfile
#
# Build:
#   docker build -t mcp-toolkit .
#
# Run (HTTP mode):
#   docker run -p 3000:3000 mcp-toolkit --http --host 0.0.0.0
#
# Run with auth token:
#   docker run -p 3000:3000 -e MCP_AUTH_TOKEN=secret mcp-toolkit --http --host 0.0.0.0 --token $MCP_AUTH_TOKEN

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
COPY packages/mcp ./packages/mcp

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@mcp-toolkit/mcp

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/packages/mcp/dist ./dist
COPY --from=builder /app/packages/mcp/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 mcpuser
USER mcpuser

EXPOSE 3000

# Default to HTTP mode
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--http", "--host", "0.0.0.0", "--port", "3000"]
