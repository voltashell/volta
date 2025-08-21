# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Copy application code
COPY ./public ./public
COPY ./src ./src
COPY ./eslint.config.mjs ./eslint.config.mjs
COPY ./next.config.ts ./next.config.ts
COPY ./postcss.config.mjs ./postcss.config.mjs
COPY ./tailwind.config.js ./tailwind.config.js
COPY ./tsconfig.json ./tsconfig.json

# Build Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3100

ENV PORT 3100
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]