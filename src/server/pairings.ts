import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";

export const pairingInput = z.object({
  sessionId: z.string().min(1),
  roomId: z.string().min(1),
  /** Urutan peserta babak 1: indeks 2k vs 2k+1 = laga ke-(k+1); null = slot kosong. */
  order: z.array(z.string().min(1).nullable()).min(2),
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
 * Simpan susunan pasangan babak 1. Syarat: jumlah slot = 2 × laga babak 1,
 * tiap peserta muncul sekali dan memang ditempatkan di sesi & ruangan
 * tersebut; slot boleh kosong (mis. pesertanya dihapus). Bila laga di ruangan
 * itu sudah dimulai, susunan dikunci: yang boleh hanya mengisi slot kosong
 * di laga yang masih terjadwal.
 */
export function savePairings(input: PairingInput) {
  const all = cellMatches(input.sessionId, input.roomId);
  const roundOne = all.filter((m) => m.round === 1);
  if (roundOne.length === 0) throw new ApiError(404, "Laga babak 1 untuk sesi & ruangan ini belum ada.");
  if (input.order.length !== roundOne.length * 2) {
    throw new ApiError(422, `Babak 1 butuh ${roundOne.length * 2} slot, dikirim ${input.order.length}.`);
  }
  const ids = input.order.filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length) throw new ApiError(422, "Ada peserta yang muncul lebih dari sekali.");

  if (all.some((m) => m.status !== "scheduled")) {
    // Ruangan sudah berjalan: hanya slot kosong di laga terjadwal yang boleh diisi.
    const allowed = roundOne.every((m, k) =>
      (["A", "B"] as const).every((side, j) => {
        const current = side === "A" ? m.participantAId : m.participantBId;
        const next = input.order[2 * k + j];
        return current === next || (current === null && next !== null && m.status === "scheduled");
      }),
    );
    if (!allowed) {
      throw new ApiError(409, "Laga di ruangan ini sudah dimulai; susunan dikunci — hanya slot kosong yang bisa diisi.");
    }
    // Yang baru diisikan harus peserta cadangan (belum ada di laga mana pun di ruangan ini).
    const current = roundOne.flatMap((m) => [m.participantAId, m.participantBId]);
    const added = input.order.filter((id, i): id is string => id !== null && current[i] === null);
    const placedAnywhere = new Set(all.flatMap((m) => [m.participantAId, m.participantBId]));
    if (added.some((id) => placedAnywhere.has(id))) throw new ApiError(422, "Slot kosong hanya bisa diisi peserta cadangan.");
  }

  const placed = ids.length
    ? db
        .select({ id: participants.id, sessionId: participants.sessionId, roomId: participants.roomId })
        .from(participants)
        .where(inArray(participants.id, ids))
        .all()
    : [];
  const placedOk = new Set(placed.filter((p) => p.sessionId === input.sessionId && p.roomId === input.roomId).map((p) => p.id));
  const wrong = ids.filter((id) => !placedOk.has(id));
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
