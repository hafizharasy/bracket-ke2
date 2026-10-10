import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { getMockRecap } from "@/lib/mock/recap-data";
import { buildRecap } from "@/lib/recap";

describe("buildRecap", () => {
  it("merangkum seluruh turnamen dengan angka yang konsisten", () => {
    const recap = getMockRecap({});
    const { matches } = recap.summary;
    expect(matches.total).toBe(mockBracket.matches.length);
    expect(matches.done + matches.ongoing + matches.scheduled).toBe(matches.total);
    expect(recap.results).toHaveLength(matches.total);
    expect(recap.summary.roomChampions).toHaveLength(40);
    expect(recap.summary.violations.total).toBe(recap.violations.length);
    expect(recap.summary.violations.byType.reduce((n, t) => n + t.count, 0)).toBe(recap.violations.length);
  });

  it("memfilter hasil & pelanggaran per sesi dan ruangan", () => {
    const recap = getMockRecap({ sesi: "sesi-2", ruangan: "ruangan-3" });
    expect(recap.results.length).toBe(15);
    expect(recap.results.every((r) => r.sessionId === "sesi-2" && r.roomId === "ruangan-3")).toBe(true);
    expect(recap.violations.every((v) => v.roomId === "ruangan-3" && v.sessionName === "Sesi 2")).toBe(true);
    expect(recap.summary.roomChampions).toEqual([expect.objectContaining({ sessionName: "Sesi 2", roomName: "Ruangan 3" })]);
  });

  it("memakai info pencatat & koreksi bila ada", () => {
    const m = mockBracket.matches.find((x) => x.status === "done")!;
    const meta = new Map([[m.id, { recordedAt: "2026-10-17T01:11:00.000Z", recordedBy: "Pengawas X", corrections: 2, hasProof: true }]]);
    const recap = buildRecap(mockBracket, [], { sesi: m.sessionId, ruangan: m.roomId }, meta);
    expect(recap.results.find((r) => r.matchId === m.id)).toMatchObject({ recordedBy: "Pengawas X", corrections: 2, hasProof: true });
    expect(recap.summary.corrections).toBe(2);
  });
});
