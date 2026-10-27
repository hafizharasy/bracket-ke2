import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditLogs, matches, matchOfficials, matchResultHistory, matchResults, participants, rooms, sessionRooms, sessions, violations } from "@/db/schema";
import { mockBracket } from "@/lib/mock/bracket-data";
import { generateBracketStructure } from "@/server/bracket-structure";
import { cancelMatchResult } from "@/server/match-results";
import { getPairings, savePairings } from "@/server/pairings";
import { clearAllResults, simulateResults } from "@/server/simulation";
import { ApiError } from "@/server/errors";
import { clearUsers } from "@/test/db";

function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    return error as ApiError;
  }
  throw new Error(`Diharapkan ApiError ${status}, tetapi tidak ada error.`);
}

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [violations, matchResultHistory, matchResults, matchOfficials, matches, auditLogs]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, sessionRooms, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values(mockBracket.sessions.map((s) => ({ ...s, startTime: new Date(s.startTime!) }))).run();
  db.insert(rooms).values(mockBracket.rooms).run();
  db.insert(sessionRooms).values(mockBracket.sessionRooms).run();
  for (let i = 0; i < mockBracket.participants.length; i += 100) {
    db.insert(participants).values(mockBracket.participants.slice(i, i + 100)).run();
  }
});

describe("sesi Semifinal & Final", () => {
  it("dibuat otomatis bila belum ada; semifinal & final masuk ke sana, sesi terakhir hanya babak ruangan", () => {
    db.delete(sessions).where(eq(sessions.stage, "final")).run();
    const dry = generateBracketStructure({ dryRun: true });
    expect(db.select().from(sessions).where(eq(sessions.stage, "final")).all()).toHaveLength(0); // dryRun tidak menulis
    generateBracketStructure({}, null);
    const final = db.select().from(sessions).where(eq(sessions.stage, "final")).get()!;
    expect(final).toMatchObject({ id: "sesi-final", name: "Semifinal & Final", orderIndex: 1000 });
    expect(final.startTime!.toISOString()).toBe(dry.finalStart);
    const all = db.select().from(matches).all();
    expect(all.filter((m) => m.round > 6).every((m) => m.sessionId === "sesi-final")).toBe(true);
    expect(all.filter((m) => m.sessionId === "sesi-4").every((m) => m.round <= 6)).toBe(true);
    expect(all.filter((m) => m.sessionId === "sesi-4")).toHaveLength(126);
  });

  it("memakai jam mulai sesi Semifinal & Final yang sudah diatur admin", () => {
    db.update(sessions).set({ startTime: new Date("2026-11-01T02:00:00Z") }).where(eq(sessions.stage, "final")).run();
    generateBracketStructure({}, null);
    const sf = db.select().from(matches).where(eq(matches.round, 7)).all();
    expect(sf.every((m) => m.scheduledAt!.toISOString() === "2026-11-01T02:00:00.000Z")).toBe(true);
  });
});

describe("bye (ruangan kurang dari 64 peserta)", () => {
  const admin = { id: "u-admin", name: "Admin", role: "admin" as const, roomId: null };
  const cell = { sessionId: "sesi-1", roomId: "ruangan-1" };
  const byes = () => db.select().from(matches).all().filter((m) => m.round === 1 && m.status === "done" && (!m.participantAId) !== (!m.participantBId));

  beforeEach(() => {
    // Ruangan 1 sesi 1 hanya 61 peserta → 3 bye.
    const ids = db.select().from(participants).all().filter((p) => p.sessionId === "sesi-1" && p.roomId === "ruangan-1").slice(0, 3).map((p) => p.id);
    for (const id of ids) db.delete(participants).where(eq(participants.id, id)).run();
    generateBracketStructure({}, null);
  });

  it("bagan tetap dibuat; bye langsung selesai dan pesertanya di babak 2; tidak dianggap turnamen dimulai", () => {
    expect(byes()).toHaveLength(3);
    for (const m of byes()) {
      const next = db.select().from(matches).where(eq(matches.id, m.nextMatchId!)).get()!;
      expect([next.participantAId, next.participantBId]).toContain(m.winnerId);
    }
    expect(getPairings("sesi-1", "ruangan-1").locked).toBe(false);
    expect(generateBracketStructure({ replace: true })).toMatchObject({ saved: true }); // masih boleh disusun ulang
    expect(byes()).toHaveLength(3);
    const bye = byes()[0];
    expectApiError(() => cancelMatchResult(bye.id, admin), 409);
  });

  it("Hapus semua hasil menerapkan bye lagi", () => {
    simulateResults({ stage: "semua" }, null);
    clearAllResults({ violations: false }, null);
    expect(byes()).toHaveLength(3);
    const r2 = db.select().from(matches).all().filter((m) => m.round === 2 && m.sessionId === "sesi-1" && m.roomId === "ruangan-1");
    expect(r2.filter((m) => m.participantAId || m.participantBId)).toHaveLength(3);
  });

  it("menyimpan pasangan menghitung ulang bye; slot bye bisa diisi setelah ruangan berjalan", () => {
    const { order } = getPairings("sesi-1", "ruangan-1");
    // Tukar posisi: peserta bye pertama ditukar dengan peserta laga biasa → bye pindah.
    const byeIndex = order.findIndex((id, i) => i % 2 === 0 && id && order[i + 1] === null);
    const normalIndex = order.findIndex((id, i) => i % 2 === 0 && id && order[i + 1] !== null);
    const swapped = [...order];
    [swapped[byeIndex], swapped[normalIndex]] = [swapped[normalIndex], swapped[byeIndex]];
    savePairings({ ...cell, order: swapped });
    expect(byes()).toHaveLength(3);
    expect(byes().map((m) => m.winnerId)).toContain(order[normalIndex]);

    // Ruangan berjalan (laga biasa selesai) → slot kosong laga bye diisi peserta cadangan baru.
    const normal = db.select().from(matches).all().find((m) => m.round === 1 && m.sessionId === "sesi-1" && m.roomId === "ruangan-1" && m.participantAId && m.participantBId)!;
    db.update(matches).set({ status: "ongoing" }).where(eq(matches.id, normal.id)).run();
    db.insert(participants).values({ id: "p-new", name: "Cadangan", ...cell }).run();
    const now = getPairings("sesi-1", "ruangan-1");
    expect(now.locked).toBe(true);
    const empty = now.order.findIndex((id) => id === null);
    const filled = [...now.order];
    filled[empty] = "p-new";
    savePairings({ ...cell, order: filled });
    expect(byes()).toHaveLength(2);
  });
});

describe("generateBracketStructure", () => {
  it("menyimpan 655 laga, menolak bila sudah ada, dan bisa menyusun ulang selama belum ada hasil", () => {
    const dry = generateBracketStructure({ dryRun: true });
    expect(dry).toMatchObject({ saved: false, roomMatches: 630, semifinalMatches: 5, finalMatches: 20 });
    expect(db.select().from(matches).all()).toHaveLength(0);

    expect(generateBracketStructure({}, null)).toMatchObject({ saved: true, replaced: 0 });
    expect(db.select().from(matches).all()).toHaveLength(655);
    expect(db.select().from(auditLogs).all()[0]).toMatchObject({ action: "bracket.generate" });
    expectApiError(() => generateBracketStructure(), 409);

    expect(generateBracketStructure({ replace: true })).toMatchObject({ saved: true, replaced: 655 });
    db.update(matches).set({ status: "ongoing" }).where(eq(matches.id, "m-s1-r1-b1-1")).run();
    expectApiError(() => generateBracketStructure({ replace: true }), 409);
  });

  it("422 dengan daftar masalah bila penempatan belum lengkap", () => {
    db.update(participants).set({ roomId: null }).where(eq(participants.id, "p-001")).run();
    const error = expectApiError(() => generateBracketStructure(), 422);
    expect(error.details?.errors).toEqual(expect.arrayContaining(["1 peserta belum punya sesi/ruangan yang dipakai."]));
  });
});
