// Penyusun struktur bagan dari penempatan peserta (fungsi murni).
//
// - Babak ruangan (ronde 1–6): tiap ruangan yang dipakai di suatu sesi berisi
//   64 peserta → 63 laga, menghasilkan 1 juara ruangan.
// - Semifinal (ronde 7, best of 3): juara ruangan dipasangkan berurutan
//   (ruangan ke-1 vs ke-2, …); admin bisa mengubah pasangannya.
// - Final (ronde 8): double round-robin antar pemenang semifinal — tiap
//   pasangan bertemu dua kali, sekali sebagai tuan rumah (jalan pertama).

import { FINAL_ROUND, LAST_ROOM_ROUND, PLAYERS_PER_ROOM, SEMIFINAL_ROUND } from "@/lib/bracket";

export const MATCH_MINUTES = 10; // 7 menit + 3 menit injury time
export const ROUND_GAP_MINUTES = 15; // jeda antarbabak
/** Semifinal best of 3: sampai 3 game + jeda. */
const SEMIFINAL_MINUTES = 3 * MATCH_MINUTES + ROUND_GAP_MINUTES;

export type StructureInput = {
  sessions: { id: string; name: string; startTime: string | null }[];
  rooms: { id: string; name: string }[];
  /** Ruangan yang dipakai di tiap sesi. */
  sessionRooms: { sessionId: string; roomId: string }[];
  participants: { id: string; teamOrClub: string | null; sessionId: string | null; roomId: string | null }[];
  /** Jam mulai semifinal (ISO); default 150 menit setelah sesi terakhir dimulai. */
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
  feedAId: string | null;
  feedBId: string | null;
  scheduledAt: Date;
};

export type StructureSummary = {
  rooms: number;
  roomMatches: number;
  semifinalMatches: number;
  finalists: number;
  finalMatches: number;
  finalStart: string;
};

export type StructureResult = { ok: true; matches: StructureMatch[]; summary: StructureSummary } | { ok: false; errors: string[] };

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const roundsInRoom = Math.log2(PLAYERS_PER_ROOM);
const byNumber = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, "id", { numeric: true });

/**
 * Urutkan peserta satu ruangan supaya pasangan babak 1 (indeks 2k vs 2k+1)
 * sebisa mungkin dari sekolah berbeda: ambil bergiliran dari sekolah terbesar.
 */
export function spreadClubs<T extends { id: string; teamOrClub: string | null }>(players: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const p of [...players].sort(byNumber)) {
    const key = p.teamOrClub?.trim().toLowerCase() || `tanpa-sekolah:${p.id}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const order: T[] = [];
  let last: string | null = null;
  while (order.length < players.length) {
    const candidates = [...groups].filter(([, list]) => list.length > 0).sort((a, b) => b[1].length - a[1].length);
    // Jangan ambil sekolah yang sama dengan lawan di slot sebelumnya bila ada pilihan lain.
    const pairing = order.length % 2 === 1;
    const [key, list] = (pairing && candidates.find(([k]) => k !== last)) || candidates[0];
    order.push(list.shift()!);
    last = key;
  }
  return order;
}

/**
 * Jadwal double round-robin (metode lingkaran): daftar putaran, tiap putaran
 * berisi pasangan [tuan rumah, tamu] berupa indeks finalis. Putaran kedua
 * membalik tuan rumah/tamu, sehingga tiap pasangan bertemu dua kali.
 */
export function doubleRoundRobin(count: number): [number, number][][] {
  const players: (number | null)[] = Array.from({ length: count }, (_, i) => i);
  if (count % 2 === 1) players.push(null); // bye
  const n = players.length;
  const firstLeg: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = players[i];
      const b = players[n - 1 - i];
      if (a === null || b === null) continue;
      // Gilir tuan rumah supaya tiap finalis kebagian jalan pertama secara merata.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    firstLeg.push(pairs);
    players.splice(1, 0, players.pop()!); // putar semua kecuali posisi 0
  }
  return [...firstLeg, ...firstLeg.map((pairs) => pairs.map(([a, b]) => [b, a] as [number, number]))];
}

/** Susun seluruh laga (babak ruangan, semifinal, final) dengan tautan & jadwal. */
export function buildBracketStructure(input: StructureInput): StructureResult {
  const errors: string[] = [];
  const sessions = input.sessions;
  const rooms = [...input.rooms].sort(byNumber);
  const sessionIndex = new Map(sessions.map((s, i) => [s.id, i]));
  const roomIndex = new Map(rooms.map((r, i) => [r.id, i]));

  const cells = input.sessionRooms
    .filter((c) => sessionIndex.has(c.sessionId) && roomIndex.has(c.roomId))
    .sort((a, b) => sessionIndex.get(a.sessionId)! - sessionIndex.get(b.sessionId)! || roomIndex.get(a.roomId)! - roomIndex.get(b.roomId)!)
    .map((c) => ({ session: sessions[sessionIndex.get(c.sessionId)!], room: rooms[roomIndex.get(c.roomId)!] }));

  if (cells.length === 0) errors.push("Belum ada ruangan yang dipakai di sesi mana pun.");
  else if (cells.length < 4 || cells.length % 2 === 1) {
    errors.push(`Jumlah ruangan di semua sesi harus genap dan minimal 4 (juara ruangan dipasangkan di semifinal); saat ini ${cells.length}.`);
  }
  for (const { session } of cells) {
    if (!session.startTime && !errors.includes(`${session.name} belum punya jam mulai.`)) errors.push(`${session.name} belum punya jam mulai.`);
  }
  const playersOf = (sessionId: string, roomId: string) =>
    input.participants.filter((p) => p.sessionId === sessionId && p.roomId === roomId);
  for (const { session, room } of cells) {
    const n = playersOf(session.id, room.id).length;
    if (n !== PLAYERS_PER_ROOM) errors.push(`${session.name} · ${room.name}: ${n} peserta (harus ${PLAYERS_PER_ROOM}).`);
  }
  const active = new Set(cells.map((c) => `${c.session.id}|${c.room.id}`));
  const outside = input.participants.filter((p) => !p.sessionId || !p.roomId || !active.has(`${p.sessionId}|${p.roomId}`)).length;
  if (outside) errors.push(`${outside} peserta belum punya sesi/ruangan yang dipakai.`);
  if (errors.length) return { ok: false, errors };

  const matches: StructureMatch[] = [];
  const base = { feedAId: null, feedBId: null };
  const semifinalId = (k: number) => `m-sf-${k}`;

  // Babak ruangan; juara ruangan ke-k menuju semifinal ke-ceil(k/2).
  cells.forEach(({ session, room }, k) => {
    const prefix = `m-s${sessionIndex.get(session.id)! + 1}-r${roomIndex.get(room.id)! + 1}`;
    const order = spreadClubs(playersOf(session.id, room.id));
    const start = new Date(session.startTime!);
    for (let round = 1; round <= roundsInRoom; round++) {
      for (let n = 1; n <= PLAYERS_PER_ROOM / 2 ** round; n++) {
        matches.push({
          ...base,
          id: `${prefix}-b${round}-${n}`,
          sessionId: session.id,
          roomId: room.id,
          round,
          matchNumber: n,
          participantAId: round === 1 ? order[(n - 1) * 2].id : null,
          participantBId: round === 1 ? order[(n - 1) * 2 + 1].id : null,
          nextMatchId: round < LAST_ROOM_ROUND ? `${prefix}-b${round + 1}-${Math.ceil(n / 2)}` : semifinalId(Math.ceil((k + 1) / 2)),
          scheduledAt: addMinutes(start, (round - 1) * (MATCH_MINUTES + ROUND_GAP_MINUTES)),
        });
      }
    }
  });

  const lastSession = sessions.reduce((last, s) => (cells.some((c) => c.session.id === s.id) ? s : last), cells[0].session);
  const venues = cells.filter((c) => c.session.id === lastSession.id).map((c) => c.room);
  const venue = (i: number) => (venues.length ? venues : rooms)[i % (venues.length || rooms.length)].id;
  const semifinalStart = input.finalStart ? new Date(input.finalStart) : addMinutes(new Date(lastSession.startTime!), 150);
  const semifinals = cells.length / 2;
  for (let k = 1; k <= semifinals; k++) {
    matches.push({
      ...base,
      id: semifinalId(k),
      sessionId: lastSession.id,
      roomId: venue(k - 1),
      round: SEMIFINAL_ROUND,
      matchNumber: k,
      participantAId: null,
      participantBId: null,
      nextMatchId: null,
      scheduledAt: semifinalStart,
    });
  }

  // Final: finalis ke-i = pemenang semifinal ke-i.
  const finalStart = addMinutes(semifinalStart, SEMIFINAL_MINUTES);
  let matchNumber = 0;
  doubleRoundRobin(semifinals).forEach((pairs, round) => {
    pairs.forEach(([home, away], i) => {
      matches.push({
        id: `m-final-${home + 1}-${away + 1}`,
        sessionId: lastSession.id,
        roomId: venue(i),
        round: FINAL_ROUND,
        matchNumber: ++matchNumber,
        participantAId: null,
        participantBId: null,
        nextMatchId: null,
        feedAId: semifinalId(home + 1),
        feedBId: semifinalId(away + 1),
        scheduledAt: addMinutes(finalStart, round * (MATCH_MINUTES + ROUND_GAP_MINUTES)),
      });
    });
  });

  return {
    ok: true,
    matches,
    summary: {
      rooms: cells.length,
      roomMatches: cells.length * (PLAYERS_PER_ROOM - 1),
      semifinalMatches: semifinals,
      finalists: semifinals,
      finalMatches: matchNumber,
      finalStart: semifinalStart.toISOString(),
    },
  };
}
