import { describe, expect, it } from "vitest";

import { buildAdvanceMap, buildSlotLabels, FINAL_ROUND, LAST_ROOM_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { buildBracketStructure, doubleRoundRobin, isByeMatch, roundOneSlots, sideMatchNumber, spreadClubs } from "@/lib/bracket-structure";
import { mockBracket } from "@/lib/mock/bracket-data";

const input = {
  sessions: mockBracket.sessions,
  rooms: mockBracket.rooms,
  sessionRooms: mockBracket.sessionRooms,
  participants: mockBracket.participants,
};

describe("buildBracketStructure", () => {
  it("10 ruangan-sesi × 64 peserta: 630 laga ruangan, 5 semifinal, 20 laga final; tautan & jadwal sama dengan data contoh", () => {
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.summary).toMatchObject({ rooms: 10, roomMatches: 630, semifinalMatches: 5, finalists: 5, finalMatches: 20 });
    const expected = new Map(mockBracket.matches.map((m) => [m.id, m]));
    expect(result.matches).toHaveLength(expected.size);
    for (const m of result.matches) {
      const e = expected.get(m.id)!;
      expect([m.id, m.nextMatchId, m.feedAId, m.feedBId]).toEqual([e.id, e.nextMatchId, e.feedAId ?? null, e.feedBId ?? null]);
      expect(m.scheduledAt.toISOString()).toBe(e.scheduledAt);
    }
  });

  it("tiap ruangan 63 laga; dua final ruangan per semifinal; final round-robin bertemu dua kali dengan tuan rumah bergantian", () => {
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error();
    const perCell = new Map<string, number>();
    for (const m of result.matches.filter((x) => x.round <= LAST_ROOM_ROUND)) {
      perCell.set(`${m.sessionId}:${m.roomId}`, (perCell.get(`${m.sessionId}:${m.roomId}`) ?? 0) + 1);
    }
    expect([...perCell.values()]).toEqual(Array(10).fill(63));

    const advance = buildAdvanceMap(result.matches);
    for (const sf of result.matches.filter((m) => m.round === SEMIFINAL_ROUND)) {
      const sources = result.matches.filter((s) => s.nextMatchId === sf.id);
      expect(sources.map((s) => s.round)).toEqual([LAST_ROOM_ROUND, LAST_ROOM_ROUND]);
      expect(sources.map((s) => advance.get(s.id)!.side).sort()).toEqual(["A", "B"]);
    }

    const finals = result.matches.filter((m) => m.round === FINAL_ROUND);
    const meetings = new Map<string, string[]>();
    for (const f of finals) {
      const key = [f.feedAId, f.feedBId].sort().join("|");
      meetings.set(key, [...(meetings.get(key) ?? []), f.feedAId!]);
    }
    expect(meetings.size).toBe(10); // C(5,2)
    for (const hosts of meetings.values()) expect(new Set(hosts).size).toBe(2);

    const labels = buildSlotLabels(
      result.matches.map((m) => ({ ...m, winnerId: null, scoreA: null, scoreB: null, status: "scheduled" as const, scheduledAt: m.scheduledAt.toISOString() })),
    );
    expect(labels.get(finals[0].id)?.a.text).toMatch(/Semifinal/);
  });

  it("pasangan babak 1 berisi 64 peserta ruangan masing-masing, sebisa mungkin beda sekolah", () => {
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error();
    const people = new Map(mockBracket.participants.map((p) => [p.id, p]));
    const roundOne = result.matches.filter((m) => m.round === 1);
    expect(roundOne).toHaveLength(320);
    expect(new Set(roundOne.flatMap((m) => [m.participantAId, m.participantBId])).size).toBe(640);
    for (const m of roundOne) {
      const a = people.get(m.participantAId!)!;
      expect(a.sessionId).toBe(m.sessionId);
      expect(a.roomId).toBe(m.roomId);
    }
    const sameSchool = roundOne.filter((m) => {
      const a = people.get(m.participantAId!)!.teamOrClub;
      return a !== null && a === people.get(m.participantBId!)!.teamOrClub;
    }).length;
    expect(sameSchool).toBe(0);
  });

  it("menolak penempatan yang belum lengkap, sesi tanpa jam, dan jumlah ruangan-sesi ganjil", () => {
    const participants = mockBracket.participants.map((p, i) => (i === 0 ? { ...p, roomId: null } : p));
    const sessions = mockBracket.sessions.map((s, i) => (i === 1 ? { ...s, startTime: null } : s));
    const result = buildBracketStructure({ ...input, participants, sessions });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Sesi 2 belum punya jam mulai.",
        "1 peserta belum punya sesi/ruangan yang dipakai.",
      ]),
    );
    const odd = buildBracketStructure({ ...input, sessionRooms: mockBracket.sessionRooms.slice(1) });
    expect(odd.ok === false && odd.errors[0]).toMatch(/genap dan minimal 4/);
  });
});

describe("bagan dua sisi", () => {
  it("laga ganjil di sisi kiri, genap di sisi kanan; laga sesama sisi bertemu, kedua sisi bertemu di final ruangan", () => {
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const cell = result.matches.filter((m) => m.sessionId === "sesi-1" && m.roomId === "ruangan-1");
    const byId = new Map(cell.map((m) => [m.id, m]));
    const next = (round: number, n: number) => byId.get(cell.find((m) => m.round === round && m.matchNumber === n)!.nextMatchId!)!;
    // Babak 1 → 2: Laga 1 & 3 → #1, Laga 5 & 7 → #3, Laga 2 & 4 → #2, Laga 30 & 32 → #16.
    expect([1, 3, 5, 7, 2, 4, 30, 32].map((n) => next(1, n).matchNumber)).toEqual([1, 1, 3, 3, 2, 2, 16, 16]);
    // Tiap laga hanya menerima pemenang dari sisi yang sama (paritas nomor sama), kecuali final ruangan.
    for (const m of cell.filter((x) => x.round < LAST_ROOM_ROUND - 1)) {
      expect(next(m.round, m.matchNumber).matchNumber % 2).toBe(m.matchNumber % 2);
    }
    const final = cell.find((m) => m.round === LAST_ROOM_ROUND)!;
    expect(cell.filter((m) => m.nextMatchId === final.id).map((m) => m.matchNumber).sort()).toEqual([1, 2]);
    expect(sideMatchNumber(0, 32)).toBe(1);
    expect(sideMatchNumber(15, 32)).toBe(31);
    expect(sideMatchNumber(16, 32)).toBe(2);
    expect(sideMatchNumber(31, 32)).toBe(32);
  });
});

describe("bye (ruangan kurang dari 64 peserta)", () => {
  it("60 peserta: 4 bye tersebar, tiap bye berpasangan dengan peserta; pesertanya langsung di babak 2", () => {
    const cut = new Set(mockBracket.participants.filter((p) => p.sessionId === "sesi-1" && p.roomId === "ruangan-1").slice(0, 4).map((p) => p.id));
    const result = buildBracketStructure({ ...input, participants: mockBracket.participants.filter((p) => !cut.has(p.id)) });
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const cell = result.matches.filter((m) => m.sessionId === "sesi-1" && m.roomId === "ruangan-1");
    const r1 = cell.filter((m) => m.round === 1);
    expect(r1).toHaveLength(32);
    const byes = r1.filter((m) => isByeMatch(m));
    expect(byes).toHaveLength(4);
    // Tersebar rata: dua di sisi kiri (ganjil), dua di sisi kanan (genap).
    expect(byes.map((m) => m.matchNumber).sort((a, b) => a - b)).toEqual([9, 10, 25, 26]);
    expect(new Set(r1.flatMap((m) => [m.participantAId, m.participantBId]).filter(Boolean)).size).toBe(60);
    for (const m of byes) {
      expect(m).toMatchObject({ status: "done", winnerId: m.participantAId, participantBId: null });
      const next = cell.find((x) => x.id === m.nextMatchId)!;
      // Laga asal bernomor lebih kecil mengisi slot A.
      const feeders = cell.filter((x) => x.nextMatchId === next.id).map((x) => x.matchNumber);
      expect(m.matchNumber === Math.min(...feeders) ? next.participantAId : next.participantBId).toBe(m.participantAId);
    }
    // Laga lain tetap normal & ruangan lain tanpa bye.
    expect(result.matches.filter((m) => isByeMatch(m))).toHaveLength(4);
  });

  it("menolak ruangan dengan 32 peserta atau kurang (akan ada laga tanpa peserta)", () => {
    const cut = new Set(mockBracket.participants.filter((p) => p.sessionId === "sesi-1" && p.roomId === "ruangan-1").slice(0, 32).map((p) => p.id));
    const result = buildBracketStructure({ ...input, participants: mockBracket.participants.filter((p) => !cut.has(p.id)) });
    expect(result.ok === false && result.errors).toEqual(["Sesi 1 · Ruangan 1: 32 peserta (harus 33–64; kekurangan dari 64 jadi bye)."]);
  });

  it("roundOneSlots: 33 peserta → 31 bye + 1 laga", () => {
    const players = Array.from({ length: 33 }, (_, i) => ({ id: `p${i + 1}`, teamOrClub: `S${i % 5}` }));
    const slots = roundOneSlots(players);
    expect(slots.filter(([, b]) => b === null)).toHaveLength(31);
    expect(new Set(slots.flatMap(([a, b]) => [a.id, b?.id]).filter(Boolean)).size).toBe(33);
  });
});

describe("doubleRoundRobin", () => {
  it("5 finalis: 10 putaran, 20 laga, tiap finalis 4 kali tuan rumah dan 4 kali tamu", () => {
    const rounds = doubleRoundRobin(5);
    const games = rounds.flat();
    expect(rounds).toHaveLength(10);
    expect(games).toHaveLength(20);
    for (let i = 0; i < 5; i++) {
      expect(games.filter(([h]) => h === i)).toHaveLength(4);
      expect(games.filter(([, a]) => a === i)).toHaveLength(4);
    }
  });
});

describe("spreadClubs", () => {
  it("menghindari pasangan satu sekolah bila memungkinkan", () => {
    const players = ["A", "A", "A", "A", "B", "B", "C", "C"].map((club, i) => ({ id: `p${i}`, teamOrClub: club }));
    const order = spreadClubs(players);
    for (let k = 0; k < order.length; k += 2) expect(order[k].teamOrClub).not.toBe(order[k + 1].teamOrClub);
  });
});

describe("finalLegs", () => {
  it("membagi 20 laga final menjadi 2 putaran berisi 10 pasangan yang sama, tuan rumah ditukar", async () => {
    const { finalLegs } = await import("@/lib/final-standings");
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error();
    const [leg1, leg2] = finalLegs(result.matches.filter((m) => m.round === FINAL_ROUND));
    expect([leg1.length, leg2.length]).toEqual([10, 10]);
    const pair = (m: (typeof leg1)[number]) => [m.feedAId, m.feedBId].sort().join("|");
    expect(new Set(leg1.map(pair))).toEqual(new Set(leg2.map(pair)));
    for (const m of leg1) {
      const back = leg2.find((x) => pair(x) === pair(m))!;
      expect([back.feedAId, back.feedBId]).toEqual([m.feedBId, m.feedAId]);
    }
  });
});
