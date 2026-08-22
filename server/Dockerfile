FROM node:24.19.0-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM node:24.19.0-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm ci
RUN npx prisma generate

FROM node:24.19.0-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Stage for running full-walkthrough seed (needs ts-node + source)
FROM deps AS seed-runner
WORKDIR /app
COPY --chown=node:node . .
RUN npx prisma generate
USER node
# Default: run full seed (override in compose if needed)
CMD ["npx", "ts-node", "prisma/seed/full-walkthrough-seed.ts"]

FROM node:24.19.0-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4200

# potřebné pro entrypoint (nc) + openssl pro Prisma engine detekci
RUN apt-get update && apt-get install -y --no-install-recommends netcat-openbsd openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
# Runtime assets — definice kampaní leží mimo src/, takže je nest build
# nekopíruje do dist/. CampaignContentService je čte při startu z
# process.cwd()/content/campaigns (WORKDIR /app) a bez nich fail-fast spadne.
COPY --chown=node:node content ./content
COPY --chown=node:node entrypoint.sh ./entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER node
EXPOSE 4200

ENTRYPOINT ["/app/entrypoint.sh"]
