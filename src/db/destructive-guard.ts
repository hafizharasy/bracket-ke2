// Pengaman perintah shell yang menghapus data turnamen (seed --reset,
// import-peserta --replace). Di production perintah ditolak bila database
// sudah berisi data, kecuali diberi konfirmasi `--yakin`; sebelum menghapus,
// salinan database disimpan di folder `cadangan/` di samping database.

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { backupDatabase } from "@/db/backup";
import { matches, participants, rooms, sessions } from "@/db/schema";

export const CONFIRM_FLAG = "--yakin";

const countOf = (table: typeof sessions | typeof rooms | typeof participants | typeof matches) =>
  db.select({ n: sql<number>`count(*)` }).from(table).get()!.n;

/** Ringkasan isi database saat ini, mis. "4 sesi, 3 ruangan, 640 peserta, 655 laga". */
export function describeData() {
  return `${countOf(sessions)} sesi, ${countOf(rooms)} ruangan, ${countOf(participants)} peserta, ${countOf(matches)} laga`;
}

/**
 * Hentikan proses bila perintah perusak dijalankan di production tanpa
 * `--yakin` padahal data sudah ada. Bila lanjut, buat cadangan dulu dan
 * kembalikan lokasinya (null bila tidak perlu).
 */
export function guardDestructive(command: string, args = process.argv.slice(2)): string | null {
  const hasData = countOf(sessions) + countOf(rooms) + countOf(participants) + countOf(matches) > 0;
  if (!hasData || process.env.NODE_ENV !== "production") return null;

  if (!args.includes(CONFIRM_FLAG)) {
    console.error(
      [
        `✗ Dibatalkan: perintah ini MENGHAPUS data turnamen di production.`,
        `  Isi database sekarang: ${describeData()}.`,
        `  Akun admin & pengawas tidak ikut terhapus, tetapi sesi, ruangan, peserta, bagan, hasil,`,
        `  dan pelanggaran akan hilang. Bila memang ingin, ulangi dengan tambahan ${CONFIRM_FLAG}:`,
        `    ${command} ${CONFIRM_FLAG}`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const backup = backupDatabase();
  console.log(`✓ Cadangan database disimpan di ${backup}`);
  return backup;
}
