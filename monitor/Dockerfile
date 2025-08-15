# Multi-stage build for Next.js with custom server
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat docker
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Build Next.js app and TypeScript server
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build
# Compile TypeScript server
RUN npx tsc server.ts --outDir dist --esModuleInterop --moduleResolution node --target es2020

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install Docker CLI for container management
RUN apk add --no-cache docker

COPY --from=builder /app/public ./public

RUN mkdir .next

# Copy the built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.ts ./server.ts

# Run as root to access Docker socket (set by docker-compose)
USER root

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "dist/server.js"]