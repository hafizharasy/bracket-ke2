import { LAST_ROOM_ROUND, roundLabel, sortMatches } from "@/lib/bracket";
import type { BracketData, Match } from "@/lib/types";

export type RoomStatus = "berlangsung" | "siap" | "menunggu" | "selesai" | "kosong";

export type RoomMonitor = {
  roomId: string;
  name: string;
  location: string | null;
  sessionId: string | null;
  sessionName: string | null;
  status: RoomStatus;
  done: number;
  total: number;
  live: { matchId: string; label: string; a: string; b: string; scoreA: number | null; scoreB: number | null }[];
  next: { matchId: string; label: string; scheduledAt: string | null } | null;
  champion: string | null;
  violations: number;
};

/**
 * Status tiap ruangan untuk satu sesi (default: sesi aktif — yang punya laga
 * berjalan, atau sesi pertama yang belum selesai). Fungsi murni.
 */
export function monitorRooms(
  data: Pick<BracketData, "participants" | "sessions" | "rooms" | "matches">,
  violationsByRoom: Map<string, number> = new Map(),
  sessionId?: string,
): { sessionId: string | null; rooms: RoomMonitor[] } {
  const { participants, sessions, rooms, matches } = data;
  const name = (id: string | null) => (id ? participants.find((p) => p.id === id)?.name ?? "?" : "—");
  const roomRound = (m: Match) => m.round <= LAST_ROOM_ROUND;

  const active =
    sessions.find((s) => s.id === sessionId) ??
    sessions.find((s) => matches.some((m) => m.sessionId === s.id && roomRound(m) && m.status === "ongoing")) ??
    sessions.find((s) => matches.some((m) => m.sessionId === s.id && roomRound(m) && m.status !== "done")) ??
    sessions.at(-1);

  return {
    sessionId: active?.id ?? null,
    rooms: rooms.map((room) => {
      const list = matches.filter((m) => m.roomId === room.id && m.sessionId === active?.id && roomRound(m)).sort(sortMatches);
      const live = list.filter((m) => m.status === "ongoing");
      const ready = list.filter((m) => m.status === "scheduled" && m.participantAId && m.participantBId);
      const done = list.filter((m) => m.status === "done").length;
      const final = list.find((m) => m.round === LAST_ROOM_ROUND);
      const status: RoomStatus =
        list.length === 0 ? "kosong" : live.length ? "berlangsung" : done === list.length ? "selesai" : ready.length ? "siap" : "menunggu";
      return {
        roomId: room.id,
        name: room.name,
        location: room.location,
        sessionId: active?.id ?? null,
        sessionName: active?.name ?? null,
        status,
        done,
        total: list.length,
        live: live.map((m) => ({
          matchId: m.id,
          label: `${roundLabel(m.round)} #${m.matchNumber}`,
          a: name(m.participantAId),
          b: name(m.participantBId),
          scoreA: m.scoreA,
          scoreB: m.scoreB,
        })),
        next: ready[0]
          ? { matchId: ready[0].id, label: `${roundLabel(ready[0].round)} #${ready[0].matchNumber}`, scheduledAt: ready[0].scheduledAt }
          : null,
        champion: final?.winnerId ? name(final.winnerId) : null,
        violations: violationsByRoom.get(room.id) ?? 0,
      };
    }),
  };
}
