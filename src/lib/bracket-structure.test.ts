import { describe, expect, it } from "vitest";

import { buildAdvanceMap, buildSlotLabels } from "@/lib/bracket";
import { buildBracketStructure, spreadClubs } from "@/lib/bracket-structure";
import { championSlots, mockBracket } from "@/lib/mock/bracket-data";

const input = { sessions: mockBracket.sessions, rooms: mockBracket.rooms, participants: mockBracket.participants };

describe("buildBracketStructure", () => {
  it("4 sesi × 10 ruangan: 600 laga ruangan + 39 laga final dengan tautan sama seperti data contoh", () => {
    const result = buildBracketStructure({ ...input, finalStart: "2026-10-17T18:00:00+07:00" });
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.summary).toMatchObject({ roomMatches: 600, finalMatches: 39, byes: 24, playoffMatches: 8 });
    const expected = new Map(mockBracket.matches.map((m) => [m.id, m.nextMatchId ?? championSlots.get(m.id)?.matchId ?? null]));
    expect(result.matches).toHaveLength(expected.size);
    for (const m of result.matches) expect([m.id, m.nextMatchId]).toEqual([m.id, expected.get(m.id)]);
    // Jadwal sama dengan data contoh.
    const scheduled = new Map(mockBracket.matches.map((m) => [m.id, m.scheduledAt]));
    for (const m of result.matches) expect(m.scheduledAt.toISOString()).toBe(scheduled.get(m.id));
  });

  it("setiap laga 32 besar menerima tepat dua laga asal; slot A selalu juara ber-bye", () => {
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error();
    const advance = buildAdvanceMap(result.matches);
    const r32 = result.matches.filter((m) => m.round === 6);
    for (const m of r32) {
      const sources = result.matches.filter((s) => s.nextMatchId === m.id);
      expect(sources).toHaveLength(2);
      const a = sources.find((s) => advance.get(s.id)?.side === "A")!;
      expect(a.round).toBe(4);
    }
    // Label slot kosong bisa dibuat untuk semua laga.
    const labels = buildSlotLabels(result.matches.map((m) => ({ ...m, winnerId: null, scoreA: null, scoreB: null, status: "scheduled" as const, scheduledAt: m.scheduledAt.toISOString() })));
    expect(labels.size).toBe(639);
  });

  it("pasangan babak 1 berisi 16 peserta ruangan masing-masing, sebisa mungkin beda klub", () => {
    const result = buildBracketStructure(input);
    if (!result.ok) throw new Error();
    const people = new Map(mockBracket.participants.map((p) => [p.id, p]));
    const roundOne = result.matches.filter((m) => m.round === 1);
    expect(new Set(roundOne.flatMap((m) => [m.participantAId, m.participantBId])).size).toBe(640);
    for (const m of roundOne) {
      const a = people.get(m.participantAId!)!;
      expect(a.sessionId).toBe(m.sessionId);
      expect(a.roomId).toBe(m.roomId);
    }
    const sameClub = roundOne.filter((m) => {
      const a = people.get(m.participantAId!)!.teamOrClub;
      return a !== null && a === people.get(m.participantBId!)!.teamOrClub;
    }).length;
    expect(sameClub).toBeLessThan(5);
  });

  it("menolak penempatan yang belum lengkap, sesi tanpa jam, dan format juara yang tidak didukung", () => {
    const participants = mockBracket.participants.map((p, i) => (i === 0 ? { ...p, roomId: null } : p));
    const sessions = mockBracket.sessions.map((s, i) => (i === 1 ? { ...s, startTime: null } : s));
    const result = buildBracketStructure({ ...input, participants, sessions });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining(["Sesi 2 belum punya jam mulai.", "Sesi 1 · Ruangan 1: 15 peserta (harus 16).", "1 peserta belum punya sesi/ruangan."]),
    );
    const tooFew = buildBracketStructure({ ...input, sessions: mockBracket.sessions.slice(0, 2) });
    expect(tooFew.ok === false && tooFew.errors[0]).toMatch(/butuh 32–48 juara ruangan/);
  });
});

describe("spreadClubs", () => {
  it("menghindari pasangan satu klub bila memungkinkan", () => {
    const players = ["A", "A", "A", "A", "B", "B", "C", "C"].map((club, i) => ({ id: `p${i}`, teamOrClub: club }));
    const order = spreadClubs(players);
    for (let k = 0; k < order.length; k += 2) expect(order[k].teamOrClub).not.toBe(order[k + 1].teamOrClub);
  });
});
