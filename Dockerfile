# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------------
# Stage 1: deps — install all (dev + prod) dependencies once.
# ------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy prisma schema first so the postinstall hook (prisma generate)
# can find it. The actual client binary is regenerated in the builder stage.
COPY prisma ./prisma
# Copy lockfiles first for maximum cache reuse.
COPY package.json package-lock.json* ./
RUN npm ci

# ------------------------------------------------------------------
# Stage 2: builder — copy source, generate Prisma client, build.
# ------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Reuse node_modules from deps.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generates the client into node_modules/@prisma/client — the
# standalone build expects this directory to be present at runtime.
RUN npx prisma generate

# Build the Next.js app in standalone mode (requires `output: 'standalone'`
# in next.config.js).
RUN npm run build

# ------------------------------------------------------------------
# Stage 3: runner — minimal image that runs `node server.js`.
# ------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Git SHA of this build, reported by /api/health so a deploy can confirm the
# new container is the one answering. CI passes --build-arg APP_VERSION=<sha>.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone needs openssl at runtime (NextAuth/Prisma) and
# dumb-init so SIGTERM propagates to the node process.
RUN apk add --no-cache openssl dumb-init && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nextjs

# Copy the standalone output (contains the minimal node_modules + server.js).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy the static assets that Next.js does not bundle into standalone.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public/ so user assets remain accessible.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma schema + migrations, the generated client and the engines.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI at the lockfile's version, so migrations run from this exact
# image before the app container is swapped:
#   node node_modules/prisma/build/index.js migrate deploy
# The standalone build does not include it (the app never imports it), and
# `npx prisma` would download the latest major instead.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000

# dumb-init ensures SIGTERM from `docker compose down` reaches the
# node process so it can drain connections cleanly.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]