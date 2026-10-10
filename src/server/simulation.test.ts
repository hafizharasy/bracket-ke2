import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  auditLogs,
  matches,
  matchOfficials,
  matchResultHistory,
  matchResults,
  participants,
  rooms,
  sessionRooms,
  sessions,
  users,
  violations,
} from "@/db/schema";
import { FINAL_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { tournamentChampion } from "@/lib/final-standings";
import { mockBracket } from "@/lib/mock/bracket-data";
import { generateBracketStructure } from "@/server/bracket-structure";
import { setMatchReferees } from "@/server/match-officials";
import { clearAllResults, randomResult, simulateResults, simulationStatus } from "@/server/simulation";
import { clearUsers } from "@/test/db";

const all = () => db.select().from(matches).all();

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
  generateBracketStructure({}, null);
});

describe("randomResult", () => {
  it("menghasilkan hasil sah per babak", () => {
    for (let i = 0; i < 50; i++) {
      const room = randomResult(1, "a", "b");
      expect(room.scoreA).not.toBe(room.scoreB);
      expect(room.winnerId).toBe(room.scoreA! > room.scoreB! ? "a" : "b");
      const sf = randomResult(SEMIFINAL_ROUND, "a", "b");
      expect(Math.max(sf.scoreA!, sf.scoreB!)).toBe(2);
      expect(Math.min(sf.scoreA!, sf.scoreB!)).toBeLessThan(2);
      expect(randomResult(FINAL_ROUND, "a", "b").winType).toBeTruthy();
    }
  });
});

describe("simulateResults", () => {
  it("mengisi satu ruangan-sesi saja, lalu seluruh turnamen sampai juara", () => {
    expect(simulateResults({ stage: "ruangan", sessionId: "sesi-1", roomId: "ruangan-1" }, null)).toMatchObject({ finished: 63 });
    expect(all().filter((m) => m.status === "done").every((m) => m.sessionId === "sesi-1" && m.roomId === "ruangan-1")).toBe(true);
    // Juara ruangan sudah masuk semifinal.
    const roomFinal = all().find((m) => m.id === "m-s1-r1-b6-1")!;
    const sf = all().find((m) => m.id === roomFinal.nextMatchId)!;
    expect([sf.participantAId, sf.participantBId]).toContain(roomFinal.winnerId);

    // Semifinal belum bisa sebelum semua juara ruangan ada → hanya yang siap.
    expect(simulateResults({ stage: "semifinal" }, null).finished).toBe(0);

    const rest = simulateResults({ stage: "semua" }, null);
    expect(rest).toMatchObject({ finished: 655 - 63, remaining: 0 });
    expect(simulationStatus()).toMatchObject({ room: { done: 630 }, semifinal: { done: 5 }, final: { done: 20 } });
    expect(tournamentChampion(all()) !== undefined).toBe(true);
    expect(db.select().from(auditLogs).all().some((a) => a.action === "simulation.results")).toBe(true);
  });
});

describe("clearAllResults", () => {
  it("mengembalikan semua laga ke terjadwal; peserta babak 1 & nama pengawas tetap", () => {
    const roundOneBefore = all().filter((m) => m.round === 1).map((m) => [m.id, m.participantAId, m.participantBId]);
    setMatchReferees([{ matchId: "m-s1-r1-b1-1", refereeName: "Pak Budi" }], null);
    simulateResults({ stage: "semua" }, null);
    db.insert(users).values({ id: "u-p", name: "Pengawas", email: "p@x", role: "pengawas", roomId: "ruangan-1" }).run();
    db.insert(violations).values({ id: "v1", participantId: "p-001", matchId: "m-s1-r1-b1-1", roomId: "ruangan-1", type: "Terlambat hadir", recordedBy: "u-p" }).run();

    const result = clearAllResults({ violations: false }, null);
    expect(result).toMatchObject({ cleared: 655, removedViolations: 0 });
    expect(result.backup).toBeNull(); // database tes di memori
    const after = all();
    expect(after.every((m) => m.status === "scheduled" && m.winnerId === null && m.scoreA === null && m.winType === null)).toBe(true);
    expect(after.filter((m) => m.round > 1).every((m) => !m.participantAId && !m.participantBId)).toBe(true);
    expect(after.filter((m) => m.round === 1).map((m) => [m.id, m.participantAId, m.participantBId])).toEqual(roundOneBefore);
    expect(db.select().from(matchOfficials).where(eq(matchOfficials.matchId, "m-s1-r1-b1-1")).get()?.refereeName).toBe("Pak Budi");
    expect(db.select().from(violations).all()).toHaveLength(1);

    expect(clearAllResults({ violations: true }, null).removedViolations).toBe(1);
    // Bisa disimulasikan lagi setelah dihapus.
    expect(simulateResults({ stage: "semua" }, null).remaining).toBe(0);
  });
});
