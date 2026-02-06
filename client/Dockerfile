FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Override at runtime (e.g. docker-compose sets API_PROXY_TARGET=http://backend:4200).
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

COPY package*.json package-lock.json* ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY next.config.* ./

EXPOSE 3000

CMD ["npm", "run", "start"]
