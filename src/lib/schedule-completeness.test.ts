import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { checkScheduleCompleteness } from "@/lib/schedule-completeness";

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
