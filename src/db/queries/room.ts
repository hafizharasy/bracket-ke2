import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import { matches, matchResultHistory, matchResults, participants, rooms, sessions, users } from "@/db/schema";
import { roundLabel } from "@/lib/bracket";
import type { RoomHistoryItem } from "@/lib/room-history";

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const pa = alias(participants, "pa");
const pb = alias(participants, "pb");

export function getRoom(roomId: string) {
  return db.select().from(rooms).where(eq(rooms.id, roomId)).get() ?? null;
}

/** Laga di satu ruangan (opsional satu sesi), urut babak & nomor, dengan nama peserta. */
export function getRoomMatches(roomId: string, sessionId?: string | null) {
  const where: SQL | undefined = and(
    eq(matches.roomId, roomId),
    sessionId ? eq(matches.sessionId, sessionId) : undefined,
  );
  return db
    .select({
      id: matches.id,
      sessionId: matches.sessionId,
      round: matches.round,
      matchNumber: matches.matchNumber,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winnerId: matches.winnerId,
      nextMatchId: matches.nextMatchId,
      participantA: { id: pa.id, name: pa.name },
      participantB: { id: pb.id, name: pb.name },
    })
    .from(matches)
    .leftJoin(pa, eq(pa.id, matches.participantAId))
    .leftJoin(pb, eq(pb.id, matches.participantBId))
    .where(where)
    .orderBy(asc(matches.sessionId), asc(matches.round), asc(matches.matchNumber))
    .all()
    .map((m) => ({
      ...m,
      roundLabel: roundLabel(m.round),
      scheduledAt: iso(m.scheduledAt),
      // leftJoin menghasilkan objek berisi null bila slot kosong.
      participantA: m.participantA?.id ? m.participantA : null,
      participantB: m.participantB?.id ? m.participantB : null,
    }));
}

/**
 * Riwayat hasil ruangan dari database: laga selesai beserta catatan hasil
 * terakhir (waktu, bukti, pencatat) dan jumlah koreksi. Terbaru dulu.
 */
export function getRoomHistoryFromDb(roomId: string, sessionId?: string | null): RoomHistoryItem[] {
  const corrections = db
    .select({ matchId: matchResultHistory.matchId, n: count() })
    .from(matchResultHistory)
    .where(and(eq(matchResultHistory.roomId, roomId), eq(matchResultHistory.action, "correct")))
    .groupBy(matchResultHistory.matchId)
    .all();
  const correctionCount = new Map(corrections.map((c) => [c.matchId, c.n]));

  return db
    .select({
      matchId: matches.id,
      sessionId: matches.sessionId,
      round: matches.round,
      matchNumber: matches.matchNumber,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winnerId: matches.winnerId,
      participantA: { id: pa.id, name: pa.name },
      participantB: { id: pb.id, name: pb.name },
      recordedAt: matchResults.recordedAt,
      proofPhotoUrl: matchResults.proofPhotoUrl,
      recordedBy: users.name,
    })
    .from(matches)
    .innerJoin(pa, eq(pa.id, matches.participantAId))
    .innerJoin(pb, eq(pb.id, matches.participantBId))
    .leftJoin(matchResults, eq(matchResults.matchId, matches.id))
    .leftJoin(users, eq(users.id, matchResults.recordedBy))
    .where(
      and(
        eq(matches.roomId, roomId),
        eq(matches.status, "done"),
        sessionId ? eq(matches.sessionId, sessionId) : undefined,
      ),
    )
    .orderBy(desc(matchResults.recordedAt), desc(matches.round), desc(matches.matchNumber))
    .all()
    .map((row) => ({
      matchId: row.matchId,
      sessionId: row.sessionId,
      roundLabel: roundLabel(row.round),
      matchNumber: row.matchNumber,
      participantA: row.participantA,
      participantB: row.participantB,
      scoreA: row.scoreA ?? 0,
      scoreB: row.scoreB ?? 0,
      winnerId: row.winnerId!,
      recordedAt: iso(row.recordedAt),
      recordedBy: row.recordedBy,
      proofPhotoUrl: row.proofPhotoUrl,
      corrections: correctionCount.get(row.matchId) ?? 0,
    }));
}

export function getSessionsList() {
  return db.select().from(sessions).orderBy(asc(sessions.orderIndex)).all();
}
