import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { getMatchDetail } from "@/db/queries/match-detail";
import { getBracketFromDb } from "@/db/queries/bracket";
import { getRoomMatches } from "@/db/queries/room";
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
import { FINAL_ROUND, LAST_ROOM_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { finalStandings, tournamentChampion } from "@/lib/final-standings";
import { mockBracket } from "@/lib/mock/bracket-data";
import type { SessionUser } from "@/server/auth";
import { generateBracketStructure } from "@/server/bracket-structure";
import { ApiError } from "@/server/errors";
import { getMatchReferees, setMatchReferees } from "@/server/match-officials";
import { recordMatchResult, resolveResult } from "@/server/match-results";
import { getSchedule, setSessionRooms } from "@/server/schedule";
import { setSemifinalPairs } from "@/server/semifinal-pairs";
import { clearUsers } from "@/test/db";

const admin: SessionUser = { id: "u-admin", name: "Admin", role: "admin", roomId: null };
const proof = (id: string) => `/api/bukti/${id}-${crypto.randomUUID()}.jpg`;
const match = (id: string) => db.select().from(matches).where(eq(matches.id, id)).get()!;

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

/** Isi final ruangan langsung dengan dua peserta ruangan itu lalu catat hasilnya. */
function finishRoomFinal(id: string) {
  const m = match(id);
  const [a, b] = db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.sessionId, m.sessionId), eq(participants.roomId, m.roomId)))
    .limit(2)
    .all();
  db.update(matches).set({ participantAId: a.id, participantBId: b.id }).where(eq(matches.id, id)).run();
  recordMatchResult(id, { scoreA: 3, scoreB: 1, proofPhotoUrl: proof(id) }, admin);
  return a.id;
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
  db.insert(users).values({ id: "u-admin", name: "Admin", email: "admin@x", role: "admin" }).run();
});

describe("aturan hasil per babak", () => {
  it("semifinal best of 3 dan final dengan jenis kemenangan", () => {
    expect(resolveResult(SEMIFINAL_ROUND, "a", "b", { scoreA: 1, scoreB: 2, proofPhotoUrl: "x" })).toMatchObject({ winnerId: "b" });
    expectApiError(() => resolveResult(SEMIFINAL_ROUND, "a", "b", { scoreA: 3, scoreB: 1, proofPhotoUrl: "x" }), 422);
    expectApiError(() => resolveResult(SEMIFINAL_ROUND, "a", "b", { scoreA: 2, scoreB: 2, proofPhotoUrl: "x" }), 422);
    expect(resolveResult(FINAL_ROUND, "a", "b", { winnerId: "a", winType: "tiga", proofPhotoUrl: "x" })).toEqual({
      winnerId: "a",
      scoreA: null,
      scoreB: null,
      winType: "tiga",
    });
    expectApiError(() => resolveResult(FINAL_ROUND, "a", "b", { winnerId: "a", proofPhotoUrl: "x" }), 422);
  });
});

describe("alur juara ruangan → semifinal → final round-robin", () => {
  it("memajukan juara ruangan ke semifinal dan pemenang semifinal ke semua laga finalnya", () => {
    generateBracketStructure({}, null);
    const champion = finishRoomFinal("m-s1-r1-b6-1");
    const sf1 = match("m-sf-1");
    expect([sf1.participantAId, sf1.participantBId]).toContain(champion);

    finishRoomFinal("m-s1-r2-b6-1");
    const ready = match("m-sf-1");
    recordMatchResult("m-sf-1", { scoreA: 2, scoreB: 1, proofPhotoUrl: proof("m-sf-1") }, admin);
    const finals = db.select().from(matches).where(eq(matches.round, FINAL_ROUND)).all();
    const fed = finals.filter((f) => f.feedAId === "m-sf-1" || f.feedBId === "m-sf-1");
    expect(fed).toHaveLength(8); // 4 lawan × 2 pertemuan
    for (const f of fed) expect(f.feedAId === "m-sf-1" ? f.participantAId : f.participantBId).toBe(ready.participantAId);
  });

  it("klasemen final: poin, head-to-head, lalu jumlah menang; juara setelah semua laga selesai", () => {
    const done = (a: string, b: string, winnerId: string, winType: string) =>
      ({ round: FINAL_ROUND, status: "done", participantAId: a, participantBId: b, winnerId, winType, matchNumber: 1 }) as const;
    const list = [
      done("x", "y", "x", "empat"), // x +3
      done("y", "x", "y", "empat"), // y +3
      done("x", "z", "x", "dua_terbanyak"), // x +½
      done("z", "y", "y", "dua_terbanyak"), // y +½
      done("z", "x", "z", "tiga"), // z +2
      done("y", "z", "z", "tiga_tercepat"), // z +1
    ];
    const rows = finalStandings(list, ["x", "y", "z"]);
    expect(rows.map((r) => [r.participantId, r.points, r.rank])).toEqual([
      ["x", 3.5, 1],
      ["y", 3.5, 1],
      ["z", 3, 3],
    ]);
    expect(rows[0].tied).toBe(true);
    // Seri tanpa pemisah → juara belum bisa ditentukan otomatis.
    const sf = [1, 2, 3].map((n, i) => ({ round: SEMIFINAL_ROUND, status: "done" as const, matchNumber: n, winnerId: "xyz"[i], participantAId: null, participantBId: null, winType: null }));
    expect(tournamentChampion([...sf, ...list])).toBeNull();
    const decisive = list.map((m, i) => (i === 3 ? { ...m, winType: "empat" } : m)); // y +3 → 6
    expect(tournamentChampion([...sf, ...decisive])).toBe("y");
  });
});

describe("ruangan per sesi", () => {
  it("menambah & mengurangi ruangan sesi; ruangan berisi peserta tidak bisa dilepas", () => {
    db.insert(rooms).values({ id: "ruangan-9", name: "Ruangan 9" }).run();
    expect(setSessionRooms("sesi-3", ["ruangan-1", "ruangan-2", "ruangan-9"])).toMatchObject({ added: ["ruangan-9"], removed: [], structureStale: false });
    expect(setSessionRooms("sesi-3", ["ruangan-1", "ruangan-2"])).toMatchObject({ removed: ["ruangan-9"] });
    expectApiError(() => setSessionRooms("sesi-3", ["ruangan-1"]), 409); // Ruangan 2 masih berisi 64 peserta
    expectApiError(() => setSessionRooms("sesi-3", ["ruangan-404"]), 422);
    expectApiError(() => setSessionRooms("sesi-404", []), 404);

    generateBracketStructure({}, null);
    expect(setSessionRooms("sesi-4", ["ruangan-1", "ruangan-2", "ruangan-9"]).structureStale).toBe(true);
    db.update(matches).set({ status: "ongoing" }).where(eq(matches.id, "m-s1-r1-b1-1")).run();
    expectApiError(() => setSessionRooms("sesi-4", ["ruangan-1", "ruangan-2"]), 409);
  });
});

describe("nama pengawas laga (privat)", () => {
  it("disimpan admin dan tidak pernah ikut di data publik maupun data pengawas ruangan", async () => {
    generateBracketStructure({}, null);
    const SECRET = "Pengawas Rahasia Zyx";
    expect(setMatchReferees([{ matchId: "m-s1-r1-b1-1", refereeName: SECRET }, { matchId: "m-sf-1", refereeName: SECRET }], "u-admin")).toEqual({ saved: 2, cleared: 0 });
    expect(getMatchReferees(["m-s1-r1-b1-1"]).get("m-s1-r1-b1-1")).toBe(SECRET);

    const exposed = JSON.stringify([
      getBracketFromDb(),
      getSchedule(),
      getRoomMatches("ruangan-1", "sesi-1"),
      await getMatchDetail("m-s1-r1-b1-1"),
      db.select().from(auditLogs).all(),
    ]);
    expect(exposed).not.toContain(SECRET);

    expect(setMatchReferees([{ matchId: "m-sf-1", refereeName: "" }], "u-admin")).toEqual({ saved: 0, cleared: 1 });
    expectApiError(() => setMatchReferees([{ matchId: "m-404", refereeName: "X" }], "u-admin"), 404);
  });
});

describe("pasangan semifinal", () => {
  it("admin menukar pasangan; slot semifinal disusun ulang dari juara ruangan yang sudah ada", () => {
    generateBracketStructure({}, null);
    const champion = finishRoomFinal("m-s1-r1-b6-1"); // awalnya ke m-sf-1
    const roomFinals = db.select().from(matches).where(eq(matches.round, LAST_ROOM_ROUND)).all().map((m) => m.id).sort();
    // Pasangkan Sesi 1 · Ruangan 1 dengan Sesi 4 · Ruangan 2 di semifinal ke-5.
    const others = roomFinals.filter((id) => id !== "m-s1-r1-b6-1" && id !== "m-s4-r2-b6-1");
    const pairs: [string, string][] = [
      [others[0], others[1]],
      [others[2], others[3]],
      [others[4], others[5]],
      [others[6], others[7]],
      ["m-s1-r1-b6-1", "m-s4-r2-b6-1"],
    ];
    expect(setSemifinalPairs(pairs, "u-admin")).toMatchObject({ semifinals: 5 });
    expect(match("m-s1-r1-b6-1").nextMatchId).toBe("m-sf-5");
    expect([match("m-sf-1").participantAId, match("m-sf-1").participantBId]).not.toContain(champion);
    expect([match("m-sf-5").participantAId, match("m-sf-5").participantBId]).toContain(champion);

    expectApiError(() => setSemifinalPairs(pairs.slice(1), null), 422);
    expectApiError(() => setSemifinalPairs([...pairs.slice(0, 4), [others[0], "m-s4-r2-b6-1"]], null), 422);
    db.update(matches).set({ status: "ongoing" }).where(eq(matches.id, "m-sf-2")).run();
    expectApiError(() => setSemifinalPairs(pairs, null), 409);
  });
});
