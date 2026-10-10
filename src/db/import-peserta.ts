// Impor peserta dari CSV ke database:
//   npm run db:import-peserta -- peserta.csv            → tambahkan peserta
//   npm run db:import-peserta -- peserta.csv --dry-run  → periksa saja
//   npm run db:import-peserta -- peserta.csv --replace  → kosongkan peserta & bagan dulu
// Format: lihat data-templates/peserta.csv (kolom nama, sekolah, sesi, ruangan).

import { readFileSync } from "node:fs";

import { asc } from "drizzle-orm";

import { DATABASE_PATH, db } from "@/db";
import { matches, matchResultHistory, matchResults, participants, rooms, sessions, violations } from "@/db/schema";
import { bumpBracketVersion } from "@/server/live";
import { nextParticipantIds, parseParticipantCsv } from "@/server/participant-import";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Pemakaian: npm run db:import-peserta -- <berkas.csv> [--dry-run] [--replace]");
  process.exit(1);
}

const sessionRows = db.select().from(sessions).orderBy(asc(sessions.orderIndex)).all().map((s) => ({ ...s, startTime: null }));
const roomRows = db.select().from(rooms).all();
const { rows, errors } = parseParticipantCsv(readFileSync(file, "utf8"), sessionRows, roomRows);

for (const e of errors) console.log(`  ! baris ${e.line}: ${e.message}`);
console.log(`${rows.length} peserta valid, ${errors.length} baris bermasalah.`);
if (errors.length > 0 || args.includes("--dry-run")) {
  process.exit(errors.length > 0 ? 1 : 0);
}

db.transaction((tx) => {
  if (args.includes("--replace")) {
    // Bagan bergantung pada peserta → ikut dikosongkan (susun ulang lewat admin).
    for (const table of [violations, matchResultHistory, matchResults, matches, participants]) tx.delete(table).run();
  }
  const existing = tx.select({ id: participants.id }).from(participants).all().map((p) => p.id);
  const ids = nextParticipantIds(existing, rows.length);
  for (let i = 0; i < rows.length; i += 50) {
    tx.insert(participants)
      .values(rows.slice(i, i + 50).map((r, j) => ({ id: ids[i + j], ...r.values })))
      .run();
  }
  bumpBracketVersion(tx);
});
console.log(`✓ ${rows.length} peserta diimpor ke ${DATABASE_PATH}${args.includes("--replace") ? " (mengganti data lama)" : ""}.`);
