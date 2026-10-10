import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { checkScheduleCompleteness, summarizePlacement } from "@/lib/schedule-completeness";

const byKey = (checks: ReturnType<typeof checkScheduleCompleteness>) => Object.fromEntries(checks.map((c) => [c.key, c]));

describe("checkScheduleCompleteness", () => {
  it("data tiruan lengkap → semua OK", () => {
    expect(checkScheduleCompleteness(mockBracket).every((c) => c.ok)).toBe(true);
  });

  it("mendeteksi peserta tanpa sesi/ruangan, sel tidak pas, dan pasangan tidak konsisten", () => {
    const participants = mockBracket.participants.map((p, i) =>
      i === 0 ? { ...p, sessionId: null, roomId: null } : i === 1 ? { ...p, roomId: "ruangan-2" } : p,
    );
    const checks = byKey(checkScheduleCompleteness({ ...mockBracket, participants }));
    expect(checks.session).toMatchObject({ ok: false, detail: "1 peserta belum punya sesi" });
    expect(checks.room.ok).toBe(false);
    expect(checks.cells.ok).toBe(false);
    expect(checks.consistency.ok).toBe(false); // p-001 & p-002 tidak lagi sesuai laga babak 1-nya
    expect(checks.pairs.ok).toBe(true);
  });

  it("mendeteksi duplikat & slot babak 1 kosong", () => {
    const matches = mockBracket.matches.map((m) =>
      m.id === "m-s1-r1-b1-2" ? { ...m, participantAId: "p-001" } : m.id === "m-s1-r1-b1-3" ? { ...m, participantBId: null } : m,
    );
    const checks = byKey(checkScheduleCompleteness({ ...mockBracket, matches }));
    expect(checks.pairs.ok).toBe(false);
    expect(checks.consistency.detail).toContain("muncul lebih dari sekali");
  });
});

describe("summarizePlacement", () => {
  it("menghitung isi sesi × ruangan dan status pasangan", () => {
    const summary = summarizePlacement(mockBracket);
    expect(summary).toMatchObject({ total: 640, withoutSession: 0, withoutRoom: 0, ready: true });
    expect(summary.sessions).toHaveLength(4);
    expect(summary.sessions[0]).toMatchObject({ count: 192 });
    expect(summary.sessions[0].rooms).toHaveLength(3);
    expect(summary.sessions[2].rooms).toHaveLength(2);
    expect(summary.sessions[0].rooms.every((r) => r.count === 64 && r.pairsComplete)).toBe(true);
  });

  it("melaporkan peserta belum ditempatkan dan pasangan kosong", () => {
    const participants = mockBracket.participants.map((p, i) => (i === 0 ? { ...p, sessionId: null, roomId: null } : p));
    const matches = mockBracket.matches.map((m) => (m.id === "m-s1-r1-b1-1" ? { ...m, participantAId: null } : m));
    const summary = summarizePlacement({ ...mockBracket, participants, matches });
    expect(summary).toMatchObject({ withoutSession: 1, withoutRoom: 1, ready: false });
    expect(summary.sessions[0].rooms[0]).toMatchObject({ id: "ruangan-1", count: 63, pairsComplete: false });
  });
});
