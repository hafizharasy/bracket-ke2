# Image produksi Bracket LRP 2026 (dipakai Railway; juga bisa di server Docker lain).
# Data (SQLite + foto bukti) disimpan di /app/data — pasang volume persisten di sana.

# --- Tahap build: perlu python3/make/g++ untuk mengompilasi better-sqlite3 ---
FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependensi lengkap (termasuk tsx & drizzle-kit) supaya skrip db:* bisa
# dijalankan dari shell server, mis. `npm run db:create-admin`.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Tahap jalan: tanpa compiler, hanya hasil build + node_modules ---
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_PATH=/app/data/bracket.db \
    UPLOAD_DIR=/app/data/uploads
COPY --from=build /app /app

EXPOSE 3000
# Migrasi database dulu, lalu jalankan server (lihat scripts/start.mjs).
CMD ["node", "scripts/start.mjs"]
