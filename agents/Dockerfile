# Multi-stage build for TypeScript
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy TypeScript source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install bash, screen, vim and dependencies for shell access and Claude Code
RUN apk add --no-cache bash curl git npm screen util-linux vim wget unzip

# Install Claude Code CLI via npm
RUN npm install -g @anthropic-ai/claude-code

# Build arguments for user/group IDs
ARG AGENT_UID=1001
ARG AGENT_GID=1001

# Create non-root user with configurable UID/GID
RUN addgroup -g ${AGENT_GID} agent && \
    adduser -D -u ${AGENT_UID} -G agent agent

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Copy helper scripts
COPY scripts/setup-env.sh /etc/profile.d/agent-env.sh
COPY scripts/setup-permissions.sh /usr/local/bin/setup-permissions.sh
RUN chmod +x /etc/profile.d/agent-env.sh
RUN chmod +x /usr/local/bin/setup-permissions.sh

# Copy CLAUDE.md to /home/.claude directory
COPY CLAUDE.md /home/CLAUDE.md

# Copy set-auth directory for authentication template
COPY set-auth/ /app/set-auth/

# Create bashrc for interactive sessions
RUN echo '#!/bin/bash' > /home/agent/.bashrc && \
    echo '# Source global environment' >> /home/agent/.bashrc && \
    echo 'source /etc/profile.d/agent-env.sh' >> /home/agent/.bashrc && \
    echo '' >> /home/agent/.bashrc && \
    echo '# Welcome message' >> /home/agent/.bashrc && \
    echo 'echo "Welcome to ${AGENT_ID} shell!"' >> /home/agent/.bashrc && \
    echo 'echo " Workspace: /home/agent/workspace (writable)"' >> /home/agent/.bashrc && \
    echo 'echo "📁 Shared: /shared/agents/${AGENT_ID} (persistent)"' >> /home/agent/.bashrc && \
    echo 'if [ -n "$CUSTOM_REPO_PATH" ] && [ -d "/home/workspace/repo" ]; then' >> /home/agent/.bashrc && \
    echo '  echo "📂 Custom Repository: /home/workspace/repo (mounted from host)"' >> /home/agent/.bashrc && \
    echo 'fi' >> /home/agent/.bashrc && \
    echo '' >> /home/agent/.bashrc && \
    echo '# Auto-start Claude Code on first interactive shell' >> /home/agent/.bashrc && \
    echo 'if [ -z "$CLAUDE_STARTED" ] && [ -t 0 ] && [ -t 1 ]; then' >> /home/agent/.bashrc && \
    echo '  export CLAUDE_STARTED=1' >> /home/agent/.bashrc && \
    echo '  echo "🚀 Starting Claude Code AI Assistant..."' >> /home/agent/.bashrc && \
    echo '  echo "Type exit to leave Claude and access the shell"' >> /home/agent/.bashrc && \
    echo '  cd /home' >> /home/agent/.bashrc && \
    echo '  claude --output-format json' >> /home/agent/.bashrc && \
    echo 'fi' >> /home/agent/.bashrc

# Create entrypoint script that runs agent in background and keeps container alive
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'echo "🤖 Starting AI Agent with Shell Support..."' >> /entrypoint.sh && \
    echo 'echo "Agent ID: ${AGENT_ID}"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    # echo '# Configure Claude Code CLI with persistent .claude/.env file in shared storage' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Copy authentication template to home directory for all agents' >> /entrypoint.sh && \
    echo 'echo "📋 Copying authentication template to home directory..."' >> /entrypoint.sh && \
    echo 'cp -r /app/set-auth/. /home/agent/ 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'chown -R agent:agent /home/agent 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'echo "✅ Authentication template copied to $HOME"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo 'export HOME="/home/agent"' >> /entrypoint.sh && \
    echo 'cd /home' >> /entrypoint.sh && \
    # echo 'node dist/index.js &' >> /entrypoint.sh && \
    echo 'AGENT_PID=$!' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo 'exec tail -f /dev/null' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Set up filesystem permissions using dedicated script
RUN /usr/local/bin/setup-permissions.sh

# Switch to non-root user
USER agent

# Change working directory to /home after switching to agent user
WORKDIR /home

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
