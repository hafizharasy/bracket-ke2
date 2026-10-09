import { asc, max } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchResults, participants, rooms, sessions } from "@/db/schema";
import type { BracketData } from "@/lib/types";

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * Bagan lengkap dari database dalam bentuk kontrak `BracketData`
 * (sama dengan yang dipakai frontend). Waktu dikirim sebagai string ISO.
 */
export function getBracketFromDb(): BracketData {
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
    .orderBy(asc(participants.id))
    .all();
  const matchRows = db
    .select()
    .from(matches)
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
