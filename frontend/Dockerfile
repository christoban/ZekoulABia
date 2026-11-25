# syntax=docker/dockerfile:1.4

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
# BACKEND_URL est lu par next.config.ts (rewrites) au build : les rewrites sont
# figés dans routes-manifest.json, un ARG/ENV au runtime ne servirait à rien.
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Docker définit HOSTNAME = id du conteneur ; sans cet override le server.js
# généré par output:"standalone" tente de bind sur ce nom et le serveur ne répond pas.
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
USER bun
CMD ["bun", "server.js"]
