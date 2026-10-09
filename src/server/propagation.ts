import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { matches } from "@/db/schema";
import { buildAdvanceMap } from "@/lib/bracket";
import { ApiError } from "@/server/errors";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Match = typeof matches.$inferSelect;
type Side = "A" | "B";

const slotColumn = (side: Side) => (side === "A" ? "participantAId" : "participantBId");

/** Slot (A/B) di laga berikutnya yang menjadi milik pemenang `match`. */
export function advanceSide(tx: Tx, match: Pick<Match, "id" | "nextMatchId">): Side {
  if (!match.nextMatchId) throw new Error("Laga ini tidak punya laga berikutnya.");
  const feeders = tx.select().from(matches).where(eq(matches.nextMatchId, match.nextMatchId)).all();
  return buildAdvanceMap(feeders).get(match.id)?.side ?? "B";
}

/**
 * Majukan pemenang `match` ke slotnya di laga berikutnya. Dipanggil setiap
 * hasil laga disimpan/dikoreksi (dalam transaksi yang sama).
 *
 * - Laga tanpa `nextMatchId` (final) → tidak ada yang dimajukan.
 * - Koreksi pemenang hanya boleh selama laga berikutnya masih terjadwal,
 *   karena setelah dimulai hasilnya sudah bergantung pada peserta lama.
 * - Mengembalikan laga berikutnya setelah diperbarui (atau null).
 */
export function advanceWinner(tx: Tx, match: Match, previousWinnerId: string | null) {
  if (!match.nextMatchId || !match.winnerId) return null;
  const next = tx.select().from(matches).where(eq(matches.id, match.nextMatchId)).get();
  if (!next) return null;

  const side = advanceSide(tx, match);
  const slot = slotColumn(side);
  const current = next[slot];
  if (current === match.winnerId) return next; // sudah di tempatnya

  const winnerChanged = previousWinnerId !== null && previousWinnerId !== match.winnerId;
  if (next.status !== "scheduled" && (winnerChanged || current !== null)) {
    throw new ApiError(409, "Laga berikutnya sudah dimulai; pemenang tidak bisa diubah lagi.");
  }
  // Slot terisi peserta lain yang bukan pemenang lama laga ini → data tidak konsisten.
  if (current !== null && current !== previousWinnerId) {
    throw new ApiError(409, "Slot di laga berikutnya sudah terisi peserta lain.");
  }
  const otherSlot = slotColumn(side === "A" ? "B" : "A");
  if (next[otherSlot] === match.winnerId) {
    throw new ApiError(409, "Peserta ini sudah ada di laga berikutnya.");
  }

  return tx
    .update(matches)
    .set({ [slot]: match.winnerId })
    .where(eq(matches.id, next.id))
    .returning()
    .get();
}

export type RepropagateReport = { filled: number; unchanged: number; conflicts: string[] };

/**
 * Hitung ulang seluruh slot hasil propagasi dari laga yang sudah selesai,
 * urut babak. Untuk perbaikan data (mis. setelah impor/ubah manual):
 * slot kosong diisi, slot yang berisi peserta lain dilaporkan sebagai
 * konflik dan tidak ditimpa.
 */
export function repropagateAll(tx: Tx): RepropagateReport {
  const all = tx.select().from(matches).all();
  const byId = new Map(all.map((m) => [m.id, m]));
  const advance = buildAdvanceMap(all);
  const report: RepropagateReport = { filled: 0, unchanged: 0, conflicts: [] };

  const done = all
    .filter((m) => m.status === "done" && m.winnerId && m.nextMatchId)
    .sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);

  for (const match of done) {
    const target = advance.get(match.id);
    const next = target && byId.get(target.matchId);
    if (!target || !next) continue;
    const slot = slotColumn(target.side);
    if (next[slot] === match.winnerId) {
      report.unchanged++;
    } else if (next[slot] === null) {
      next[slot] = match.winnerId;
      tx.update(matches).set({ [slot]: match.winnerId }).where(eq(matches.id, next.id)).run();
      report.filled++;
    } else {
      report.conflicts.push(
        `${next.id} slot ${target.side}: berisi ${next[slot]}, seharusnya ${match.winnerId} (dari ${match.id})`,
      );
    }
  }
  return report;
}
