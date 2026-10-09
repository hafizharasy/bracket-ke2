import type { BracketData, Match } from "@/lib/types";

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

export function sortMatches(a: Match, b: Match) {
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

/**
 * Sumber data bracket. Sementara memakai data tiruan; nanti diganti
 * dengan pemanggilan GET /bracket ke backend dengan bentuk data yang sama.
 */
export async function getBracket(): Promise<BracketData> {
  const { mockBracket } = await import("@/lib/mock/bracket-data");
  return mockBracket;
}
