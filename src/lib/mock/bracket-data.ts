// Data tiruan bracket: 640 peserta di 10 ruangan-sesi (64 per ruangan).
// Sesi 1 & 2 memakai Ruangan 1–3, Sesi 3 & 4 memakai Ruangan 1–2.
// Struktur dari generator yang sama dengan database (buildBracketStructure);
// hasil disimulasikan deterministik (seeded) supaya tampilan konsisten.
// Kondisi: Sesi 1–2 selesai, Sesi 3 sedang berjalan, Sesi 4, semifinal, dan
// final belum dimulai.

import { buildBracketStructure } from "@/lib/bracket-structure";
import { createSimulation, finishMatch } from "@/lib/mock/simulate";
import type { BracketData, Match, Participant, Room, Session, SessionRoom } from "@/lib/types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(2026);
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

const FIRST_NAMES = [
  "Adi", "Bayu", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hana", "Indra",
  "Joko", "Kirana", "Lukman", "Maya", "Nanda", "Oki", "Putri", "Raka",
  "Sari", "Teguh", "Umar", "Vina", "Wahyu", "Yoga", "Zahra", "Arif", "Bunga",
  "Dewi", "Rizky", "Fikri", "Laras",
] as const;
const LAST_NAMES = [
  "Pratama", "Saputra", "Wijaya", "Lestari", "Nugroho", "Hidayat", "Kusuma",
  "Siregar", "Santoso", "Rahman", "Permata", "Setiawan", "Utami", "Halim",
  "Maulana", "Anggraini", "Firmansyah", "Ramadhan", "Purnama", "Syahputra",
] as const;
const SCHOOLS = [
  "SMAN 1 Jakarta", "SMAN 3 Bandung", "SMAN 5 Surabaya", "SMAN 1 Medan", "SMAN 2 Makassar",
  "SMAN 8 Yogyakarta", "SMAN 3 Semarang", "SMAN 1 Malang", "SMAN 4 Denpasar", "SMK Negeri 2 Bogor",
] as const;

const SESSION_STARTS = [
  "2026-10-17T08:00:00+07:00",
  "2026-10-17T10:30:00+07:00",
  "2026-10-17T13:00:00+07:00",
  "2026-10-17T15:30:00+07:00",
];
/** Ruangan dipakai per sesi: [jumlah ruangan] — total 10 ruangan-sesi. */
const ROOMS_PER_SESSION = [3, 3, 2, 2];
const ROOM_COUNT = 3;
const PLAYERS_PER_ROOM = 64;

const sessions: Session[] = SESSION_STARTS.map((startTime, i) => ({
  id: `sesi-${i + 1}`,
  name: `Sesi ${i + 1}`,
  orderIndex: i + 1,
  startTime: new Date(startTime).toISOString(),
}));

const rooms: Room[] = Array.from({ length: ROOM_COUNT }, (_, i) => ({
  id: `ruangan-${i + 1}`,
  name: `Ruangan ${i + 1}`,
  location: `Gedung A · Lantai ${i + 1}`,
}));

const sessionRooms: SessionRoom[] = sessions.flatMap((s, i) =>
  rooms.slice(0, ROOMS_PER_SESSION[i]).map((r) => ({ sessionId: s.id, roomId: r.id })),
);

const participants: Participant[] = sessionRooms.flatMap(({ sessionId, roomId }, cell) =>
  Array.from({ length: PLAYERS_PER_ROOM }, (_, k) => ({
    id: `p-${String(cell * PLAYERS_PER_ROOM + k + 1).padStart(3, "0")}`,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    teamOrClub: pick(SCHOOLS),
    sessionId,
    roomId,
  })),
);

const structure = buildBracketStructure({ sessions, rooms, sessionRooms, participants });
if (!structure.ok) throw new Error(`Data tiruan tidak valid: ${structure.errors.join("; ")}`);

const matches: Match[] = structure.matches.map((m) => ({
  ...m,
  winnerId: null,
  scoreA: null,
  scoreB: null,
  status: "scheduled",
  winType: null,
  scheduledAt: m.scheduledAt.toISOString(),
}));

// Simulasikan hasil: Sesi 1–2 selesai; Sesi 3 babak 1–3 selesai, babak 4 berjalan.
const sim = createSimulation(matches);
const sessionNumber = (m: Match) => Number(m.sessionId.split("-")[1]);
for (const match of [...matches].sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber)) {
  if (match.round > 6) continue;
  const s = sessionNumber(match);
  if (s <= 2 || (s === 3 && match.round <= 3)) finishMatch(sim, match, rand);
  else if (s === 3 && match.round === 4 && match.participantAId && match.participantBId) {
    match.status = "ongoing";
    match.scoreA = Math.floor(rand() * 4);
    match.scoreB = Math.floor(rand() * 4);
  }
}

export const mockBracket: BracketData = {
  sessions,
  rooms,
  sessionRooms,
  participants,
  matches,
  version: 0,
  updatedAt: "2026-10-17T14:05:00+07:00",
};
