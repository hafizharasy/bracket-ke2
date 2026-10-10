// Penyusun struktur bagan dari penempatan peserta (fungsi murni).
//
// Babak ruangan (ronde 1–4): tiap sesi × ruangan berisi 16 peserta → 15 laga.
// Babak final: juara ruangan masuk 32 besar. Bila juara > 32, sisanya main
// play-off (ronde 5): juara paling awal (urutan sesi, lalu ruangan) mendapat
// bye langsung ke 32 besar, yang lain main play-off. Contoh 4 × 10 = 40 juara:
// 24 bye + 16 pemain play-off (8 laga) → 32 besar.

import { LAST_ROOM_ROUND, PLAYERS_PER_ROOM, PLAYOFF_ROUND } from "@/lib/bracket";

export const MATCH_MINUTES = 10; // 7 menit + 3 menit injury time
export const ROUND_GAP_MINUTES = 15; // jeda antarbabak
const FINAL_SLOTS = 32;
const LAST_ROUND = 10;

export type StructureInput = {
  sessions: { id: string; name: string; startTime: string | null }[];
  rooms: { id: string; name: string }[];
  participants: { id: string; teamOrClub: string | null; sessionId: string | null; roomId: string | null }[];
  /** Jam mulai babak final (ISO); default 150 menit setelah sesi terakhir dimulai. */
  finalStart?: string;
};

export type StructureMatch = {
  id: string;
  sessionId: string;
  roomId: string;
  round: number;
  matchNumber: number;
  participantAId: string | null;
  participantBId: string | null;
  nextMatchId: string | null;
  scheduledAt: Date;
};

export type StructureResult =
  | { ok: true; matches: StructureMatch[]; summary: { roomMatches: number; finalMatches: number; byes: number; playoffMatches: number; finalStart: string } }
  | { ok: false; errors: string[] };

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const slotMinutes = (round: number) => (round - 1) * (MATCH_MINUTES + ROUND_GAP_MINUTES);

/**
 * Urutkan peserta satu ruangan supaya pasangan babak 1 (indeks 2k vs 2k+1)
 * sebisa mungkin dari klub berbeda: ambil bergiliran dari klub terbesar.
 */
export function spreadClubs<T extends { id: string; teamOrClub: string | null }>(players: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const p of [...players].sort((a, b) => a.id.localeCompare(b.id, "id", { numeric: true }))) {
    const key = p.teamOrClub ?? `tanpa-klub:${p.id}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const order: T[] = [];
  let last: string | null = null;
  while (order.length < players.length) {
    const candidates = [...groups].filter(([, list]) => list.length > 0).sort((a, b) => b[1].length - a[1].length);
    // Jangan ambil klub yang sama dengan lawan di slot sebelumnya (posisi ganjil) bila ada pilihan lain.
    const pairing = order.length % 2 === 1;
    const [key, list] = (pairing && candidates.find(([k]) => k !== last)) || candidates[0];
    order.push(list.shift()!);
    last = key;
  }
  return order;
}

/** Susun seluruh laga (babak ruangan + babak final) dengan tautan nextMatchId & jadwal. */
export function buildBracketStructure(input: StructureInput): StructureResult {
  const errors: string[] = [];
  const { sessions, rooms } = input;
  if (sessions.length === 0) errors.push("Belum ada sesi.");
  if (rooms.length === 0) errors.push("Belum ada ruangan.");
  for (const s of sessions) if (!s.startTime) errors.push(`${s.name} belum punya jam mulai.`);

  const cells = sessions.flatMap((s, si) => rooms.map((r, ri) => ({ s, r, si, ri })));
  const champions = cells.length;
  const playoffMatches = champions - FINAL_SLOTS;
  if (champions > 0 && (playoffMatches < 0 || playoffMatches > FINAL_SLOTS / 2)) {
    errors.push(`Format babak final butuh ${FINAL_SLOTS}–${FINAL_SLOTS + FINAL_SLOTS / 2} juara ruangan (sesi × ruangan); saat ini ${champions}.`);
  }
  const playersOf = (sessionId: string, roomId: string) =>
    input.participants.filter((p) => p.sessionId === sessionId && p.roomId === roomId);
  for (const { s, r } of cells) {
    const n = playersOf(s.id, r.id).length;
    if (n !== PLAYERS_PER_ROOM) errors.push(`${s.name} · ${r.name}: ${n} peserta (harus ${PLAYERS_PER_ROOM}).`);
  }
  const unplaced = input.participants.filter((p) => !p.sessionId || !p.roomId).length;
  if (unplaced) errors.push(`${unplaced} peserta belum punya sesi/ruangan.`);
  if (errors.length) return { ok: false, errors };

  const matches: StructureMatch[] = [];
  const championMatch: string[] = []; // urutan sesi lalu ruangan
  for (const { s, r, si, ri } of cells) {
    const prefix = `m-s${si + 1}-r${ri + 1}`;
    const order = spreadClubs(playersOf(s.id, r.id));
    const start = new Date(s.startTime!);
    for (let round = 1; round <= LAST_ROOM_ROUND; round++) {
      for (let n = 1; n <= PLAYERS_PER_ROOM / 2 ** round; n++) {
        matches.push({
          id: `${prefix}-b${round}-${n}`,
          sessionId: s.id,
          roomId: r.id,
          round,
          matchNumber: n,
          participantAId: round === 1 ? order[(n - 1) * 2].id : null,
          participantBId: round === 1 ? order[(n - 1) * 2 + 1].id : null,
          nextMatchId: round < LAST_ROOM_ROUND ? `${prefix}-b${round + 1}-${Math.ceil(n / 2)}` : null,
          scheduledAt: addMinutes(start, slotMinutes(round)),
        });
      }
    }
    championMatch.push(`${prefix}-b${LAST_ROOM_ROUND}-1`);
  }

  const lastSession = sessions.at(-1)!;
  const finalStart = input.finalStart ? new Date(input.finalStart) : addMinutes(new Date(lastSession.startTime!), 150);
  const roomFinal = new Map(matches.filter((m) => m.round === LAST_ROOM_ROUND).map((m) => [m.id, m]));
  const finalId = (round: number, n: number) => `m-final-b${round}-${n}`;
  let roomCursor = 0;
  const finalMatch = (round: number, n: number, nextMatchId: string | null): StructureMatch => ({
    id: finalId(round, n),
    sessionId: lastSession.id,
    roomId: rooms[roomCursor++ % rooms.length].id,
    round,
    matchNumber: n,
    participantAId: null,
    participantBId: null,
    nextMatchId,
    scheduledAt: addMinutes(finalStart, (round - PLAYOFF_ROUND) * (MATCH_MINUTES + ROUND_GAP_MINUTES)),
  });

  // 32 besar menerima pemenang play-off di slot B laga yang disebar merata
  // (8 play-off → laga 1, 3, 5, …, 15); slot lain diisi juara ber-bye.
  const roundOf32 = FINAL_SLOTS / 2;
  const playoffTarget = Array.from({ length: playoffMatches }, (_, i) => Math.floor((i * roundOf32) / playoffMatches) + 1);
  const byes = championMatch.slice(0, FINAL_SLOTS - playoffMatches);
  const playoffPlayers = championMatch.slice(FINAL_SLOTS - playoffMatches);
  const finals: StructureMatch[] = [];
  playoffTarget.forEach((target, i) => {
    finals.push(finalMatch(PLAYOFF_ROUND, i + 1, finalId(PLAYOFF_ROUND + 1, target)));
    roomFinal.get(playoffPlayers[i * 2])!.nextMatchId = finalId(PLAYOFF_ROUND, i + 1);
    roomFinal.get(playoffPlayers[i * 2 + 1])!.nextMatchId = finalId(PLAYOFF_ROUND, i + 1);
  });
  let byeCursor = 0;
  for (let round = PLAYOFF_ROUND + 1; round <= LAST_ROUND; round++) {
    const count = 2 ** (LAST_ROUND - round);
    for (let n = 1; n <= count; n++) {
      finals.push(finalMatch(round, n, round < LAST_ROUND ? finalId(round + 1, Math.ceil(n / 2)) : null));
      if (round === PLAYOFF_ROUND + 1) {
        // Slot A selalu juara ber-bye; slot B juara ber-bye bila tidak menerima pemenang play-off.
        const seats = playoffTarget.includes(n) ? 1 : 2;
        for (let k = 0; k < seats; k++) roomFinal.get(byes[byeCursor++])!.nextMatchId = finalId(round, n);
      }
    }
  }

  return {
    ok: true,
    matches: [...matches, ...finals],
    summary: {
      roomMatches: matches.length,
      finalMatches: finals.length,
      byes: byes.length,
      playoffMatches,
      finalStart: finalStart.toISOString(),
    },
  };
}
