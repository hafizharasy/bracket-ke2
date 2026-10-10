// Impor peserta dari CSV ke database:
//   npm run db:import-peserta -- peserta.csv            → tambahkan peserta
//   npm run db:import-peserta -- peserta.csv --dry-run  → periksa saja
//   npm run db:import-peserta -- peserta.csv --replace  → kosongkan peserta & bagan dulu
// Format: lihat data-templates/peserta.csv (kolom nama, sekolah, sesi, ruangan).
// Sama dengan tombol "Unggah CSV" di /admin/peserta.

import { readFileSync } from "node:fs";

import { DATABASE_PATH } from "@/db";
import { importParticipantsCsv } from "@/server/participant-import";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Pemakaian: npm run db:import-peserta -- <berkas.csv> [--dry-run] [--replace]");
  process.exit(1);
}

const replace = args.includes("--replace");
const result = importParticipantsCsv(readFileSync(file, "utf8"), { replace, dryRun: args.includes("--dry-run") });

for (const e of result.errors) console.log(`  ! ${e.line ? `baris ${e.line}: ` : ""}${e.message}`);
console.log(`${result.summary.valid} peserta valid, ${result.errors.length} masalah.`);
if (!result.saved) process.exit(result.errors.length > 0 ? 1 : 0);
console.log(`✓ ${result.summary.valid} peserta diimpor ke ${DATABASE_PATH}${replace ? " (mengganti data lama)" : ""}.`);
