# Multi-stage build for TypeScript
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci && npm cache clean --force

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
RUN chmod +x /etc/profile.d/agent-env.sh

# Copy CLAUDE.md to /home/.claude directory
RUN mkdir -p /home/.claude
COPY CLAUDE.md /home/.claude/CLAUDE.md
COPY CLAUDE.md /home/CLAUDE.md
RUN chmod 644 /home/CLAUDE.md

# Copy set-auth directory for authentication template
COPY set-auth/ /app/set-auth/

# Create .gemini template (will be copied to shared volume at runtime)

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
    echo '  sleep 1' >> /home/agent/.bashrc && \
    echo '  cd /home' >> /home/agent/.bashrc && \
    echo '  claude' >> /home/agent/.bashrc && \
    echo 'fi' >> /home/agent/.bashrc

# Create entrypoint script that runs agent in background and keeps container alive
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'echo "🤖 Starting AI Agent with Shell Support..."' >> /entrypoint.sh && \
    echo 'echo "Agent ID: ${AGENT_ID}"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    # echo '# Configure Claude Code CLI with persistent .claude/.env file in shared storage' >> /entrypoint.sh && \
    echo 'CLAUDE_CONFIG_DIR="/home/.claude"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Copy authentication template to shared directory for all agents' >> /entrypoint.sh && \
    echo 'echo "📋 Copying authentication template to shared directory..."' >> /entrypoint.sh && \
    echo 'mkdir -p /shared/agents/${AGENT_ID}' >> /entrypoint.sh && \
    echo 'cp -r /app/set-auth/. /shared/agents/${AGENT_ID}/ 2>/dev/null || true' >> /entrypoint.sh && \
    echo 'chown -R agent:agent /shared/agents/${AGENT_ID}' >> /entrypoint.sh && \
    echo 'echo "✅ Authentication template copied to /shared/agents/${AGENT_ID}"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo 'mkdir -p /home/.claude' >> /entrypoint.sh && \
    # echo 'echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" > /home/.claude/.env' >> /entrypoint.sh && \
    # echo '' >> /entrypoint.sh && \
    # echo 'if [ -n "$ANTHROPIC_API_KEY" ]; then' >> /entrypoint.sh && \
    # echo '  echo "🔧 Configuring Claude Code CLI with persistent .claude/.env..."' >> /entrypoint.sh && \
    # echo '  ' >> /entrypoint.sh && \
    # echo '  # Create .claude/.env in shared storage' >> /entrypoint.sh && \
    # echo '  cat > "$CLAUDE_CONFIG_DIR/.env" << EOF' >> /entrypoint.sh && \
    # echo '# Claude Code CLI Configuration for ${AGENT_ID}' >> /entrypoint.sh && \
    # echo '# This file provides persistent configuration for Claude Code CLI' >> /entrypoint.sh && \
    # echo '# Environment variables are loaded automatically by claude' >> /entrypoint.sh && \
    # echo '' >> /entrypoint.sh && \
    # echo 'ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY' >> /entrypoint.sh && \
    # echo 'CLAUDE_MODEL=${CLAUDE_MODEL:-claude-3-5-sonnet-20241022}' >> /entrypoint.sh && \
    # echo 'EOF' >> /entrypoint.sh && \
    # echo '  ' >> /entrypoint.sh && \
    # echo '  # Set environment variables for claude to find configuration' >> /entrypoint.sh && \
    # echo '  export CLAUDE_CONFIG_DIR="$CLAUDE_CONFIG_DIR"' >> /entrypoint.sh && \
    # echo '  export HOME="/home"' >> /entrypoint.sh && \
    # echo '  ' >> /entrypoint.sh && \
    # echo '  # Verify claude can load configuration' >> /entrypoint.sh && \
    # echo '  if claude --version >/dev/null 2>&1; then' >> /entrypoint.sh && \
    # echo '    echo "✅ Claude Code CLI configured successfully with model: ${CLAUDE_MODEL:-claude-3-5-sonnet-20241022}"' >> /entrypoint.sh && \
    # echo '    echo "📄 Configuration saved to $CLAUDE_CONFIG_DIR/.env"' >> /entrypoint.sh && \
    # echo '  else' >> /entrypoint.sh && \
    # echo '    echo "⚠️  Claude Code CLI configuration may have issues - check API key"' >> /entrypoint.sh && \
    # echo '  fi' >> /entrypoint.sh && \
    # echo 'else' >> /entrypoint.sh && \
    # echo '  echo "⚠️  ANTHROPIC_API_KEY not set - Claude Code CLI available but not configured"' >> /entrypoint.sh && \
    # echo '  echo "💡 To configure: Set ANTHROPIC_API_KEY environment variable and restart container"' >> /entrypoint.sh && \
    # echo 'fi' >> /entrypoint.sh && \
    # echo '' >> /entrypoint.sh && \
    # echo '# Display current Claude configuration' >> /entrypoint.sh && \
    # echo 'if [ -f "$CLAUDE_CONFIG_DIR/.env" ]; then' >> /entrypoint.sh && \
    # echo '  echo "📋 Claude .env configuration ($CLAUDE_CONFIG_DIR/.env):"' >> /entrypoint.sh && \
    # echo '  cat "$CLAUDE_CONFIG_DIR/.env" | grep -v "^#" | grep -v "^$" || echo "  (no active configuration)"' >> /entrypoint.sh && \
    # echo 'else' >> /entrypoint.sh && \
    # echo '  echo "📋 No Claude configuration found"' >> /entrypoint.sh && \
    # echo 'fi' >> /entrypoint.sh && \
    # echo '' >> /entrypoint.sh && \
    echo 'export HOME="/home"' >> /entrypoint.sh && \
    echo 'node dist/index.js &' >> /entrypoint.sh && \
    echo 'AGENT_PID=$!' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    # echo '# Start a screen session with Claude Code available' >> /entrypoint.sh && \
    # echo 'screen -dmS claude-session bash -c "export HOME=/home/shared/agents/${AGENT_ID}; export CLAUDE_CONFIG_DIR=/home/shared/agents/${AGENT_ID}/.claude; cd /home; exec bash"' >> /entrypoint.sh && \
    # echo 'echo "📺 Screen session claude-session created for interactive Claude Code CLI"' >> /entrypoint.sh && \
    echo 'exec tail -f /dev/null' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /tmp /run /home/agent/workspace /home/workspace/repo /shared/agents && \
    chown -R agent:agent /app /tmp /run /entrypoint.sh /home/agent /home/workspace /shared /home/.claude /home/CLAUDE.md

# Switch to non-root user
USER agent

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run entrypoint script
ENTRYPOINT ["/entrypoint.sh"]