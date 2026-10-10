// Simulasi pembaruan live di atas data tiruan, menggantikan input pengawas
// sampai backend tersedia. State disimpan di memori proses server: tiap
// TICK_MS berlalu, satu langkah simulasi dijalankan (skor bertambah, laga
// selesai & pemenang maju, laga berikutnya dimulai). Dihitung saat diminta,
// jadi tidak butuh timer di server.

import { FINAL_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { mockBracket } from "@/lib/mock/bracket-data";
import { createSimulation, finishMatch } from "@/lib/mock/simulate";
import type { BracketData, Match } from "@/lib/types";

const TICK_MS = 5_000;
/** Batas langkah yang dikejar sekaligus (mis. setelah server lama idle). */
const MAX_CATCH_UP = 12;
/** Kira-kira satu laga per ruangan berjalan bersamaan. */
const MAX_ONGOING = 10;

const state: { data: BracketData; matches: Map<string, Match>; lastTick: number } = (() => {
  const data: BracketData = structuredClone(mockBracket);
  return { data, matches: new Map(data.matches.map((m) => [m.id, m])), lastTick: Date.now() };
})();

const sim = createSimulation(state.data.matches);
const finish = (match: Match) => finishMatch(sim, match, Math.random);

/**
 * Satu langkah: tiap laga berjalan mungkin mencetak poin atau selesai,
 * lalu laga terjadwal yang pesertanya sudah lengkap dimulai.
 */
function step() {
  const matches = state.data.matches;

  for (const match of matches.filter((m) => m.status === "ongoing")) {
    const total = (match.scoreA ?? 0) + (match.scoreB ?? 0);
    const roll = Math.random();
    // Semifinal & final diselesaikan langsung (skor game / jenis kemenangan).
    if (match.round === SEMIFINAL_ROUND || match.round === FINAL_ROUND) {
      if (roll < 0.3) finish(match);
    } else if (total >= 4 && roll < 0.25) finish(match);
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
    const scored = match.round < SEMIFINAL_ROUND;
    match.scoreA = scored ? 0 : null;
    match.scoreB = scored ? 0 : null;
    running++;
  }
}

/** Versi simulasi saat ini (ikut memajukan simulasi bila waktunya tiba). */
export function getLiveMockVersion() {
  const { version, updatedAt } = getLiveMockBracket();
  return { version, updatedAt };
}

export function getLiveMockBracket(): BracketData {
  const now = Date.now();
  const ticks = Math.min(Math.floor((now - state.lastTick) / TICK_MS), MAX_CATCH_UP);
  if (ticks > 0) {
    for (let i = 0; i < ticks; i++) step();
    state.lastTick = ticks === MAX_CATCH_UP ? now : state.lastTick + ticks * TICK_MS;
    state.data.version += ticks;
    state.data.updatedAt = new Date(now).toISOString();
  }
  // Salinan dangkal baru supaya React melihat perubahan di setiap render.
  return { ...state.data, matches: state.data.matches.map((m) => ({ ...m })) };
}
