import { and, asc, count, eq, isNull, like, or, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, matchResultHistory, participants, rooms, sessions } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";
import { nextParticipantIds, participantFields } from "@/server/participant-import";

export const participantCreateInput = participantFields.extend({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter."),
  teamOrClub: participantFields.shape.teamOrClub.optional().transform((v) => v || null),
  sessionId: z.string().min(1).nullish().transform((v) => v ?? null),
  roomId: z.string().min(1).nullish().transform((v) => v ?? null),
});
export const participantUpdateInput = participantCreateInput.partial();
export type ParticipantCreate = z.infer<typeof participantCreateInput>;
export type ParticipantUpdate = z.infer<typeof participantUpdateInput>;

export type ParticipantQuery = {
  q?: string;
  /** ID sesi, "none" = belum punya sesi. */
  sesi?: string;
  ruangan?: string;
  page?: number;
  pageSize?: number;
};

/** Cari peserta (nama/ID/sekolah) + filter sesi & ruangan, dengan halaman. */
export function searchParticipants(query: ParticipantQuery) {
  const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 200);
  const page = Math.max(query.page ?? 1, 1);
  const q = query.q?.trim();
  const where: SQL | undefined = and(
    q ? or(like(participants.name, `%${q}%`), like(participants.id, `%${q}%`), like(participants.teamOrClub, `%${q}%`)) : undefined,
    query.sesi === "none" ? isNull(participants.sessionId) : query.sesi ? eq(participants.sessionId, query.sesi) : undefined,
    query.ruangan === "none" ? isNull(participants.roomId) : query.ruangan ? eq(participants.roomId, query.ruangan) : undefined,
  );
  const total = db.select({ n: count() }).from(participants).where(where).get()!.n;
  const items = db
    .select()
    .from(participants)
    .where(where)
    .orderBy(asc(participants.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getParticipant(id: string) {
  return db.select().from(participants).where(eq(participants.id, id)).get() ?? null;
}

/** Pastikan sesi/ruangan ada dan ruangan selalu disertai sesi. */
function assertPlacement(sessionId: string | null, roomId: string | null) {
  if (roomId && !sessionId) throw new ApiError(422, "Ruangan diisi tetapi sesi kosong.");
  const session = sessionId ? db.select({ stage: sessions.stage }).from(sessions).where(eq(sessions.id, sessionId)).get() : null;
  if (sessionId && !session) throw new ApiError(422, "Sesi tidak ditemukan.");
  if (session?.stage === "final") throw new ApiError(422, "Peserta tidak bisa ditempatkan di sesi Semifinal & Final.");
  if (roomId && !db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).get()) {
    throw new ApiError(422, "Ruangan tidak ditemukan.");
  }
}

export function createParticipant(input: ParticipantCreate) {
  assertPlacement(input.sessionId, input.roomId);
  return db.transaction((tx) => {
    const ids = tx.select({ id: participants.id }).from(participants).all().map((p) => p.id);
    const [id] = nextParticipantIds(ids, 1);
    const row = tx.insert(participants).values({ id, ...input }).returning().get();
    bumpBracketVersion(tx);
    return row;
  });
}

export function updateParticipant(id: string, input: ParticipantUpdate) {
  const current = getParticipant(id);
  if (!current) throw new ApiError(404, "Peserta tidak ditemukan.");
  const next = { ...current, ...input };
  assertPlacement(next.sessionId, next.roomId);
  return db.transaction((tx) => {
    const row = tx
      .update(participants)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(participants.id, id))
      .returning()
      .get();
    bumpBracketVersion(tx);
    return row;
  });
}

/**
 * Hapus peserta. Bila ia sudah ditempatkan di bagan, slotnya di laga babak 1
 * dikosongkan (diisi manual lewat Pasangan Tanding). Ditolak bila ia sudah
 * bertanding: laganya berlangsung/selesai, pernah menang, atau punya riwayat
 * hasil — batalkan hasilnya dulu.
 */
export function deleteParticipant(id: string) {
  if (!getParticipant(id)) throw new ApiError(404, "Peserta tidak ditemukan.");
  const involved = db
    .select({ id: matches.id, round: matches.round, matchNumber: matches.matchNumber, status: matches.status, winnerId: matches.winnerId })
    .from(matches)
    .where(or(eq(matches.participantAId, id), eq(matches.participantBId, id), eq(matches.winnerId, id)))
    .all();
  if (involved.some((m) => m.status !== "scheduled" || m.winnerId === id)) {
    throw new ApiError(409, "Peserta sudah bertanding (laganya berlangsung/selesai). Batalkan hasil laganya dulu sebelum menghapus.");
  }
  const history = db.select({ id: matchResultHistory.id }).from(matchResultHistory).where(eq(matchResultHistory.winnerId, id)).get();
  if (history) throw new ApiError(409, "Peserta tercatat di riwayat hasil laga, jadi tidak bisa dihapus.");

  return db.transaction((tx) => {
    // Kosongkan slotnya di bagan (laga masih terjadwal), lalu hapus pesertanya.
    tx.update(matches).set({ participantAId: null }).where(eq(matches.participantAId, id)).run();
    tx.update(matches).set({ participantBId: null }).where(eq(matches.participantBId, id)).run();
    tx.delete(participants).where(eq(participants.id, id)).run();
    bumpBracketVersion(tx);
    return { emptiedMatches: involved.map((m) => m.id) };
  });
}
