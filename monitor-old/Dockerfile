# Multi-stage build for TypeScript
FROM node:18-alpine AS builder

# Install Docker CLI to monitor containers
RUN apk add --no-cache docker-cli

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
FROM node:18-alpine

# Install Docker CLI and curl to monitor containers
RUN apk add --no-cache docker-cli curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Copy static files
COPY public/ ./public/

# Create directories with proper permissions
RUN mkdir -p /tmp /run && \
    chmod 755 /app

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

# Start the server
CMD ["node", "dist/server.js"]