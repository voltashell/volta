# Build stage
FROM node:20-bookworm AS builder

WORKDIR /app

# Build prerequisites for native modules (node-pty)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app and compile TypeScript server
RUN npm run build

# Remove devDependencies from node_modules for slimmer prod copy
RUN npm prune --omit=dev

# Production stage
FROM node:20-bookworm

# Install Docker CLI and build tools for native modules
RUN apt-get update \
  && apt-get install -y --no-install-recommends docker.io python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install production dependencies and rebuild native modules for this platform
RUN npm ci --omit=dev

# Copy built Next.js application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist

# Note: We're NOT copying node_modules from builder to avoid architecture issues
# Instead, we installed fresh production dependencies above

# Create non-root user but don't switch to it yet (Debian commands)
RUN set -eux; \
    getent group nodejs || groupadd -g 1001 nodejs; \
    id -u nextjs >/dev/null 2>&1 || useradd -u 1001 -g nodejs -M -s /usr/sbin/nologin nextjs

# Set ownership
RUN chown -R nextjs:nodejs /app

# Note: We'll run as root to access Docker socket
# In production, you'd want to properly configure Docker socket permissions
# USER nextjs - commented out to allow Docker socket access

EXPOSE 3000

# Health check
# HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
#   CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "dist/server.js"]
