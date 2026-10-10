import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { sql } from "drizzle-orm";

import { DATABASE_PATH, db } from "@/db";

/**
 * Salin database ke `cadangan/bracket-<label>-<tanggal>-<jam>.db` di samping
 * berkas database (VACUUM INTO: salinan utuh & konsisten). Mengembalikan lokasinya,
 * atau null untuk database di memori (tes).
 */
export function backupDatabase(label = ""): string | null {
  if (DATABASE_PATH === ":memory:") return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const dir = join(dirname(DATABASE_PATH), "cadangan");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `bracket-${label ? `${label}-` : ""}${stamp}.db`);
  db.run(sql.raw(`VACUUM INTO '${file.replace(/'/g, "''")}'`));
  return file;
}
