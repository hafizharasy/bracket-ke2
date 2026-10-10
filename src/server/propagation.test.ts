import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  matches,
  matchResultHistory,
  matchResults,
  participants,
  rooms,
  sessions,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { cancelMatchResult, recordMatchResult } from "@/server/match-results";
import { repropagateAll } from "@/server/propagation";
import { clearUsers } from "@/test/db";

const admin: SessionUser = { id: "u-admin", name: "Admin", role: "admin", roomId: null };
const pengawas2: SessionUser = { id: "u-p2", name: "P2", role: "pengawas", roomId: "ruangan-2" };

const proof = (matchId: string) => `/api/bukti/${matchId}-${crypto.randomUUID()}.jpg`;
const save = (matchId: string, scoreA: number, scoreB: number, user = admin) =>
  recordMatchResult(matchId, { scoreA, scoreB, proofPhotoUrl: proof(matchId) }, user);
const get = (id: string) => db.select().from(matches).where(eq(matches.id, id)).get()!;
const setStatus = (id: string, status: "scheduled" | "ongoing" | "done") =>
  db.update(matches).set({ status }).where(eq(matches.id, id)).run();

/** Mengharapkan ApiError dengan status tertentu. */
function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error(`Diharapkan ApiError ${status}, tetapi tidak ada error.`);
}

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matchResultHistory, matchResults, matches]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values([
    { id: "ruangan-1", name: "Ruangan 1" },
    { id: "ruangan-2", name: "Ruangan 2" },
  ]).run();
  db.insert(participants)
    .values(Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Peserta ${i + 1}` })))
    .run();
  db.insert(users).values([
    { id: "u-admin", name: "Admin", email: "a@x", role: "admin" },
    { id: "u-p2", name: "P2", email: "p2@x", role: "pengawas", roomId: "ruangan-2" },
  ]).run();
  const base = { sessionId: "sesi-1", roomId: "ruangan-1" };
  // Babak ruangan: r1-1 & r1-2 → r2-1. Babak final: final ruangan (rf) & play-off (po) → k32.
  db.insert(matches).values([
    { ...base, id: "r2-1", round: 2, matchNumber: 1 },
    { ...base, id: "k32", round: 6, matchNumber: 1 },
  ]).run();
  db.insert(matches).values([
    { ...base, id: "r1-1", round: 1, matchNumber: 1, participantAId: "p1", participantBId: "p2", nextMatchId: "r2-1" },
    { ...base, id: "r1-2", round: 1, matchNumber: 2, participantAId: "p3", participantBId: "p4", nextMatchId: "r2-1" },
    { ...base, id: "rf", round: 4, matchNumber: 1, participantAId: "p5", participantBId: "p6", nextMatchId: "k32" },
    { ...base, id: "po", round: 5, matchNumber: 1, participantAId: "p7", participantBId: "p8", nextMatchId: "k32" },
  ]).run();
});

describe("advanceWinner (lewat recordMatchResult)", () => {
  it("menempatkan pemenang laga bernomor kecil di slot A dan besar di slot B", () => {
    save("r1-2", 0, 2);
    save("r1-1", 3, 1);
    expect(get("r2-1")).toMatchObject({ participantAId: "p1", participantBId: "p4" });
    expect(get("r1-1")).toMatchObject({ status: "done", winnerId: "p1" });
  });

  it("lintas babak: final ruangan (babak lebih awal) ke A, play-off ke B", () => {
    save("po", 1, 0);
    save("rf", 0, 1);
    expect(get("k32")).toMatchObject({ participantAId: "p6", participantBId: "p7" });
  });

  it("koreksi mengganti pemenang di laga berikutnya selama belum dimulai", () => {
    save("r1-1", 3, 1);
    save("r1-1", 1, 3);
    expect(get("r2-1").participantAId).toBe("p2");
    const history = db.select().from(matchResultHistory).where(eq(matchResultHistory.matchId, "r1-1")).all();
    expect(history.map((h) => h.action)).toEqual(["create", "correct"]);
  });

  it("menolak koreksi pemenang setelah laga berikutnya dimulai dan me-rollback semuanya", () => {
    save("r1-1", 3, 1);
    setStatus("r2-1", "ongoing");
    expectApiError(() => save("r1-1", 0, 2), 409);
    expect(get("r1-1")).toMatchObject({ scoreA: 3, scoreB: 1, winnerId: "p1" });
    expect(get("r2-1").participantAId).toBe("p1");
  });

  it("tetap mengizinkan koreksi skor dengan pemenang yang sama setelah laga berikutnya dimulai", () => {
    save("r1-1", 3, 1);
    setStatus("r2-1", "ongoing");
    save("r1-1", 4, 1);
    expect(get("r1-1").scoreA).toBe(4);
  });

  it("menolak pengawas ruangan lain", () => {
    expectApiError(() => save("r1-1", 3, 1, pengawas2), 403);
  });
});

describe("cancelMatchResult / retractWinner", () => {
  it("mengembalikan laga ke terjadwal dan menarik pemenang dari laga berikutnya", () => {
    save("r1-1", 3, 1);
    cancelMatchResult("r1-1", admin);
    expect(get("r1-1")).toMatchObject({ status: "scheduled", winnerId: null, scoreA: null });
    expect(get("r2-1").participantAId).toBeNull();
    expect(db.select().from(matchResults).all()).toHaveLength(0);
    const actions = db.select().from(matchResultHistory).all().map((h) => h.action);
    expect(actions).toEqual(["create", "cancel"]);
  });

  it("menolak pembatalan setelah laga berikutnya dimulai", () => {
    save("r1-1", 3, 1);
    setStatus("r2-1", "ongoing");
    expectApiError(() => cancelMatchResult("r1-1", admin), 409);
    expect(get("r1-1").status).toBe("done");
  });

  it("menolak pembatalan laga yang belum punya hasil", () => {
    expectApiError(() => cancelMatchResult("r1-1", admin), 409);
  });
});

describe("repropagateAll", () => {
  it("mengisi slot kosong dan melaporkan slot yang berisi peserta lain tanpa menimpanya", () => {
    save("r1-1", 3, 1);
    save("r1-2", 2, 0);
    db.update(matches).set({ participantAId: null, participantBId: "p8" }).where(eq(matches.id, "r2-1")).run();

    const report = db.transaction((tx) => repropagateAll(tx));

    expect(report.filled).toBe(1);
    expect(report.conflicts).toHaveLength(1);
    expect(get("r2-1")).toMatchObject({ participantAId: "p1", participantBId: "p8" });
  });
});
