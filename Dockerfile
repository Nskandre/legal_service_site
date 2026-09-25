FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:timeweb

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps /app/node_modules/nodemailer ./node_modules/nodemailer
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
EXPOSE 8080
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
