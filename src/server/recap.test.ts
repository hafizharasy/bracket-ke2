import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { matches, matchResultHistory, matchResults, participants, rooms, sessions, users, violations } from "@/db/schema";
import type { SessionUser } from "@/server/auth";
import { recordMatchResult } from "@/server/match-results";
import { getDbRecap } from "@/server/recap";
import { clearUsers } from "@/test/db";

const pengawas: SessionUser = { id: "u-p1", name: "Pengawas R1", role: "pengawas", roomId: "ruangan-1" };
const proof = (id: string) => `/api/bukti/${id}-${crypto.randomUUID()}.jpg`;

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [violations, matchResultHistory, matchResults, matches]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
  db.insert(participants).values(["p1", "p2", "p3", "p4"].map((id) => ({ id, name: `Nama ${id}`, sessionId: "sesi-1" }))).run();
  db.insert(users).values({ id: "u-p1", name: "Pengawas R1", email: "p1@x", role: "pengawas", roomId: "ruangan-1" }).run();
  db.insert(matches).values([
    { id: "a", sessionId: "sesi-1", roomId: "ruangan-1", round: 1, matchNumber: 1, participantAId: "p1", participantBId: "p2" },
    { id: "b", sessionId: "sesi-1", roomId: "ruangan-2", round: 1, matchNumber: 1, participantAId: "p3", participantBId: "p4" },
  ]).run();
});

describe("getDbRecap", () => {
  it("menyertakan pencatat, bukti, dan jumlah koreksi; filter ruangan", () => {
    recordMatchResult("a", { scoreA: 3, scoreB: 1, proofPhotoUrl: proof("a") }, pengawas);
    recordMatchResult("a", { scoreA: 1, scoreB: 3, proofPhotoUrl: proof("a") }, pengawas);
    db.insert(violations).values({ id: "v1", participantId: "p1", matchId: "a", roomId: "ruangan-1", type: "Terlambat hadir", recordedBy: "u-p1" }).run();

    const recap = getDbRecap({ ruangan: "ruangan-1" });
    expect(recap.results).toEqual([
      expect.objectContaining({ matchId: "a", status: "done", scoreA: 1, scoreB: 3, winner: { id: "p2", name: "Nama p2" }, recordedBy: "Pengawas R1", corrections: 1, hasProof: true }),
    ]);
    expect(recap.summary).toMatchObject({ matches: { total: 1, done: 1 }, corrections: 1, violations: { total: 1 } });
    expect(recap.violations[0]).toMatchObject({ participant: { name: "Nama p1" }, recordedBy: "Pengawas R1", matchLabel: "16 Besar Ruangan #1" });
    expect(getDbRecap({}).results.find((r) => r.matchId === "b")).toMatchObject({ status: "scheduled", recordedBy: null, corrections: 0 });
  });
});
