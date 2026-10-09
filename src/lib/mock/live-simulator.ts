// Simulasi pembaruan live di atas data tiruan, menggantikan input pengawas
// sampai backend tersedia. State disimpan di memori proses server: tiap
// TICK_MS berlalu, satu langkah simulasi dijalankan (skor bertambah, laga
// selesai & pemenang maju, laga berikutnya dimulai). Dihitung saat diminta,
// jadi tidak butuh timer di server.

import { buildAdvanceMap } from "@/lib/bracket";
import { championSlots, mockBracket } from "@/lib/mock/bracket-data";
import type { BracketData, Match } from "@/lib/types";

const TICK_MS = 5_000;
/** Batas langkah yang dikejar sekaligus (mis. setelah server lama idle). */
const MAX_CATCH_UP = 12;
/** Kira-kira satu laga per ruangan berjalan bersamaan. */
const MAX_ONGOING = 10;

type Advance = { matchId: string; side: "A" | "B" };

const state: { data: BracketData; matches: Map<string, Match>; lastTick: number } = (() => {
  const data: BracketData = structuredClone(mockBracket);
  return { data, matches: new Map(data.matches.map((m) => [m.id, m])), lastTick: Date.now() };
})();

const advanceMap = new Map<string, Advance>([...buildAdvanceMap(state.data.matches), ...championSlots]);

function finish(match: Match) {
  let a = match.scoreA ?? 0;
  let b = match.scoreB ?? 0;
  if (a === b) {
    if (Math.random() < 0.5) a++;
    else b++;
  }
  match.scoreA = a;
  match.scoreB = b;
  match.winnerId = a > b ? match.participantAId : match.participantBId;
  match.status = "done";

  const target = advanceMap.get(match.id);
  const next = target && state.matches.get(target.matchId);
  if (next) {
    if (target.side === "A") next.participantAId = match.winnerId;
    else next.participantBId = match.winnerId;
  }
}

/**
 * Satu langkah: tiap laga berjalan mungkin mencetak poin atau selesai,
 * lalu laga terjadwal yang pesertanya sudah lengkap dimulai.
 */
function step() {
  const matches = state.data.matches;

  for (const match of matches.filter((m) => m.status === "ongoing")) {
    const total = (match.scoreA ?? 0) + (match.scoreB ?? 0);
    const roll = Math.random();
    if (total >= 4 && roll < 0.25) finish(match);
    else if (roll < 0.45) match.scoreA = (match.scoreA ?? 0) + 1;
    else if (roll < 0.65) match.scoreB = (match.scoreB ?? 0) + 1;
  }

  // Mulai laga terjadwal yang kedua pesertanya sudah ada, urut jadwal.
  const ready = matches
    .filter((m) => m.status === "scheduled" && m.participantAId && m.participantBId)
    .sort((x, y) => (x.scheduledAt ?? "").localeCompare(y.scheduledAt ?? "") || x.round - y.round);
  let running = matches.filter((m) => m.status === "ongoing").length;
  for (const match of ready) {
    if (running >= MAX_ONGOING) break;
    match.status = "ongoing";
    match.scoreA = 0;
    match.scoreB = 0;
    running++;
  }
}

export function getLiveMockBracket(): BracketData {
  const now = Date.now();
  const ticks = Math.min(Math.floor((now - state.lastTick) / TICK_MS), MAX_CATCH_UP);
  if (ticks > 0) {
    for (let i = 0; i < ticks; i++) step();
    state.lastTick = ticks === MAX_CATCH_UP ? now : state.lastTick + ticks * TICK_MS;
    state.data.updatedAt = new Date(now).toISOString();
  }
  // Salinan dangkal baru supaya React melihat perubahan di setiap render.
  return { ...state.data, matches: state.data.matches.map((m) => ({ ...m })) };
}
