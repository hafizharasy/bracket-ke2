import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchResultHistory, users } from "@/db/schema";
import { buildAdvanceMap, roundLabel } from "@/lib/bracket";

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

const participantColumns = { id: true, name: true, teamOrClub: true } as const;

/**
 * Detail satu pertandingan untuk tampilan publik: peserta, sesi, ruangan,
 * hasil (foto bukti & waktu catat), ke mana pemenang maju, dan laga asal
 * tiap slot. Identitas pencatat tidak disertakan. Null bila tidak ada.
 */
export async function getMatchDetail(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      session: true,
      room: true,
      participantA: { columns: participantColumns },
      participantB: { columns: participantColumns },
      result: { columns: { proofPhotoUrl: true, recordedAt: true } },
      nextMatch: {
        columns: { id: true, round: true, matchNumber: true, status: true },
        with: { room: { columns: { id: true, name: true } } },
      },
    },
  });
  if (!match) return null;

  const feeders = db
    .select({
      id: matches.id,
      round: matches.round,
      matchNumber: matches.matchNumber,
      nextMatchId: matches.nextMatchId,
      status: matches.status,
      winnerId: matches.winnerId,
    })
    .from(matches)
    .where(eq(matches.nextMatchId, match.id))
    .orderBy(asc(matches.round), asc(matches.matchNumber))
    .all();
  const advance = buildAdvanceMap(feeders);
  const sourceFor = (side: "A" | "B") => {
    const feeder = feeders.find((f) => advance.get(f.id)?.side === side);
    return feeder
      ? {
          matchId: feeder.id,
          label: `${roundLabel(feeder.round)} #${feeder.matchNumber}`,
          status: feeder.status,
        }
      : null;
  };

  return {
    id: match.id,
    round: match.round,
    roundLabel: roundLabel(match.round),
    matchNumber: match.matchNumber,
    status: match.status,
    scheduledAt: iso(match.scheduledAt),
    session: { ...match.session, startTime: iso(match.session.startTime) },
    room: match.room,
    participantA: match.participantA,
    participantB: match.participantB,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    winnerId: match.winnerId,
    result: match.result
      ? { proofPhotoUrl: match.result.proofPhotoUrl, recordedAt: iso(match.result.recordedAt) }
      : null,
    nextMatch: match.nextMatch
      ? {
          id: match.nextMatch.id,
          label: `${roundLabel(match.nextMatch.round)} #${match.nextMatch.matchNumber}`,
          status: match.nextMatch.status,
          room: match.nextMatch.room,
        }
      : null,
    /** Asal peserta slot A/B (null bila diisi langsung, mis. unggulan). */
    sources: { a: sourceFor("A"), b: sourceFor("B") },
  };
}

export type MatchDetail = NonNullable<Awaited<ReturnType<typeof getMatchDetail>>>;

/** Jejak audit hasil satu laga (input, koreksi, pembatalan), terlama dulu, dengan nama pencatat. */
export function getMatchResultHistory(matchId: string) {
  return db
    .select({
      id: matchResultHistory.id,
      action: matchResultHistory.action,
      scoreA: matchResultHistory.scoreA,
      scoreB: matchResultHistory.scoreB,
      winnerId: matchResultHistory.winnerId,
      proofPhotoUrl: matchResultHistory.proofPhotoUrl,
      recordedAt: matchResultHistory.recordedAt,
      recordedBy: users.name,
    })
    .from(matchResultHistory)
    .leftJoin(users, eq(users.id, matchResultHistory.recordedBy))
    .where(eq(matchResultHistory.matchId, matchId))
    .orderBy(asc(matchResultHistory.recordedAt))
    .all()
    .map((h) => ({ ...h, recordedAt: h.recordedAt.toISOString() }));
}
