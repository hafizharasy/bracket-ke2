import { connection } from "next/server";
import { buildAdvanceMap, roundLabel } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { getRoomViolations } from "@/lib/room-violations";
import type { MatchStatus } from "@/lib/types";
import type { Violation } from "@/lib/violations";
import { bracketSource } from "@/server/live";

type Person = { id: string; name: string; teamOrClub: string | null };

export type AdminMatchView = {
  id: string;
  roundLabel: string;
  matchNumber: number;
  status: MatchStatus;
  scheduledAt: string | null;
  session: { id: string; name: string };
  room: { id: string; name: string; location: string | null };
  participantA: Person | null;
  participantB: Person | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  result: { proofPhotoUrl: string; recordedAt: string | null } | null;
  sources: { a: string | null; b: string | null };
  nextMatch: { id: string; label: string } | null;
  history: {
    id: string;
    action: "create" | "correct" | "cancel";
    scoreA: number;
    scoreB: number;
    winnerId: string;
    proofPhotoUrl: string;
    recordedAt: string;
    recordedBy: string | null;
  }[];
  violations: (Violation & { participantName: string })[];
};

/**
 * Detail laga untuk admin: hasil, bukti, jejak audit, dan pelanggaran di
 * laga itu. Dari database; saat BRACKET_DATA_SOURCE=mock diturunkan dari
 * data simulasi (tanpa bukti & jejak audit).
 */
export async function getAdminMatchView(matchId: string): Promise<AdminMatchView | null> {
  // Data live dari database: selalu dibaca saat request, bukan saat build.
  await connection();
  const data = await getBracket();
  const match = data.matches.find((m) => m.id === matchId);
  if (!match) return null;
  const person = (id: string | null) => {
    const p = id ? data.participants.find((x) => x.id === id) : undefined;
    return p ? { id: p.id, name: p.name, teamOrClub: p.teamOrClub } : null;
  };
  const session = data.sessions.find((s) => s.id === match.sessionId)!;
  const room = data.rooms.find((r) => r.id === match.roomId)!;
  const feeders = data.matches.filter((m) => m.nextMatchId === match.id);
  const advance = buildAdvanceMap(data.matches);
  const source = (side: "A" | "B") => {
    const f = feeders.find((m) => advance.get(m.id)?.side === side);
    return f ? `Pemenang ${roundLabel(f.round)} #${f.matchNumber}` : null;
  };
  const next = match.nextMatchId ? data.matches.find((m) => m.id === match.nextMatchId) : undefined;
  const violations = (await getRoomViolations(match.roomId))
    .filter((v) => v.matchId === match.id)
    .map((v) => ({ ...v, participantName: person(v.participantId)?.name ?? v.participantId }));

  let result: AdminMatchView["result"] = null;
  let history: AdminMatchView["history"] = [];
  if (bracketSource() === "db") {
    const { getMatchDetail, getMatchResultHistory } = await import("@/db/queries/match-detail");
    result = (await getMatchDetail(match.id))?.result ?? null;
    history = getMatchResultHistory(match.id);
  }

  return {
    id: match.id,
    roundLabel: roundLabel(match.round),
    matchNumber: match.matchNumber,
    status: match.status,
    scheduledAt: match.scheduledAt,
    session: { id: session.id, name: session.name },
    room: { id: room.id, name: room.name, location: room.location },
    participantA: person(match.participantAId),
    participantB: person(match.participantBId),
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    winnerId: match.winnerId,
    result,
    sources: { a: source("A"), b: source("B") },
    nextMatch: next ? { id: next.id, label: `${roundLabel(next.round)} #${next.matchNumber}` } : null,
    history,
    violations,
  };
}
