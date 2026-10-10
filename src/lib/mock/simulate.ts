// Pembantu simulasi hasil untuk data tiruan & simulasi live (mengikuti aturan
// tiap babak, lalu memajukan pemenang lewat nextMatchId dan feedAId/feedBId).

import { buildAdvanceMap, FINAL_ROUND, SEMIFINAL_ROUND, SEMIFINAL_WINS, WIN_TYPE_KEYS } from "@/lib/bracket";
import type { Match } from "@/lib/types";

export type Simulation = {
  matches: Map<string, Match>;
  advance: ReturnType<typeof buildAdvanceMap>;
  /** Laga final yang slotnya diisi pemenang laga ini (semifinal). */
  feeds: Map<string, { match: Match; side: "A" | "B" }[]>;
};

export function createSimulation(list: Match[]): Simulation {
  const matches = new Map(list.map((m) => [m.id, m]));
  const feeds = new Map<string, { match: Match; side: "A" | "B" }[]>();
  for (const m of list) {
    for (const [source, side] of [[m.feedAId, "A"], [m.feedBId, "B"]] as const) {
      if (source) feeds.set(source, [...(feeds.get(source) ?? []), { match: m, side }]);
    }
  }
  return { matches, advance: buildAdvanceMap(list), feeds };
}

/** Selesaikan laga dengan hasil acak sesuai babaknya, lalu majukan pemenang. */
export function finishMatch(sim: Simulation, match: Match, rand: () => number) {
  if (match.round === FINAL_ROUND) {
    match.winnerId = rand() < 0.5 ? match.participantAId : match.participantBId;
    match.winType = WIN_TYPE_KEYS[Math.floor(rand() * WIN_TYPE_KEYS.length)];
    match.scoreA = null;
    match.scoreB = null;
  } else if (match.round === SEMIFINAL_ROUND) {
    const loser = rand() < 0.5 ? 0 : 1;
    const aWins = rand() < 0.5;
    match.scoreA = aWins ? SEMIFINAL_WINS : loser;
    match.scoreB = aWins ? loser : SEMIFINAL_WINS;
    match.winnerId = aWins ? match.participantAId : match.participantBId;
  } else {
    let a = match.scoreA ?? Math.floor(rand() * 8);
    let b = match.scoreB ?? Math.floor(rand() * 8);
    if (a === b) {
      if (rand() < 0.5) a++;
      else b++;
    }
    match.scoreA = a;
    match.scoreB = b;
    match.winnerId = a > b ? match.participantAId : match.participantBId;
  }
  match.status = "done";

  const target = sim.advance.get(match.id);
  const next = target && sim.matches.get(target.matchId);
  if (next) {
    if (target.side === "A") next.participantAId = match.winnerId;
    else next.participantBId = match.winnerId;
  }
  for (const { match: final, side } of sim.feeds.get(match.id) ?? []) {
    if (side === "A") final.participantAId = match.winnerId;
    else final.participantBId = match.winnerId;
  }
}
