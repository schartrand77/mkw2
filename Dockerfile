# Multi-stage build for Next.js
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Ensure OpenSSL available for Prisma during build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* \
  && npx prisma generate && npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /bin/bash nextjs
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib
COPY package.json ./package.json
COPY prisma ./prisma
COPY scripts ./scripts
# Storage directory; will be mounted by docker-compose
RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/restore.js && npx prisma migrate deploy && node scripts/bootstrap-admin.js && npm run start"]
