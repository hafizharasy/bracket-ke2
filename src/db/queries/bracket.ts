import { and, asc, eq, max, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchResults, participants, rooms, sessions } from "@/db/schema";
import type { BracketData } from "@/lib/types";

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export type BracketFilter = { sessionId?: string | null; roomId?: string | null };

/** Kondisi WHERE untuk filter sesi/ruangan pada tabel ber-kolom session_id & room_id. */
function scope(
  table: typeof participants | typeof matches,
  { sessionId, roomId }: BracketFilter,
): SQL | undefined {
  return and(
    sessionId ? eq(table.sessionId, sessionId) : undefined,
    roomId ? eq(table.roomId, roomId) : undefined,
  );
}

/**
 * Bagan dari database dalam bentuk kontrak `BracketData` (sama dengan yang
 * dipakai frontend). Waktu dikirim sebagai string ISO.
 *
 * Filter sesi/ruangan menyaring peserta & pertandingan; daftar sesi dan
 * ruangan tetap lengkap (dibutuhkan untuk pilihan filter).
 */
export function getBracketFromDb(filter: BracketFilter = {}): BracketData {
  const sessionRows = db.select().from(sessions).orderBy(asc(sessions.orderIndex)).all();
  const roomRows = db.select().from(rooms).orderBy(asc(rooms.id)).all();
  const participantRows = db
    .select({
      id: participants.id,
      name: participants.name,
      teamOrClub: participants.teamOrClub,
      sessionId: participants.sessionId,
      roomId: participants.roomId,
    })
    .from(participants)
    .where(scope(participants, filter))
    .orderBy(asc(participants.id))
    .all();
  const matchRows = db
    .select()
    .from(matches)
    .where(scope(matches, filter))
    .orderBy(asc(matches.round), asc(matches.matchNumber), asc(matches.id))
    .all();
  const lastResult = db.select({ at: max(matchResults.recordedAt) }).from(matchResults).get();

  return {
    sessions: sessionRows.map((s) => ({ ...s, startTime: iso(s.startTime) })),
    // Urut natural: Ruangan 2 sebelum Ruangan 10.
    rooms: roomRows.sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true })),
    participants: participantRows,
    matches: matchRows.map((m) => ({ ...m, scheduledAt: iso(m.scheduledAt) })),
    updatedAt: (lastResult?.at ?? new Date()).toISOString(),
  };
}
