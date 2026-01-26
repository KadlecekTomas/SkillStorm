FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4200

# potřebné pro entrypoint (nc)
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x /app/entrypoint.sh

EXPOSE 4200

ENTRYPOINT ["/app/entrypoint.sh"]
