// Buat struktur bagan dari peserta yang sudah ditempatkan (sesi & ruangan).
//   npm run db:buat-bagan                       → cek lalu simpan
//   npm run db:buat-bagan -- --cek              → cek saja, tidak menyimpan
//   npm run db:buat-bagan -- --final 2026-10-17T18:00:00+07:00
//   npm run db:buat-bagan -- --ganti            → susun ulang (selama belum ada hasil)

import { parseArgs } from "node:util";

import { DATABASE_PATH } from "@/db";
import { generateBracketStructure } from "@/server/bracket-structure";
import { ApiError } from "@/server/errors";

const { values } = parseArgs({
  options: { cek: { type: "boolean" }, ganti: { type: "boolean" }, final: { type: "string" } },
});

try {
  const result = generateBracketStructure({ dryRun: values.cek, replace: values.ganti, finalStart: values.final });
  const final = new Date(result.finalStart).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  console.log(
    `${result.saved ? "✓ Struktur bagan disimpan" : "✓ Siap dibuat (cek saja)"} di ${DATABASE_PATH}: ` +
      `${result.roomMatches} laga ruangan + ${result.finalMatches} laga final ` +
      `(${result.byes} juara bye, ${result.playoffMatches} laga play-off), final mulai ${final} WIB` +
      (result.replaced ? `; menggantikan ${result.replaced} laga lama` : ""),
  );
} catch (error) {
  if (!(error instanceof ApiError)) throw error;
  console.error(`✗ ${error.message}`);
  const problems = (error.details?.errors as string[] | undefined) ?? [];
  for (const line of problems.slice(0, 15)) console.error(`  - ${line}`);
  if (problems.length > 15) console.error(`  … dan ${problems.length - 15} masalah lainnya`);
  process.exit(1);
}
