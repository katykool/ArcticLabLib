# syntax=docker/dockerfile:1

# --- Этап 1: установка зависимостей ---
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- Этап 2: сборка проекта ---
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js на этапе сборки не обращается к базе данных,
# поэтому реальный MONGODB_URI не нужен — достаточно заглушки.
ENV MONGODB_URI="mongodb://placeholder:27017/library"
RUN npm run build

# --- Этап 3: финальный лёгкий образ для запуска ---
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# curl нужен для ручной диагностики через Dokploy Terminal
# и на случай, если задачи Schedule выполняются внутри этого контейнера.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Непривилегированный пользователь для запуска приложения
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone-сборка Next.js уже содержит только нужные файлы и минимальный node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
