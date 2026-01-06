# MCP Toolkit Development Container
FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install additional tools
RUN apt-get update && apt-get install -y \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable

# Set working directory
WORKDIR /workspace

# Copy package files for dependency caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install

# Copy the rest of the project
COPY . .
