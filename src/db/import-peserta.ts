// Impor peserta dari CSV ke database:
//   npm run db:import-peserta -- peserta.csv            → tambahkan peserta
//   npm run db:import-peserta -- peserta.csv --dry-run  → periksa saja
//   npm run db:import-peserta -- peserta.csv --replace  → kosongkan peserta & bagan dulu
//                                                         (di production wajib --yakin; dicadangkan dulu)
// Format: lihat data-templates/peserta.csv (kolom nama, sekolah, sesi, ruangan).
// Sama dengan tombol "Unggah CSV" di /admin/peserta.

import { readFileSync } from "node:fs";

import { DATABASE_PATH } from "@/db";
import { CONFIRM_FLAG, guardDestructive } from "@/db/destructive-guard";
import { importParticipantsCsv } from "@/server/participant-import";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Pemakaian: npm run db:import-peserta -- <berkas.csv> [--dry-run] [--replace]");
  process.exit(1);
}

const replace = args.includes("--replace");
const dryRun = args.includes("--dry-run");
if (replace && !dryRun) guardDestructive(`npm run db:import-peserta -- ${args.filter((a) => a !== CONFIRM_FLAG).join(" ")}`);
const result = importParticipantsCsv(readFileSync(file, "utf8"), { replace, dryRun });

for (const e of result.errors) console.log(`  ! ${e.line ? `baris ${e.line}: ` : ""}${e.message}`);
console.log(`${result.summary.valid} peserta valid, ${result.errors.length} masalah.`);
if (!result.saved) process.exit(result.errors.length > 0 ? 1 : 0);
console.log(`✓ ${result.summary.valid} peserta diimpor ke ${DATABASE_PATH}${replace ? " (mengganti data lama)" : ""}.`);
