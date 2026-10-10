import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { matches, participants, rooms, sessions } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { getPairings, savePairings } from "@/server/pairings";

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

const cell = { sessionId: "sesi-1", roomId: "ruangan-1" };

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matches, participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
  db.insert(participants).values([
    ...["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id, ...cell })),
    { id: "p5", name: "p5", sessionId: "sesi-1", roomId: "ruangan-2" },
  ]).run();
  // Ruangan mini: dua laga babak 1 → satu laga babak 2.
  db.insert(matches).values({ ...cell, id: "r2", round: 2, matchNumber: 1 }).run();
  db.insert(matches).values([
    { ...cell, id: "r1-1", round: 1, matchNumber: 1, participantAId: "p1", participantBId: "p2", nextMatchId: "r2" },
    { ...cell, id: "r1-2", round: 1, matchNumber: 2, participantAId: "p3", participantBId: "p4", nextMatchId: "r2" },
  ]).run();
});

describe("pasangan babak 1", () => {
  it("membaca dan menyimpan urutan baru", () => {
    expect(getPairings("sesi-1", "ruangan-1")).toMatchObject({ locked: false, order: ["p1", "p2", "p3", "p4"] });
    savePairings({ ...cell, order: ["p1", "p3", "p2", "p4"] });
    expect(getPairings("sesi-1", "ruangan-1").order).toEqual(["p1", "p3", "p2", "p4"]);
  });

  it("menolak jumlah salah, duplikat, dan peserta dari ruangan lain", () => {
    expectApiError(() => savePairings({ ...cell, order: ["p1", "p2"] }), 422);
    expectApiError(() => savePairings({ ...cell, order: ["p1", "p1", "p3", "p4"] }), 422);
    expectApiError(() => savePairings({ ...cell, order: ["p1", "p2", "p3", "p5"] }), 422);
  });

  it("mengunci susunan setelah ada laga dimulai dan 404 bila belum ada laga", () => {
    db.update(matches).set({ status: "ongoing" }).where(eq(matches.id, "r1-2")).run();
    expect(getPairings("sesi-1", "ruangan-1").locked).toBe(true);
    expectApiError(() => savePairings({ ...cell, order: ["p1", "p3", "p2", "p4"] }), 409);
    expectApiError(() => savePairings({ sessionId: "sesi-1", roomId: "ruangan-2", order: ["p5", "p1"] }), 404);
  });
});
