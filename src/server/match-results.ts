import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, matchResults } from "@/db/schema";
import { assertRoomAccess, type SessionUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";
import { advanceWinner } from "@/server/propagation";

export const matchResultInput = z.object({
  scoreA: z.int().min(0).max(999),
  scoreB: z.int().min(0).max(999),
  /** Wajib bila skor seri (pemenang ditentukan aturan lain); selain itu harus cocok dengan skor. */
  winnerId: z.string().min(1).optional(),
  /** URL/path foto bukti (unggah berkas ditangani endpoint terpisah). */
  proofPhotoUrl: z.string().trim().min(1).max(2048),
});
export type MatchResultInput = z.infer<typeof matchResultInput>;

/**
 * Simpan hasil laga oleh pengawas ruangan (atau admin), dalam satu transaksi:
 * skor + pemenang + status selesai, catatan bukti (match_results), lalu
 * pemenang dimajukan ke laga berikutnya (lihat `advanceWinner`).
 */
export function recordMatchResult(matchId: string, input: MatchResultInput, user: SessionUser) {
  return db.transaction((tx) => {
    const match = tx.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
    assertRoomAccess(user, match.roomId);

    const { participantAId: a, participantBId: b } = match;
    if (!a || !b) throw new ApiError(409, "Kedua peserta laga ini belum lengkap.");

    const scoreWinner = input.scoreA > input.scoreB ? a : input.scoreB > input.scoreA ? b : null;
    const winnerId = input.winnerId ?? scoreWinner;
    if (!winnerId) throw new ApiError(422, "Skor seri: tentukan pemenang lewat winnerId.");
    if (winnerId !== a && winnerId !== b) {
      throw new ApiError(422, "Pemenang harus salah satu peserta laga ini.");
    }
    if (scoreWinner && winnerId !== scoreWinner) {
      throw new ApiError(422, "Pemenang tidak sesuai dengan skor.");
    }

    const updated = tx
      .update(matches)
      .set({ scoreA: input.scoreA, scoreB: input.scoreB, winnerId, status: "done" })
      .where(eq(matches.id, match.id))
      .returning()
      .get();

    // Rollback otomatis bila propagasi ditolak (mis. laga berikutnya sudah dimulai).
    const next = advanceWinner(tx, updated, match.winnerId);

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

    bumpBracketVersion(tx);
    return { match: updated, nextMatch: next };
  });
}
