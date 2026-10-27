import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants } from "@/db/schema";
import { isByeMatch } from "@/lib/bracket-structure";
import { applyByes } from "@/server/byes";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";
import { retractWinner } from "@/server/propagation";

/** Ruangan dianggap berjalan bila ada laga dimulai/selesai selain bye otomatis. */
const started = (list: (typeof matches.$inferSelect)[]) => list.some((m) => m.status !== "scheduled" && !isByeMatch(m));

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
    locked: started(all),
    matches: roundOne.map((m) => ({ id: m.id, matchNumber: m.matchNumber, participantAId: m.participantAId, participantBId: m.participantBId })),
    order: roundOne.flatMap((m) => [m.participantAId, m.participantBId]),
  };
}

/**
 * Simpan susunan pasangan babak 1. Syarat: jumlah slot = 2 × laga babak 1,
 * tiap peserta muncul sekali dan memang ditempatkan di sesi & ruangan
 * tersebut; slot boleh kosong — laga yang hanya berisi satu peserta menjadi
 * bye (pesertanya lolos otomatis). Bila laga di ruangan itu sudah dimulai,
 * susunan dikunci: yang boleh hanya mengisi slot kosong.
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

  const locked = started(all);
  if (locked) {
    // Ruangan sudah berjalan: hanya slot kosong yang boleh diisi — di laga terjadwal, atau
    // laga bye yang laga berikutnya belum dimulai (bye-nya batal, jadi laga biasa).
    const nextOf = (m: (typeof all)[number]) => all.find((x) => x.id === m.nextMatchId);
    const fillable = (m: (typeof all)[number]) => m.status === "scheduled" || (isByeMatch(m) && nextOf(m)?.status === "scheduled");
    const allowed = roundOne.every((m, k) =>
      (["A", "B"] as const).every((side, j) => {
        const current = side === "A" ? m.participantAId : m.participantBId;
        const next = input.order[2 * k + j];
        return current === next || (current === null && next !== null && fillable(m));
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

  const cell = and(eq(matches.sessionId, input.sessionId), eq(matches.roomId, input.roomId));
  return db.transaction((tx) => {
    if (!locked) {
      // Belum ada laga dimainkan: bye lama dihapus dulu, lalu dihitung ulang dari susunan baru.
      tx.update(matches).set({ status: "scheduled", winnerId: null }).where(and(cell, eq(matches.round, 1))).run();
      tx.update(matches).set({ participantAId: null, participantBId: null }).where(and(cell, gt(matches.round, 1))).run();
    }
    roundOne.forEach((m, k) => {
      const a = input.order[2 * k];
      const b = input.order[2 * k + 1];
      if (locked && isByeMatch(m) && a !== null && b !== null) {
        // Slot kosong di laga bye diisi: tarik peserta bye dari babak 2, laga jadi terjadwal.
        retractWinner(tx, m);
        tx.update(matches).set({ status: "scheduled", winnerId: null }).where(eq(matches.id, m.id)).run();
      }
      tx.update(matches).set({ participantAId: a, participantBId: b }).where(eq(matches.id, m.id)).run();
    });
    const byes = applyByes(tx, cell);
    bumpBracketVersion(tx);
    return { updated: roundOne.length, byes };
  });
}
