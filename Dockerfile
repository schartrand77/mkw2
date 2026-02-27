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
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma occasionally returns 500 when serving checksum files; skip the missing check so builds keep working.
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
# Ensure OpenSSL available for Prisma during build
RUN apt-get update -y && apt-get install -y openssl postgresql-client && rm -rf /var/lib/apt/lists/* \
  && npx prisma generate && npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /bin/bash nextjs
RUN apt-get update -y && apt-get install -y openssl postgresql-client && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json
COPY prisma ./prisma
COPY scripts ./scripts
# Storage + backups directories; can be mounted by docker-compose/unraid
RUN mkdir -p /app/storage /app/backups && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/restore.js && npx prisma migrate deploy && node scripts/bootstrap-admin.js && npm run start"]
