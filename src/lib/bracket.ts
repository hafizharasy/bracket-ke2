import type { Match } from "@/lib/types";

/**
 * Struktur turnamen:
 * - Babak ruangan (ronde 1–4): tiap kombinasi sesi × ruangan berisi 16 peserta
 *   → 15 pertandingan, menghasilkan 1 juara ruangan (4 × 10 = 40 juara).
 * - Babak final (ronde 5–10): 40 juara ruangan. 24 unggulan teratas langsung
 *   ke 32 besar; 16 sisanya main play-off (8 laga) untuk 8 tempat tersisa.
 */
export const PLAYERS_PER_ROOM = 16;
export const ROOM_ROUNDS = [1, 2, 3, 4] as const;
export const FINAL_ROUNDS = [5, 6, 7, 8, 9, 10] as const;
export const PLAYOFF_ROUND = 5;
export const LAST_ROOM_ROUND = 4;

const ROUND_LABELS: Record<number, string> = {
  1: "16 Besar Ruangan",
  2: "8 Besar Ruangan",
  3: "Semifinal Ruangan",
  4: "Final Ruangan",
  5: "Play-off",
  6: "32 Besar",
  7: "16 Besar",
  8: "Perempat Final",
  9: "Semifinal",
  10: "Final",
};

export function roundLabel(round: number) {
  return ROUND_LABELS[round] ?? `Babak ${round}`;
}

export function isFinalStage(match: Match) {
  return match.round >= PLAYOFF_ROUND;
}

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

/** Laga asal per laga tujuan (`nextMatchId`), terurut nomor laga. */
function groupFeeders<T extends MatchLink>(matches: T[]) {
  const feeders = new Map<string, T[]>();
  for (const m of matches) {
    if (!m.nextMatchId) continue;
    const list = feeders.get(m.nextMatchId) ?? [];
    list.push(m);
    feeders.set(m.nextMatchId, list);
  }
  for (const list of feeders.values()) list.sort(sortMatches);
  return feeders;
}

/**
 * Slot tujuan pemenang tiap laga (auto-advance), memakai aturan yang sama
 * dengan `buildSlotLabels`: dua laga asal → nomor kecil ke A, besar ke B;
 * satu laga asal → ke B.
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
 * nomor kecil → slot A, nomor besar → slot B. Satu laga asal (babak dengan
 * unggulan bye): laga asal mengisi slot B, slot A milik unggulan.
 */
export function buildSlotLabels(matches: Match[]) {
  const feeders = groupFeeders(matches);

  // Label babak tanpa akhiran "Ruangan" supaya muat di kartu.
  const fromMatch = (m: Match): SlotLabel => ({
    text: `Pemenang ${roundLabel(m.round).replace(/ Ruangan$/, "")} #${m.matchNumber}`,
    live: m.status === "ongoing",
  });
  const labels = new Map<string, SlotLabels>();
  for (const m of matches) {
    const sources = feeders.get(m.id) ?? [];
    // Play-off dan 32 besar diisi langsung oleh juara ruangan.
    const seedLabel: SlotLabel = {
      text:
        m.round === PLAYOFF_ROUND || m.round === PLAYOFF_ROUND + 1
          ? "Menunggu juara ruangan"
          : "Menunggu pemenang",
      live: false,
    };
    labels.set(m.id, {
      a: sources.length === 2 ? fromMatch(sources[0]) : seedLabel,
      b: sources.length >= 1 ? fromMatch(sources[sources.length - 1]) : seedLabel,
    });
  }
  return labels;
}
