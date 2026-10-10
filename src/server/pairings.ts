import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";

export const pairingInput = z.object({
  sessionId: z.string().min(1),
  roomId: z.string().min(1),
  /** Urutan peserta babak 1: indeks 2k vs 2k+1 = laga ke-(k+1). */
  order: z.array(z.string().min(1)).min(2),
});
export type PairingInput = z.infer<typeof pairingInput>;

function cellMatches(sessionId: string, roomId: string) {
  return db
    .select()
    .from(matches)
    .where(and(eq(matches.sessionId, sessionId), eq(matches.roomId, roomId)))
    .orderBy(asc(matches.round), asc(matches.matchNumber))
    .all();
}

/** Susunan babak 1 satu ruangan per sesi. */
export function getPairings(sessionId: string, roomId: string) {
  const all = cellMatches(sessionId, roomId);
  const roundOne = all.filter((m) => m.round === 1);
  return {
    sessionId,
    roomId,
    locked: all.some((m) => m.status !== "scheduled"),
    matches: roundOne.map((m) => ({ id: m.id, matchNumber: m.matchNumber, participantAId: m.participantAId, participantBId: m.participantBId })),
    order: roundOne.flatMap((m) => [m.participantAId, m.participantBId]),
  };
}

/**
 * Simpan susunan pasangan babak 1. Syarat: semua laga ruangan itu masih
 * terjadwal, jumlah peserta = 2 × laga babak 1, tiap peserta muncul sekali
 * dan memang ditempatkan di sesi & ruangan tersebut.
 */
export function savePairings(input: PairingInput) {
  const all = cellMatches(input.sessionId, input.roomId);
  const roundOne = all.filter((m) => m.round === 1);
  if (roundOne.length === 0) throw new ApiError(404, "Laga babak 1 untuk sesi & ruangan ini belum ada.");
  if (all.some((m) => m.status !== "scheduled")) {
    throw new ApiError(409, "Laga di ruangan ini sudah dimulai; susunan pasangan dikunci.");
  }
  if (input.order.length !== roundOne.length * 2) {
    throw new ApiError(422, `Babak 1 butuh ${roundOne.length * 2} peserta, dikirim ${input.order.length}.`);
  }
  if (new Set(input.order).size !== input.order.length) throw new ApiError(422, "Ada peserta yang muncul lebih dari sekali.");

  const placed = db
    .select({ id: participants.id, sessionId: participants.sessionId, roomId: participants.roomId })
    .from(participants)
    .where(inArray(participants.id, input.order))
    .all();
  const placedOk = new Set(placed.filter((p) => p.sessionId === input.sessionId && p.roomId === input.roomId).map((p) => p.id));
  const wrong = input.order.filter((id) => !placedOk.has(id));
  if (wrong.length) {
    throw new ApiError(422, `Peserta bukan dari sesi & ruangan ini: ${wrong.map((id) => id.toUpperCase()).join(", ")}.`);
  }

  return db.transaction((tx) => {
    roundOne.forEach((m, k) => {
      tx.update(matches)
        .set({ participantAId: input.order[2 * k], participantBId: input.order[2 * k + 1] })
        .where(eq(matches.id, m.id))
        .run();
    });
    bumpBracketVersion(tx);
    return { updated: roundOne.length };
  });
}
