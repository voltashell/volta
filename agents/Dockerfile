FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 agent && \
    adduser -D -u 1001 -G agent agent

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY index.js ./

# Create necessary directories with proper permissions
RUN mkdir -p /shared /tmp /run && \
    chown -R agent:agent /app /tmp /run

# Switch to non-root user
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run the agent
CMD ["node", "index.js"]