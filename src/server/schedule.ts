import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants, rooms, sessions } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";

const name = z.string().trim().min(2).max(50);
export const sessionScheduleInput = z.object({ name, startTime: z.iso.datetime() });
export const roomInput = z.object({ name, location: z.string().trim().max(100) });

/**
 * Ubah nama & jam mulai sesi. Jam mulai harus di antara sesi sebelum dan
 * sesudahnya; bila bergeser, jadwal semua laga sesi itu ikut digeser dengan
 * selisih yang sama supaya bagan publik & pengawas tetap konsisten.
 */
export function updateSessionSchedule(id: string, input: z.infer<typeof sessionScheduleInput>) {
  const all = db.select().from(sessions).orderBy(asc(sessions.orderIndex)).all();
  const index = all.findIndex((s) => s.id === id);
  if (index < 0) throw new ApiError(404, "Sesi tidak ditemukan.");
  if (all.some((s) => s.id !== id && s.name.toLowerCase() === input.name.toLowerCase())) {
    throw new ApiError(409, "Nama sesi sudah dipakai.");
  }
  const start = new Date(input.startTime);
  const prev = all[index - 1]?.startTime;
  const next = all[index + 1]?.startTime;
  if ((prev && start <= prev) || (next && start >= next)) {
    throw new ApiError(422, "Jam mulai harus setelah sesi sebelumnya dan sebelum sesi berikutnya.");
  }
  const old = all[index].startTime;
  const shiftSeconds = old ? Math.round((start.getTime() - old.getTime()) / 1000) : 0;

  return db.transaction((tx) => {
    tx.update(sessions).set({ name: input.name, startTime: start, updatedAt: new Date() }).where(eq(sessions.id, id)).run();
    let shifted = 0;
    if (shiftSeconds !== 0) {
      // Laga yang sudah selesai tetap pada jamnya.
      shifted = tx
        .update(matches)
        .set({ scheduledAt: sql`${matches.scheduledAt} + ${shiftSeconds}` })
        .where(and(eq(matches.sessionId, id), isNotNull(matches.scheduledAt), ne(matches.status, "done")))
        .run().changes;
    }
    bumpBracketVersion(tx);
    return { id, shiftedMatches: shifted, shiftMinutes: shiftSeconds / 60 };
  });
}

/** Ubah nama (unik) & lokasi ruangan. */
export function updateRoom(id: string, input: z.infer<typeof roomInput>) {
  const all = db.select().from(rooms).all();
  if (!all.some((r) => r.id === id)) throw new ApiError(404, "Ruangan tidak ditemukan.");
  if (all.some((r) => r.id !== id && r.name.toLowerCase() === input.name.toLowerCase())) {
    throw new ApiError(409, "Nama ruangan sudah dipakai.");
  }
  return db.transaction((tx) => {
    tx.update(rooms).set({ name: input.name, location: input.location || null, updatedAt: new Date() }).where(eq(rooms.id, id)).run();
    bumpBracketVersion(tx);
    return { id };
  });
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Jadwal publik: sesi (jam mulai, rentang laga) dan laga terurut jam,
 * opsional difilter sesi / ruangan. Nama peserta disertakan supaya klien
 * (layar bagan, pengawas) tidak perlu memuat seluruh bagan.
 */
export function getSchedule(filter: { sesi?: string; ruangan?: string } = {}) {
  const sessionRows = db.select().from(sessions).orderBy(asc(sessions.orderIndex)).all();
  const roomRows = db.select({ id: rooms.id, name: rooms.name, location: rooms.location }).from(rooms).all();
  const names = new Map(db.select({ id: participants.id, name: participants.name }).from(participants).all().map((p) => [p.id, p.name]));
  const matchRows = db
    .select()
    .from(matches)
    .where(and(
      filter.sesi ? eq(matches.sessionId, filter.sesi) : undefined,
      filter.ruangan ? eq(matches.roomId, filter.ruangan) : undefined,
    ))
    .orderBy(asc(matches.scheduledAt), asc(matches.round), asc(matches.matchNumber))
    .all();

  const range = new Map<string, { first: Date; last: Date }>();
  for (const m of matchRows) {
    if (!m.scheduledAt) continue;
    const r = range.get(m.sessionId);
    if (!r) range.set(m.sessionId, { first: m.scheduledAt, last: m.scheduledAt });
    else {
      if (m.scheduledAt < r.first) r.first = m.scheduledAt;
      if (m.scheduledAt > r.last) r.last = m.scheduledAt;
    }
  }

  return {
    sessions: sessionRows
      .filter((s) => !filter.sesi || s.id === filter.sesi)
      .map((s) => ({
        id: s.id,
        name: s.name,
        startTime: iso(s.startTime),
        firstMatchAt: iso(range.get(s.id)?.first ?? null),
        lastMatchAt: iso(range.get(s.id)?.last ?? null),
      })),
    rooms: roomRows.filter((r) => !filter.ruangan || r.id === filter.ruangan),
    matches: matchRows.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      roomId: m.roomId,
      round: m.round,
      matchNumber: m.matchNumber,
      status: m.status,
      scheduledAt: iso(m.scheduledAt),
      participantA: m.participantAId ? { id: m.participantAId, name: names.get(m.participantAId) ?? null } : null,
      participantB: m.participantBId ? { id: m.participantBId, name: names.get(m.participantBId) ?? null } : null,
    })),
  };
}
