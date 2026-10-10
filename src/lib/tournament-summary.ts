import { LAST_ROOM_ROUND, roundLabel } from "@/lib/bracket";
import type { BracketData, Match } from "@/lib/types";

export type TournamentSummary = {
  participants: number;
  matches: { total: number; done: number; ongoing: number; scheduled: number; percent: number };
  sessions: { id: string; name: string; done: number; total: number; ongoing: number; startTime: string | null }[];
  /** Sesi yang sedang berjalan (ada laga ongoing), atau sesi berikutnya yang belum selesai. */
  activeSession: { id: string; name: string; state: "berjalan" | "berikutnya" | "selesai" } | null;
  roomChampions: { decided: number; total: number };
  champion: string | null;
  nextMatch: { label: string; roomName: string | null; scheduledAt: string | null } | null;
};

/** Ringkasan turnamen dari data bagan (fungsi murni). */
export function summarizeTournament(data: Pick<BracketData, "participants" | "sessions" | "rooms" | "matches">): TournamentSummary {
  const { participants, sessions, rooms, matches } = data;
  const count = (list: Match[], status: Match["status"]) => list.filter((m) => m.status === status).length;
  const done = count(matches, "done");

  const perSession = sessions.map((s) => {
    const list = matches.filter((m) => m.sessionId === s.id && m.round <= LAST_ROOM_ROUND);
    return { id: s.id, name: s.name, total: list.length, done: count(list, "done"), ongoing: count(list, "ongoing"), startTime: s.startTime };
  });
  const running = perSession.find((s) => s.ongoing > 0);
  const upcoming = perSession.find((s) => s.done < s.total);
  const activeSession = running
    ? { id: running.id, name: running.name, state: "berjalan" as const }
    : upcoming
      ? { id: upcoming.id, name: upcoming.name, state: "berikutnya" as const }
      : perSession.length
        ? { id: perSession.at(-1)!.id, name: perSession.at(-1)!.name, state: "selesai" as const }
        : null;

  const roomFinals = matches.filter((m) => m.round === LAST_ROOM_ROUND);
  const grandFinal = matches.find((m) => !m.nextMatchId && m.round > LAST_ROOM_ROUND);
  const champion = grandFinal?.winnerId ? participants.find((p) => p.id === grandFinal.winnerId)?.name ?? null : null;

  const next = matches
    .filter((m) => m.status === "scheduled" && m.participantAId && m.participantBId)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || a.round - b.round)[0];

  return {
    participants: participants.length,
    matches: {
      total: matches.length,
      done,
      ongoing: count(matches, "ongoing"),
      scheduled: count(matches, "scheduled"),
      percent: matches.length ? Math.round((done / matches.length) * 100) : 0,
    },
    sessions: perSession,
    activeSession,
    roomChampions: { decided: roomFinals.filter((m) => m.winnerId).length, total: roomFinals.length },
    champion,
    nextMatch: next
      ? {
          label: `${roundLabel(next.round)} #${next.matchNumber}`,
          roomName: rooms.find((r) => r.id === next.roomId)?.name ?? null,
          scheduledAt: next.scheduledAt,
        }
      : null,
  };
}
