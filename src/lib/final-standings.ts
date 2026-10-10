// Klasemen final round-robin (fungsi murni).

import { FINAL_ROUND, SEMIFINAL_ROUND, WIN_TYPES, type WinType } from "@/lib/bracket";
import type { Match } from "@/lib/types";

export type StandingRow = {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  /** Kemenangan telak 4 pion (pembanding terakhir). */
  fourInRow: number;
  points: number;
  /** Posisi 1, 2, …; sama untuk finalis yang masih seri setelah semua pembanding. */
  rank: number;
  /** Masih seri dengan finalis lain setelah head-to-head & jumlah menang → admin menentukan. */
  tied: boolean;
};

/** "3", "½", "2½" — poin klasemen dengan pecahan setengah. */
export function formatPoints(points: number) {
  const whole = Math.floor(points);
  const half = points - whole >= 0.5;
  return half ? (whole ? `${whole}½` : "½") : String(whole);
}

export function winPoints(winType: string | null | undefined) {
  return winType && winType in WIN_TYPES ? WIN_TYPES[winType as WinType].points : 0;
}

type FinalMatch = Pick<Match, "round" | "status" | "participantAId" | "participantBId" | "winnerId" | "winType">;

/**
 * Klasemen dari laga final yang sudah selesai. Urutan: poin, lalu poin
 * head-to-head di antara finalis yang seri, lalu jumlah kemenangan, lalu
 * kemenangan 4 pion. Finalis yang masih sama setelah itu ditandai `tied`.
 */
export function finalStandings(matches: FinalMatch[], finalists: string[]): StandingRow[] {
  const finals = matches.filter((m) => m.round === FINAL_ROUND && m.status === "done" && m.winnerId && m.participantAId && m.participantBId);
  const rows = new Map<string, StandingRow>(
    finalists.map((id) => [id, { participantId: id, played: 0, wins: 0, losses: 0, fourInRow: 0, points: 0, rank: 0, tied: false }]),
  );
  for (const m of finals) {
    for (const id of [m.participantAId!, m.participantBId!]) {
      const row = rows.get(id);
      if (!row) continue;
      row.played++;
      if (id === m.winnerId) {
        row.wins++;
        row.points += winPoints(m.winType);
        if (m.winType === "empat") row.fourInRow++;
      } else row.losses++;
    }
  }

  /** Poin yang diperoleh `id` dari laga melawan finalis dalam `group`. */
  const headToHead = (id: string, group: Set<string>) =>
    finals
      .filter((m) => m.winnerId === id && group.has(m.participantAId === id ? m.participantBId! : m.participantAId!))
      .reduce((sum, m) => sum + winPoints(m.winType), 0);

  const byPoints = [...rows.values()].sort((a, b) => b.points - a.points);
  const ordered: StandingRow[] = [];
  for (let i = 0; i < byPoints.length; ) {
    let j = i;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const group = byPoints.slice(i, j);
    const ids = new Set(group.map((r) => r.participantId));
    const key = (r: StandingRow) => [ids.size > 1 ? headToHead(r.participantId, ids) : 0, r.wins, r.fourInRow];
    group.sort((a, b) => {
      const [ka, kb] = [key(a), key(b)];
      return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
    });
    // Peringkat sama bila semua pembanding sama.
    group.forEach((row, g) => {
      const prev = group[g - 1];
      const same = prev && key(prev).every((v, n) => v === key(row)[n]);
      row.rank = same ? prev.rank : i + g + 1;
      if (same) prev.tied = row.tied = true;
    });
    ordered.push(...group);
    i = j;
  }
  return ordered;
}

type BracketMatch = FinalMatch & Pick<Match, "matchNumber">;

/** Finalis = pemenang semifinal (urut nomor semifinal), null bila belum selesai. */
export function finalistsOf(matches: BracketMatch[]) {
  return matches
    .filter((m) => m.round === SEMIFINAL_ROUND)
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map((m) => (m.status === "done" ? m.winnerId : null));
}

/**
 * Juara turnamen: peringkat 1 klasemen final setelah semua laga final
 * selesai dan tidak seri. Null selama belum ditentukan.
 */
export function tournamentChampion(matches: BracketMatch[]): string | null {
  const finals = matches.filter((m) => m.round === FINAL_ROUND);
  if (finals.length === 0 || finals.some((m) => m.status !== "done")) return null;
  const [top] = finalStandings(finals, finalistsOf(matches).filter((id): id is string => !!id));
  return top && !top.tied ? top.participantId : null;
}
