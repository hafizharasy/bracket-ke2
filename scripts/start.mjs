// Start produksi: periksa konfigurasi, terapkan migrasi database, lalu
// jalankan `next start`. Dipakai Dockerfile (Railway).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const databasePath = process.env.DATABASE_PATH ?? "data/bracket.db";
const uploadDir = process.env.UPLOAD_DIR ?? "data/uploads";

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
  console.error("✗ BETTER_AUTH_SECRET belum diatur. Isi dengan kunci acak panjang (mis. `openssl rand -hex 32`).");
  process.exit(1);
}

mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(uploadDir, { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
migrate(drizzle(sqlite), { migrationsFolder: "drizzle" });
sqlite.close();
console.log(`✓ Migrasi diterapkan ke ${databasePath}`);

const port = process.env.PORT ?? "3000";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
});
// Teruskan sinyal (redeploy/stop) supaya server berhenti dengan rapi.
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
