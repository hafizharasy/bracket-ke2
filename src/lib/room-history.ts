import { roundLabel } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { bracketSource } from "@/server/live";
import type { Participant } from "@/lib/types";

export type RoomHistoryItem = {
  matchId: string;
  sessionId: string;
  roundLabel: string;
  matchNumber: number;
  participantA: Pick<Participant, "id" | "name">;
  participantB: Pick<Participant, "id" | "name">;
  scoreA: number;
  scoreB: number;
  winnerId: string;
  /** Kapan hasil dicatat (ISO). */
  recordedAt: string | null;
  recordedBy: string | null;
  proofPhotoUrl: string | null;
  /** Berapa kali hasil dikoreksi setelah input pertama. */
  corrections: number;
};

/**
 * Riwayat hasil laga di satu ruangan, terbaru dulu: dari database, atau
 * diturunkan dari data simulasi saat BRACKET_DATA_SOURCE=mock.
 */
export async function getRoomHistory(roomId: string): Promise<RoomHistoryItem[]> {
  if (bracketSource() === "db") {
    const { getRoomHistoryFromDb } = await import("@/db/queries/room");
    return getRoomHistoryFromDb(roomId);
  }
  // Mode simulasi: waktu catat diperkirakan dari jadwal + 10 menit, tanpa bukti.
  const data = await getBracket();
  const participants = new Map(data.participants.map((p) => [p.id, p]));
  return data.matches
    .filter((m) => m.roomId === roomId && m.status === "done" && m.winnerId) // hanya ruangan ini
    .map((m) => ({
      matchId: m.id,
      sessionId: m.sessionId,
      roundLabel: roundLabel(m.round),
      matchNumber: m.matchNumber,
      participantA: participants.get(m.participantAId!)!,
      participantB: participants.get(m.participantBId!)!,
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
      winnerId: m.winnerId!,
      recordedAt: m.scheduledAt
        ? new Date(new Date(m.scheduledAt).getTime() + 10 * 60_000).toISOString()
        : null,
      recordedBy: null,
      proofPhotoUrl: null,
      corrections: 0,
    }))
    .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? "") || b.matchNumber - a.matchNumber);
}
