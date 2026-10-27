import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "@/db/schema";

/** Lokasi berkas SQLite; bisa diarahkan ke volume lewat env DATABASE_PATH. */
export const DATABASE_PATH = process.env.DATABASE_PATH ?? "data/bracket.db";

/**
 * Aktifkan WAL (baca penonton tidak terblokir saat pengawas menulis). Saat build,
 * beberapa worker membuka berkas yang sama bersamaan; peralihan ke WAL bisa
 * langsung SQLITE_BUSY tanpa menunggu busy_timeout, jadi dicoba ulang sebentar.
 */
function enableWal(sqlite: Database.Database) {
  for (let attempt = 0; ; attempt++) {
    try {
      sqlite.pragma("journal_mode = WAL");
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== "SQLITE_BUSY" || attempt >= 50) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

function createClient() {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const sqlite = new Database(DATABASE_PATH);
  enableWal(sqlite);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// Satu koneksi per proses; disimpan di globalThis agar tidak berlipat saat HMR di dev.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createClient> };
export const db = globalForDb.db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type Db = typeof db;
