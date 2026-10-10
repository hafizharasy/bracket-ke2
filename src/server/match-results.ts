import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, matchResultHistory, matchResults, WIN_TYPE_VALUES } from "@/db/schema";
import { FINAL_ROUND, SEMIFINAL_ROUND, SEMIFINAL_WINS } from "@/lib/bracket";
import { authorize, type SessionUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { isProofUrlForMatch } from "@/server/storage";
import { bumpBracketVersion } from "@/server/live";
import { advanceToFeeds, advanceWinner, retractFromFeeds, retractWinner } from "@/server/propagation";

export const matchResultInput = z.object({
  /** Babak ruangan: skor; semifinal: jumlah game dimenangkan (best of 3). Final: tidak dipakai. */
  scoreA: z.int().min(0).max(999).nullish(),
  scoreB: z.int().min(0).max(999).nullish(),
  /** Wajib bila skor seri dan di final; selain itu harus cocok dengan skor. */
  winnerId: z.string().min(1).optional(),
  /** Final round-robin: jenis kemenangan (menentukan poin). */
  winType: z.enum(WIN_TYPE_VALUES).optional(),
  /** URL foto bukti dari POST /api/matches/:id/proof untuk laga yang sama. */
  proofPhotoUrl: z.string().trim().min(1).max(2048),
});
export type MatchResultInput = z.infer<typeof matchResultInput>;

/**
 * Validasi hasil sesuai babak:
 * - Babak ruangan: skor bebas; pemenang dari skor (atau winnerId bila seri).
 * - Semifinal (best of 3): skor = game dimenangkan; pemenang tepat 2 game,
 *   lawan 0 atau 1.
 * - Final round-robin: pemenang + jenis kemenangan (poin); tanpa skor.
 */
export function resolveResult(round: number, a: string, b: string, input: MatchResultInput) {
  if (round === FINAL_ROUND) {
    if (!input.winnerId || !input.winType) throw new ApiError(422, "Final: pilih pemenang dan jenis kemenangannya.");
    if (input.winnerId !== a && input.winnerId !== b) throw new ApiError(422, "Pemenang harus salah satu peserta laga ini.");
    return { winnerId: input.winnerId, scoreA: null, scoreB: null, winType: input.winType };
  }
  const scoreA = input.scoreA;
  const scoreB = input.scoreB;
  if (scoreA == null || scoreB == null) throw new ApiError(422, "Skor kedua peserta wajib diisi.");
  if (round === SEMIFINAL_ROUND) {
    const valid = Math.max(scoreA, scoreB) === SEMIFINAL_WINS && Math.min(scoreA, scoreB) < SEMIFINAL_WINS;
    if (!valid) throw new ApiError(422, "Semifinal best of 3: pemenang 2 game, lawan 0 atau 1 (mis. 2-0 atau 2-1).");
  }
  const scoreWinner = scoreA > scoreB ? a : scoreB > scoreA ? b : null;
  const winnerId = input.winnerId ?? scoreWinner;
  if (!winnerId) throw new ApiError(422, "Skor seri: tentukan pemenang lewat winnerId.");
  if (winnerId !== a && winnerId !== b) throw new ApiError(422, "Pemenang harus salah satu peserta laga ini.");
  if (scoreWinner && winnerId !== scoreWinner) throw new ApiError(422, "Pemenang tidak sesuai dengan skor.");
  return { winnerId, scoreA, scoreB, winType: null };
}

/**
 * Simpan hasil laga oleh pengawas ruangan (atau admin), dalam satu transaksi:
 * skor + pemenang + status selesai, catatan bukti (match_results), lalu
 * pemenang dimajukan ke laga berikutnya (lihat `advanceWinner`).
 */
export function recordMatchResult(matchId: string, input: MatchResultInput, user: SessionUser) {
  return db.transaction((tx) => {
    const match = tx.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
    authorize(user, "result:write", match);
    if (!isProofUrlForMatch(input.proofPhotoUrl, match.id)) {
      throw new ApiError(422, "Foto bukti harus diunggah untuk laga ini terlebih dahulu.");
    }

    const { participantAId: a, participantBId: b } = match;
    if (!a || !b) throw new ApiError(409, "Kedua peserta laga ini belum lengkap.");

    const { winnerId, scoreA, scoreB, winType } = resolveResult(match.round, a, b, input);

    const updated = tx
      .update(matches)
      .set({ scoreA, scoreB, winnerId, winType, status: "done" })
      .where(eq(matches.id, match.id))
      .returning()
      .get();

    // Rollback otomatis bila propagasi ditolak (mis. laga berikutnya sudah dimulai).
    const next = advanceWinner(tx, updated, match.winnerId);
    advanceToFeeds(tx, updated, match.winnerId);

    const now = new Date();
    tx.insert(matchResults)
      .values({
        id: crypto.randomUUID(),
        matchId: match.id,
        proofPhotoUrl: input.proofPhotoUrl,
        recordedBy: user.id,
        recordedAt: now,
      })
      .onConflictDoUpdate({
        target: matchResults.matchId,
        set: { proofPhotoUrl: input.proofPhotoUrl, recordedBy: user.id, recordedAt: now },
      })
      .run();

    // Jejak audit: setiap simpan tercatat, termasuk koreksi.
    tx.insert(matchResultHistory)
      .values({
        id: crypto.randomUUID(),
        matchId: match.id,
        roomId: match.roomId,
        action: match.status === "done" ? "correct" : "create",
        scoreA: scoreA ?? 0,
        scoreB: scoreB ?? 0,
        winnerId,
        proofPhotoUrl: input.proofPhotoUrl,
        recordedBy: user.id,
        recordedAt: now,
      })
      .run();

    bumpBracketVersion(tx);
    return { match: updated, nextMatch: next };
  });
}

/**
 * Batalkan hasil laga (salah input): laga kembali terjadwal tanpa skor/
 * pemenang, pemenang ditarik dari laga berikutnya, catatan bukti dihapus,
 * dan pembatalan tercatat di jejak audit. Ditolak bila laga berikutnya
 * sudah dimulai.
 */
export function cancelMatchResult(matchId: string, user: SessionUser) {
  return db.transaction((tx) => {
    const match = tx.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
    authorize(user, "result:cancel", match);
    if (match.status !== "done" || !match.winnerId) {
      throw new ApiError(409, "Laga ini belum punya hasil untuk dibatalkan.");
    }

    const next = retractWinner(tx, match);
    retractFromFeeds(tx, match);
    const result = tx.select().from(matchResults).where(eq(matchResults.matchId, match.id)).get();

    tx.insert(matchResultHistory)
      .values({
        id: crypto.randomUUID(),
        matchId: match.id,
        roomId: match.roomId,
        action: "cancel",
        scoreA: match.scoreA ?? 0,
        scoreB: match.scoreB ?? 0,
        winnerId: match.winnerId,
        proofPhotoUrl: result?.proofPhotoUrl ?? "",
        recordedBy: user.id,
        recordedAt: new Date(),
      })
      .run();
    tx.delete(matchResults).where(eq(matchResults.matchId, match.id)).run();
    const updated = tx
      .update(matches)
      .set({ scoreA: null, scoreB: null, winnerId: null, winType: null, status: "scheduled" })
      .where(eq(matches.id, match.id))
      .returning()
      .get();

    bumpBracketVersion(tx);
    return { match: updated, nextMatch: next };
  });
}
