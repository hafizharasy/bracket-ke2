// Data tiruan bracket untuk 640 peserta (4 sesi × 10 ruangan × 16 peserta).
// Deterministik (seeded) supaya tampilan konsisten antar render.
// Kondisi yang disimulasikan: Sesi 1–2 selesai, Sesi 3 sedang berjalan,
// Sesi 4 dan babak final belum dimulai.

import {
  FINAL_ROUNDS,
  LAST_ROOM_ROUND,
  PLAYERS_PER_ROOM,
  PLAYOFF_ROUND,
} from "@/lib/bracket";
import type {
  BracketData,
  Match,
  MatchStatus,
  Participant,
  Room,
  Session,
} from "@/lib/types";

const SESSION_COUNT = 4;
const ROOM_COUNT = 10;
const MATCH_MINUTES = 10; // 7 menit + 3 menit injury time
const ROUND_GAP_MINUTES = 15; // jeda antarbabak

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
const CLUBS = [
  "LRP Jakarta", "LRP Bandung", "LRP Surabaya", "LRP Medan", "LRP Makassar",
  "LRP Yogyakarta", "LRP Semarang", "LRP Malang", "LRP Bali", null,
] as const;

const SESSION_STARTS = [
  "2026-10-17T08:00:00+07:00",
  "2026-10-17T10:30:00+07:00",
  "2026-10-17T13:00:00+07:00",
  "2026-10-17T15:30:00+07:00",
];
const FINAL_START = "2026-10-17T18:00:00+07:00";

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

const sessions: Session[] = Array.from({ length: SESSION_COUNT }, (_, i) => ({
  id: `sesi-${i + 1}`,
  name: `Sesi ${i + 1}`,
  orderIndex: i + 1,
  startTime: SESSION_STARTS[i],
}));

const rooms: Room[] = Array.from({ length: ROOM_COUNT }, (_, i) => ({
  id: `ruangan-${i + 1}`,
  name: `Ruangan ${i + 1}`,
  location: `Gedung ${i < 5 ? "A" : "B"} · Lantai ${(i % 5) + 1}`,
}));

const participants: Participant[] = [];
for (let s = 0; s < SESSION_COUNT; s++) {
  for (let r = 0; r < ROOM_COUNT; r++) {
    for (let k = 0; k < PLAYERS_PER_ROOM; k++) {
      const n = participants.length + 1;
      participants.push({
        id: `p-${String(n).padStart(3, "0")}`,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        teamOrClub: pick(CLUBS),
        sessionId: sessions[s].id,
        roomId: rooms[r].id,
      });
    }
  }
}

/** Skor acak tanpa seri; pemenang ditentukan dari skor. */
function playScores(match: Match) {
  let a = Math.floor(rand() * 8);
  let b = Math.floor(rand() * 8);
  if (a === b) {
    if (rand() < 0.5) a++;
    else b++;
  }
  match.scoreA = a;
  match.scoreB = b;
  match.winnerId = a > b ? match.participantAId : match.participantBId;
  match.status = "done";
}

function placeWinner(matches: Map<string, Match>, match: Match) {
  if (!match.nextMatchId || !match.winnerId) return;
  const next = matches.get(match.nextMatchId)!;
  // Pemenang laga ganjil mengisi slot A, laga genap mengisi slot B.
  if (match.matchNumber % 2 === 1) next.participantAId = match.winnerId;
  else next.participantBId = match.winnerId;
}

/** Status simulasi untuk tiap babak ruangan di Sesi 3 (sedang berjalan). */
function session3Status(round: number, roomIndex: number, matchNumber: number): MatchStatus {
  if (round <= 2) return "done";
  if (round === 3) return roomIndex < 5 && matchNumber === 1 ? "done" : "ongoing";
  return "scheduled";
}

const matchMap = new Map<string, Match>();
const roomChampionMatch: string[][] = []; // [sesi][ruangan] → id laga final ruangan

for (let s = 0; s < SESSION_COUNT; s++) {
  roomChampionMatch[s] = [];
  for (let r = 0; r < ROOM_COUNT; r++) {
    const prefix = `m-s${s + 1}-r${r + 1}`;
    const roomPlayers = participants.slice(
      (s * ROOM_COUNT + r) * PLAYERS_PER_ROOM,
      (s * ROOM_COUNT + r + 1) * PLAYERS_PER_ROOM,
    );

    for (let round = 1; round <= LAST_ROOM_ROUND; round++) {
      const count = PLAYERS_PER_ROOM / 2 ** round;
      for (let n = 1; n <= count; n++) {
        const match: Match = {
          id: `${prefix}-b${round}-${n}`,
          round,
          matchNumber: n,
          sessionId: sessions[s].id,
          roomId: rooms[r].id,
          participantAId: round === 1 ? roomPlayers[(n - 1) * 2].id : null,
          participantBId: round === 1 ? roomPlayers[(n - 1) * 2 + 1].id : null,
          winnerId: null,
          scoreA: null,
          scoreB: null,
          status: "scheduled",
          nextMatchId:
            round < LAST_ROOM_ROUND ? `${prefix}-b${round + 1}-${Math.ceil(n / 2)}` : null,
          scheduledAt: addMinutes(
            SESSION_STARTS[s],
            (round - 1) * (MATCH_MINUTES + ROUND_GAP_MINUTES),
          ),
        };
        matchMap.set(match.id, match);
      }
    }
    roomChampionMatch[s][r] = `${prefix}-b${LAST_ROOM_ROUND}-1`;
  }
}

// Babak final: 24 juara (Sesi 1, Sesi 2, Sesi 3 Ruangan 1–4) langsung ke 32 besar,
// 16 juara (Sesi 3 Ruangan 5–10, Sesi 4) main play-off. Pemetaan slot ini sementara,
// nanti diatur admin lewat fitur "Susun Pasangan Tanding".
const byeSources: string[] = [];
const playoffSources: string[] = [];
for (let s = 0; s < SESSION_COUNT; s++) {
  for (let r = 0; r < ROOM_COUNT; r++) {
    const target = s < 2 || (s === 2 && r < 4) ? byeSources : playoffSources;
    target.push(roomChampionMatch[s][r]);
  }
}

/** Laga babak ruangan yang juaranya menempati slot tertentu di babak final. */
const finalSlotSource = new Map<string, string>(); // `${matchId}:A|B` → id laga sumber

let finalSlot = 0;
for (const round of FINAL_ROUNDS) {
  const count = round === PLAYOFF_ROUND ? 8 : 2 ** (10 - round);
  for (let n = 1; n <= count; n++) {
    const id = `m-final-b${round}-${n}`;
    let nextMatchId: string | null = null;
    if (round === PLAYOFF_ROUND) {
      // Pemenang play-off ke-n mengisi slot B laga 32 besar ke-(2n-1).
      nextMatchId = `m-final-b${round + 1}-${2 * n - 1}`;
      finalSlotSource.set(`${id}:A`, playoffSources[(n - 1) * 2]);
      finalSlotSource.set(`${id}:B`, playoffSources[(n - 1) * 2 + 1]);
    } else if (round < 10) {
      nextMatchId = `m-final-b${round + 1}-${Math.ceil(n / 2)}`;
    }
    if (round === PLAYOFF_ROUND + 1) {
      finalSlotSource.set(`${id}:A`, byeSources.shift()!);
      if (n % 2 === 0) finalSlotSource.set(`${id}:B`, byeSources.shift()!);
    }
    matchMap.set(id, {
      id,
      round,
      matchNumber: n,
      sessionId: sessions[SESSION_COUNT - 1].id,
      roomId: rooms[finalSlot++ % ROOM_COUNT].id,
      participantAId: null,
      participantBId: null,
      winnerId: null,
      scoreA: null,
      scoreB: null,
      status: "scheduled",
      nextMatchId,
      scheduledAt: addMinutes(FINAL_START, (round - PLAYOFF_ROUND) * (MATCH_MINUTES + ROUND_GAP_MINUTES)),
    });
  }
}

// Simulasikan hasil babak ruangan.
const sorted = [...matchMap.values()].sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
for (const match of sorted) {
  if (match.round > LAST_ROOM_ROUND) continue;
  const sessionIndex = Number(match.sessionId.split("-")[1]) - 1;
  const roomIndex = Number(match.roomId.split("-")[1]) - 1;

  let status: MatchStatus = "scheduled";
  if (sessionIndex < 2) status = "done";
  else if (sessionIndex === 2) status = session3Status(match.round, roomIndex, match.matchNumber);

  if (status === "done") {
    playScores(match);
    placeWinner(matchMap, match);
  } else if (status === "ongoing") {
    match.status = "ongoing";
    match.scoreA = Math.floor(rand() * 4);
    match.scoreB = Math.floor(rand() * 4);
  }
}

// Isi slot babak final dari juara ruangan yang sudah ada.
for (const [slot, sourceId] of finalSlotSource) {
  const [matchId, side] = slot.split(":");
  const champion = matchMap.get(sourceId)!.winnerId;
  if (!champion) continue;
  const match = matchMap.get(matchId)!;
  if (side === "A") match.participantAId = champion;
  else match.participantBId = champion;
}

/** Laga final ruangan → slot babak final yang diisi juaranya (dipakai simulasi live). */
export const championSlots = new Map<string, { matchId: string; side: "A" | "B" }>();
for (const [slot, sourceId] of finalSlotSource) {
  const [matchId, side] = slot.split(":");
  championSlots.set(sourceId, { matchId, side: side as "A" | "B" });
}

export const mockBracket: BracketData = {
  sessions,
  rooms,
  participants,
  matches: [...matchMap.values()],
  updatedAt: "2026-10-17T14:05:00+07:00",
};
