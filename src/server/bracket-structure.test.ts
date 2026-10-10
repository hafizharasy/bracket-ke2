import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditLogs, matches, matchResultHistory, matchResults, participants, rooms, sessions, violations } from "@/db/schema";
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
  for (const table of [violations, matchResultHistory, matchResults, matches, auditLogs]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values(mockBracket.sessions.map((s) => ({ ...s, startTime: new Date(s.startTime!) }))).run();
  db.insert(rooms).values(mockBracket.rooms).run();
  for (let i = 0; i < mockBracket.participants.length; i += 100) {
    db.insert(participants).values(mockBracket.participants.slice(i, i + 100)).run();
  }
});

describe("generateBracketStructure", () => {
  it("menyimpan 639 laga, menolak bila sudah ada, dan bisa menyusun ulang selama belum ada hasil", () => {
    const dry = generateBracketStructure({ dryRun: true });
    expect(dry).toMatchObject({ saved: false, roomMatches: 600, finalMatches: 39 });
    expect(db.select().from(matches).all()).toHaveLength(0);

    expect(generateBracketStructure({}, null)).toMatchObject({ saved: true, replaced: 0 });
    expect(db.select().from(matches).all()).toHaveLength(639);
    expect(db.select().from(auditLogs).all()[0]).toMatchObject({ action: "bracket.generate" });
    expectApiError(() => generateBracketStructure(), 409);

    expect(generateBracketStructure({ replace: true })).toMatchObject({ saved: true, replaced: 639 });
    db.update(matches).set({ status: "ongoing" }).where(eq(matches.id, "m-s1-r1-b1-1")).run();
    expectApiError(() => generateBracketStructure({ replace: true }), 409);
  });

  it("422 dengan daftar masalah bila penempatan belum lengkap", () => {
    db.update(participants).set({ roomId: null }).where(eq(participants.id, "p-001")).run();
    const error = expectApiError(() => generateBracketStructure(), 422);
    expect(error.details?.errors).toEqual(expect.arrayContaining(["1 peserta belum punya sesi/ruangan."]));
  });
});
