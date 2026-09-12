# ============================================================
# Nahú Cocinas — Production Dockerfile (hardened)
# Multi-stage build: Bun (build) → Node.js slim (runtime)
# ============================================================

# ---- Base stage ----
FROM oven/bun:1 AS base
WORKDIR /app

# ---- Dependencies stage ----
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile

# ---- Build stage ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for Linux target
RUN bunx prisma generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build

# ---- Production stage ----
FROM node:20-slim AS runner

# Install only what's needed: tini for signal handling + OpenSSL for Prisma
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      tini \
      openssl \
      curl && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Create non-root user
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid appuser --shell /bin/sh --create-home appuser

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma client and SQLite database
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy prisma schema (needed at runtime for DB push if needed)
COPY --from=builder /app/prisma ./prisma

# Create directories for persistent data
RUN mkdir -p db upload && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 4200
ENV PORT=4200
ENV HOSTNAME="0.0.0.0"

# Health check built into the image
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4200/ || exit 1

# Use tini as PID 1 for proper signal handling (SIGTERM, SIGINT)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
