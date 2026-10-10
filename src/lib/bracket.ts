import type { Match } from "@/lib/types";

/**
 * Struktur turnamen:
 * - Babak ruangan (ronde 1–6): tiap ruangan yang dipakai di suatu sesi berisi
 *   64 peserta → 63 laga, menghasilkan 1 juara ruangan.
 * - Semifinal (ronde 7, best of 3): juara ruangan dipasangkan admin; yang
 *   lebih dulu menang 2 game lolos ke final.
 * - Final (ronde 8): kompetisi penuh (double round-robin) antar finalis —
 *   tiap pasangan bertemu dua kali (tuan rumah jalan pertama), juara dari
 *   poin klasemen.
 */
export const PLAYERS_PER_ROOM = 64;
export const ROOM_ROUNDS = [1, 2, 3, 4, 5, 6] as const;
export const LAST_ROOM_ROUND = 6;
export const SEMIFINAL_ROUND = 7;
export const FINAL_ROUND = 8;
export const FINAL_ROUNDS = [SEMIFINAL_ROUND, FINAL_ROUND] as const;
/** Semifinal: menang 2 game dari maksimal 3. */
export const SEMIFINAL_WINS = 2;

const ROUND_LABELS: Record<number, string> = {
  1: "64 Besar Ruangan",
  2: "32 Besar Ruangan",
  3: "16 Besar Ruangan",
  4: "Perempat Final Ruangan",
  5: "Semifinal Ruangan",
  6: "Final Ruangan",
  7: "Semifinal",
  8: "Final",
};

export function roundLabel(round: number) {
  return ROUND_LABELS[round] ?? `Babak ${round}`;
}

/** Laga semifinal atau final (setelah babak ruangan). */
export function isFinalStage(match: Pick<Match, "round">) {
  return match.round > LAST_ROOM_ROUND;
}

/** Jenis kemenangan di final round-robin beserta poinnya. */
export const WIN_TYPES = {
  empat: { label: "Menang telak (4 pion berjajar)", points: 3 },
  tiga: { label: "Menang (3 pion berjajar)", points: 2 },
  tiga_tercepat: { label: "Menang (3 pion berjajar pertama, tercepat)", points: 1 },
  dua_terbanyak: { label: "Menang (2 pion berjajar terbanyak)", points: 0.5 },
} as const;
export type WinType = keyof typeof WIN_TYPES;
export const WIN_TYPE_KEYS = Object.keys(WIN_TYPES) as WinType[];

type MatchOrder = Pick<Match, "round" | "matchNumber">;
type MatchLink = MatchOrder & Pick<Match, "id" | "nextMatchId">;

export function sortMatches(a: MatchOrder, b: MatchOrder) {
  return a.round - b.round || a.matchNumber - b.matchNumber;
}

/** Kelompokkan pertandingan per ronde, terurut. */
export function groupByRound(matches: Match[]) {
  const rounds = new Map<number, Match[]>();
  for (const m of [...matches].sort(sortMatches)) {
    const list = rounds.get(m.round) ?? [];
    list.push(m);
    rounds.set(m.round, list);
  }
  return rounds;
}

/** Penanda slot kosong: dari laga mana pesertanya akan datang. */
export type SlotLabel = { text: string; live: boolean };
export type SlotLabels = { a: SlotLabel; b: SlotLabel };

/** Laga asal per laga tujuan (`nextMatchId`), terurut babak lalu nomor laga. */
function groupFeeders<T extends MatchLink>(matches: T[]) {
  const feeders = new Map<string, T[]>();
  for (const m of matches) {
    if (!m.nextMatchId) continue;
    const list = feeders.get(m.nextMatchId) ?? [];
    list.push(m);
    feeders.set(m.nextMatchId, list);
  }
  // Tie-break ID: beberapa final ruangan (semua laga #1) bisa mengisi satu laga final.
  for (const list of feeders.values()) list.sort((a, b) => sortMatches(a, b) || a.id.localeCompare(b.id));
  return feeders;
}

/**
 * Slot tujuan pemenang tiap laga (auto-advance), memakai aturan yang sama
 * dengan `buildSlotLabels`: dua laga asal → yang lebih awal (babak, lalu
 * nomor laga) ke A, berikutnya ke B; satu laga asal → ke B (A milik unggulan).
 */
export function buildAdvanceMap(matches: MatchLink[]) {
  const advance = new Map<string, { matchId: string; side: "A" | "B" }>();
  for (const [matchId, sources] of groupFeeders(matches)) {
    sources.forEach((source, i) => {
      const side = sources.length === 2 && i === 0 ? "A" : "B";
      advance.set(source.id, { matchId, side });
    });
  }
  return advance;
}

/**
 * Label untuk slot peserta yang masih kosong, berdasarkan laga asal
 * (laga lain yang `nextMatchId`-nya menunjuk ke laga ini). Dua laga asal:
 * nomor kecil → slot A, nomor besar → slot B. Satu laga asal: laga asal
 * mengisi slot B. Laga final round-robin memakai `feedAId`/`feedBId`
 * (pemenang semifinal tertentu).
 */
export function buildSlotLabels(
  matches: (Match & { feedAId?: string | null; feedBId?: string | null })[],
  names?: { sessions: Map<string, { name: string }>; rooms: Map<string, { name: string }> },
) {
  const feeders = groupFeeders(matches);
  const byId = new Map(matches.map((m) => [m.id, m]));

  const fromMatch = (m: Match): SlotLabel => {
    // Juara ruangan yang masuk semifinal disebut asalnya, mis. "Juara S1 · Ruangan 2".
    if (m.round === LAST_ROOM_ROUND && names) {
      const session = names.sessions.get(m.sessionId)?.name.replace(/^Sesi /, "S") ?? "";
      const room = names.rooms.get(m.roomId)?.name ?? "";
      return { text: `Juara ${session} · ${room}`, live: m.status === "ongoing" };
    }
    // Label babak tanpa akhiran "Ruangan" supaya muat di kartu.
    return {
      text: `Pemenang ${roundLabel(m.round).replace(/ Ruangan$/, "")} #${m.matchNumber}`,
      live: m.status === "ongoing",
    };
  };
  const waiting: SlotLabel = { text: "Menunggu pemenang", live: false };
  const labels = new Map<string, SlotLabels>();
  for (const m of matches) {
    const feedA = m.feedAId ? byId.get(m.feedAId) : undefined;
    const feedB = m.feedBId ? byId.get(m.feedBId) : undefined;
    if (feedA || feedB) {
      labels.set(m.id, { a: feedA ? fromMatch(feedA) : waiting, b: feedB ? fromMatch(feedB) : waiting });
      continue;
    }
    const sources = feeders.get(m.id) ?? [];
    labels.set(m.id, {
      a: sources.length === 2 ? fromMatch(sources[0]) : waiting,
      b: sources.length >= 1 ? fromMatch(sources[sources.length - 1]) : waiting,
    });
  }
  return labels;
}

type CellSource = {
  sessions: { id: string; orderIndex?: number }[];
  rooms: { id: string; name: string }[];
  sessionRooms: { sessionId: string; roomId: string }[];
};

/**
 * Ruangan yang dipakai di tiap sesi (tiap pasangan = satu bagan 64 peserta),
 * urut sesi lalu nama ruangan.
 */
export function activeCells<D extends CellSource>(data: D): { session: D["sessions"][number]; room: D["rooms"][number] }[] {
  const sessionOrder = new Map(data.sessions.map((s, i) => [s.id, i]));
  const rooms = new Map(data.rooms.map((r) => [r.id, r]));
  return data.sessionRooms
    .filter((c) => sessionOrder.has(c.sessionId) && rooms.has(c.roomId))
    .map((c) => ({ session: data.sessions[sessionOrder.get(c.sessionId)!], room: rooms.get(c.roomId)! }))
    .sort(
      (a, b) =>
        sessionOrder.get(a.session.id)! - sessionOrder.get(b.session.id)! ||
        a.room.name.localeCompare(b.room.name, "id", { numeric: true }),
    );
}

/** Ruangan yang dipakai pada satu sesi. */
export function roomsInSession<D extends CellSource>(data: D, sessionId: string) {
  return activeCells(data)
    .filter((c) => c.session.id === sessionId)
    .map((c) => c.room);
}
