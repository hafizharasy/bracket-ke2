import { roundLabel } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { getRoomViolations } from "@/lib/room-violations";
import { bracketSource } from "@/server/live";

export type ActivityItem =
  | { kind: "result"; at: string; matchId: string; roomName: string; label: string; winner: string; score: string }
  | { kind: "violation"; at: string; matchId: string | null; roomName: string; participant: string; type: string };

/**
 * Aktivitas terbaru lintas ruangan (hasil laga & pelanggaran), terbaru dulu.
 * Waktu hasil dari match_results (database); pada data tiruan diperkirakan
 * dari jadwal laga + 10 menit.
 */
export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const data = await getBracket();
  const name = (id: string | null) => (id ? data.participants.find((p) => p.id === id)?.name : undefined) ?? "—";
  const roomName = (id: string) => data.rooms.find((r) => r.id === id)?.name ?? id;

  let recordedAt = new Map<string, string>();
  if (bracketSource() === "db") {
    const [{ db }, { matchResults }] = await Promise.all([import("@/db"), import("@/db/schema")]);
    recordedAt = new Map(db.select().from(matchResults).all().map((r) => [r.matchId, r.recordedAt.toISOString()]));
  }
  const results: ActivityItem[] = data.matches
    .filter((m) => m.status === "done" && m.winnerId)
    .map((m) => ({
      kind: "result" as const,
      at:
        recordedAt.get(m.id) ??
        (m.scheduledAt ? new Date(new Date(m.scheduledAt).getTime() + 10 * 60_000).toISOString() : data.updatedAt),
      matchId: m.id,
      roomName: roomName(m.roomId),
      label: `${roundLabel(m.round)} #${m.matchNumber}`,
      winner: name(m.winnerId),
      score: `${m.scoreA ?? 0}–${m.scoreB ?? 0}`,
    }));

  const violations = (await Promise.all(data.rooms.map((r) => getRoomViolations(r.id)))).flat().map((v) => ({
    kind: "violation" as const,
    at: v.occurredAt,
    matchId: v.matchId,
    roomName: roomName(v.roomId),
    participant: name(v.participantId),
    type: v.type,
  }));

  return [...results, ...violations].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
