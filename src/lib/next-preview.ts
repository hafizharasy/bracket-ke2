import { buildAdvanceMap, buildSlotLabels, FINAL_ROUND, roundLabel, SEMIFINAL_ROUND } from "@/lib/bracket";
import type { NextPreview } from "@/components/ruangan/result-form";
import type { BracketData, Match } from "@/lib/types";

const shortTime = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Ke mana pemenang `match` maju: laga berikutnya (beserta calon lawan), final, atau poin klasemen. */
export function nextPreview(data: Pick<BracketData, "matches" | "participants" | "sessions" | "rooms">, match: Match): NextPreview {
  if (match.round === FINAL_ROUND) return { kind: "points" };
  if (match.round === SEMIFINAL_ROUND) return { kind: "final-stage" };
  const nextMatch = match.nextMatchId ? data.matches.find((m) => m.id === match.nextMatchId) : undefined;
  if (!nextMatch) return { kind: "final-stage" };

  const side = buildAdvanceMap(data.matches).get(match.id)?.side ?? "B";
  const opponentId = side === "A" ? nextMatch.participantBId : nextMatch.participantAId;
  const labels = buildSlotLabels(data.matches, {
    sessions: new Map(data.sessions.map((s) => [s.id, s])),
    rooms: new Map(data.rooms.map((r) => [r.id, r])),
  }).get(nextMatch.id);
  const opponent = opponentId ? data.participants.find((p) => p.id === opponentId) : undefined;
  return {
    kind: "match",
    label: `${roundLabel(nextMatch.round)} #${nextMatch.matchNumber}`,
    roomName: data.rooms.find((r) => r.id === nextMatch.roomId)?.name ?? null,
    time: nextMatch.scheduledAt ? shortTime.format(new Date(nextMatch.scheduledAt)) : null,
    status: nextMatch.status,
    opponent: opponent?.name ?? (side === "A" ? labels?.b.text : labels?.a.text) ?? "Belum diketahui",
    opponentKnown: !!opponent,
  };
}
