import { describe, expect, it } from "vitest";

import { buildAdvanceMap, buildSlotLabels, FINAL_ROUND, LAST_ROOM_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { buildBracketStructure, doubleRoundRobin, spreadClubs } from "@/lib/bracket-structure";
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
        "Sesi 1 · Ruangan 1: 63 peserta (harus 64).",
        "1 peserta belum punya sesi/ruangan yang dipakai.",
      ]),
    );
    const odd = buildBracketStructure({ ...input, sessionRooms: mockBracket.sessionRooms.slice(1) });
    expect(odd.ok === false && odd.errors[0]).toMatch(/genap dan minimal 4/);
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
