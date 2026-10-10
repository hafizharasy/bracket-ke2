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

describe("queryResults", () => {
  it("menyaring status, babak, koreksi, kata kunci, lalu membagi halaman", async () => {
    const { queryResults } = await import("@/lib/recap");
    const rows = getMockRecap({}).results;
    expect(queryResults(rows, { status: "ongoing" }).total).toBe(15);
    expect(queryResults(rows, { round: 4 }).total).toBe(40);
    expect(queryResults(rows, { onlyCorrected: true }).items.every((r) => r.corrections > 0)).toBe(true);
    expect(queryResults(rows, { q: "m-s1-r1-b1-1" }).items.map((r) => r.matchId)).toEqual(["m-s1-r1-b1-1"]);
    const page = queryResults(rows, { page: 99, pageSize: 100 });
    expect(page).toMatchObject({ page: 7, pages: 7, total: 639 });
    expect(page.items).toHaveLength(39);
  });
});

describe("ringkasan pelanggaran", () => {
  it("menghitung peserta berulang, per jenis, per ruangan, dan mengelompokkan per peserta", async () => {
    const { filterViolations, groupViolationsByParticipant, summarizeViolations } = await import("@/lib/recap");
    const rows = getMockRecap({}).violations;
    const summary = summarizeViolations(rows);
    expect(summary.total).toBe(rows.length);
    expect(summary.byType.reduce((n, t) => n + t.count, 0)).toBe(rows.length);
    expect(summary.byRoom.reduce((n, r) => n + r.count, 0)).toBe(rows.length);
    const groups = groupViolationsByParticipant(rows);
    expect(groups.filter((g) => g.count > 1)).toHaveLength(summary.repeatParticipants);
    expect(groups[0].types.reduce((n, t) => n + t.count, 0)).toBe(groups[0].count);
    const late = filterViolations(rows, { type: "Terlambat hadir", roomName: "Ruangan 1" });
    expect(late.every((v) => v.type === "Terlambat hadir" && v.roomName === "Ruangan 1")).toBe(true);
  });
});
