FROM oven/bun:1

# LibreOffice headless : moteur de conversion ponctuel pour la déclaration statistique MINESEC
# (backend/src/application/statisticalCampaign/xlsEngine.ts). --no-install-recommends évite
# ~500 Mo de paquets inutiles (aides, traductions) ; libreoffice-calc suffit, pas la suite complète.
# postgresql-client : fournit pg_dump, utilisé par le job d'export offsite nocturne (Couche 3,
# PLAN_IMPLEMENTATION_BACKUP.md — backend/src/inngest/backupOffsiteJob.ts).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    fonts-liberation \
    ca-certificates \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .
RUN test -f /app/assets/fonts/LiberationSans-Regular.ttf \
    && test -f /app/assets/fonts/LiberationSans-Bold.ttf \
    && test -f /app/assets/fonts/LiberationSans-Italic.ttf

ENV NODE_ENV=production
EXPOSE 5000

CMD ["bun", "run", "src/server.ts"]
