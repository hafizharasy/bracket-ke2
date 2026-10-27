// Bye: ruangan dengan kurang dari 64 peserta punya laga babak 1 berisi satu
// peserta saja. Laga itu langsung "selesai" dan pesertanya lolos ke babak 2,
// tetapi tidak dihitung sebagai pertandingan yang sudah dimainkan.

import { and, eq, isNotNull, isNull, ne, or, type SQL } from "drizzle-orm";

import type { Db } from "@/db";
import { matches } from "@/db/schema";
import { advanceWinner } from "@/server/propagation";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** SQL: bukan laga bye (bye = babak 1, selesai, tepat satu peserta). */
export const notBye = or(
  ne(matches.round, 1),
  ne(matches.status, "done"),
  and(isNull(matches.participantAId), isNull(matches.participantBId)),
  and(isNotNull(matches.participantAId), isNotNull(matches.participantBId)),
)!;

/** SQL: laga yang benar-benar sudah dimulai/dimainkan (bye tidak dihitung). */
export const playedMatch = and(ne(matches.status, "scheduled"), notBye)!;

/**
 * Terapkan bye di babak 1: laga terjadwal yang hanya berisi satu peserta
 * ditandai selesai dan pesertanya dimajukan ke babak 2. Dipakai setelah
 * "Hapus semua hasil" dan setelah susunan pasangan disimpan.
 */
export function applyByes(tx: Tx, scope?: SQL) {
  const single = and(
    eq(matches.round, 1),
    eq(matches.status, "scheduled"),
    or(and(isNull(matches.participantAId), isNotNull(matches.participantBId)), and(isNotNull(matches.participantAId), isNull(matches.participantBId))),
    scope,
  );
  const rows = tx.select().from(matches).where(single).all();
  for (const m of rows) {
    const updated = tx
      .update(matches)
      .set({ status: "done", winnerId: m.participantAId ?? m.participantBId, scoreA: null, scoreB: null, winType: null })
      .where(eq(matches.id, m.id))
      .returning()
      .get();
    advanceWinner(tx, updated, null);
  }
  return rows.length;
}
