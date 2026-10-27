import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditLogs, matches, matchOfficials, matchResultHistory, matchResults, participants, rooms, sessionRooms, sessions, violations } from "@/db/schema";
import { mockBracket } from "@/lib/mock/bracket-data";
import { generateBracketStructure } from "@/server/bracket-structure";
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
