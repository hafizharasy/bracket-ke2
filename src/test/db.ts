import { sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Kosongkan tabel users untuk tes. Trigger "admin aktif terakhir" dilewati
 * hanya selama pembersihan ini (tabel TEMP allow_admin_purge, per koneksi).
 */
export function clearUsers() {
  db.run(sql`create temp table if not exists allow_admin_purge (x)`);
  try {
    db.delete(users).run();
  } finally {
    db.run(sql`drop table if exists temp.allow_admin_purge`);
  }
}
