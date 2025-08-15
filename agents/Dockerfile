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

# Install bash and dependencies for shell access and Gemini CLI
RUN apk add --no-cache bash curl git npm

# Install Gemini CLI globally
RUN npm install -g @google/gemini-cli

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

# Create .gemini template (will be copied to shared volume at runtime)

# Create entrypoint script that runs agent in background and keeps container alive
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'echo "🤖 Starting AI Agent with Shell Support..."' >> /entrypoint.sh && \
    echo 'echo "Agent ID: ${AGENT_ID}"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Configure Gemini CLI with persistent .gemini/.env file in shared storage' >> /entrypoint.sh && \
    echo 'GEMINI_CONFIG_DIR="/shared/agents/${AGENT_ID}/.gemini"' >> /entrypoint.sh && \
    echo 'mkdir -p "$GEMINI_CONFIG_DIR"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Create home .gemini directory for CLI telemetry (now writable via tmpfs)' >> /entrypoint.sh && \
    echo 'mkdir -p /home/agent/.gemini' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo 'if [ -n "$GEMINI_API_KEY" ]; then' >> /entrypoint.sh && \
    echo '  echo "🔧 Configuring Gemini CLI with persistent .gemini/.env..."' >> /entrypoint.sh && \
    echo '  ' >> /entrypoint.sh && \
    echo '  # Create .gemini/.env in shared storage' >> /entrypoint.sh && \
    echo '  cat > "$GEMINI_CONFIG_DIR/.env" << EOF' >> /entrypoint.sh && \
    echo '# Gemini CLI Configuration for ${AGENT_ID}' >> /entrypoint.sh && \
    echo '# This file provides persistent configuration for Gemini CLI' >> /entrypoint.sh && \
    echo '# Environment variables are loaded automatically by gemini-cli' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo 'GEMINI_API_KEY=$GEMINI_API_KEY' >> /entrypoint.sh && \
    echo 'GEMINI_MODEL=${GEMINI_MODEL:-gemini-1.5-flash}' >> /entrypoint.sh && \
    echo 'EOF' >> /entrypoint.sh && \
    echo '  ' >> /entrypoint.sh && \
    echo '  # Set environment variables for gemini-cli to find configuration' >> /entrypoint.sh && \
    echo '  export GEMINI_CONFIG_DIR="$GEMINI_CONFIG_DIR"' >> /entrypoint.sh && \
    echo '  export HOME="/shared/agents/${AGENT_ID}"' >> /entrypoint.sh && \
    echo '  ' >> /entrypoint.sh && \
    echo '  # Verify gemini can load configuration' >> /entrypoint.sh && \
    echo '  if gemini models list >/dev/null 2>&1; then' >> /entrypoint.sh && \
    echo '    echo "✅ Gemini CLI configured successfully with model: ${GEMINI_MODEL:-gemini-1.5-flash}"' >> /entrypoint.sh && \
    echo '    echo "📄 Configuration saved to $GEMINI_CONFIG_DIR/.env"' >> /entrypoint.sh && \
    echo '  else' >> /entrypoint.sh && \
    echo '    echo "⚠️  Gemini CLI configuration may have issues - check API key"' >> /entrypoint.sh && \
    echo '  fi' >> /entrypoint.sh && \
    echo 'else' >> /entrypoint.sh && \
    echo '  echo "⚠️  GEMINI_API_KEY not set - Gemini CLI available but not configured"' >> /entrypoint.sh && \
    echo '  echo "💡 To configure: Set GEMINI_API_KEY environment variable and restart container"' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Display current Gemini configuration' >> /entrypoint.sh && \
    echo 'if [ -f "$GEMINI_CONFIG_DIR/.env" ]; then' >> /entrypoint.sh && \
    echo '  echo "📋 Gemini .env configuration ($GEMINI_CONFIG_DIR/.env):"' >> /entrypoint.sh && \
    echo '  cat "$GEMINI_CONFIG_DIR/.env" | grep -v "^#" | grep -v "^$" || echo "  (no active configuration)"' >> /entrypoint.sh && \
    echo 'else' >> /entrypoint.sh && \
    echo '  echo "📋 No Gemini configuration found"' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Export HOME environment for shell sessions to find Gemini config' >> /entrypoint.sh && \
    echo 'export HOME="/shared/agents/${AGENT_ID}"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Start the agent process in background' >> /entrypoint.sh && \
    echo 'node dist/index.js &' >> /entrypoint.sh && \
    echo 'AGENT_PID=$!' >> /entrypoint.sh && \
    echo 'echo "🚀 Agent started with PID: $AGENT_PID"' >> /entrypoint.sh && \
    echo 'echo "🖥️  Shell access: docker exec -it $HOSTNAME /bin/bash"' >> /entrypoint.sh && \
    echo 'echo "🔮 Gemini CLI: gemini chat, gemini models list, gemini --help"' >> /entrypoint.sh && \
    echo 'echo "📁 Shared storage: /shared/agents/${AGENT_ID}/"' >> /entrypoint.sh && \
    echo 'echo "⚙️  Gemini config: $GEMINI_CONFIG_DIR/.env"' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Wait for agent process' >> /entrypoint.sh && \
    echo 'wait $AGENT_PID' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /shared /tmp /run && \
    chown -R agent:agent /app /tmp /run /entrypoint.sh

# Switch to non-root user
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run entrypoint script
CMD ["/entrypoint.sh"]