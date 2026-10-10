import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { matches, participants, rooms, sessions } from "@/db/schema";
import { assignParticipants, autoAssign } from "@/server/assignments";
import { ApiError } from "@/server/errors";

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

const get = (id: string) => db.select().from(participants).where(eq(participants.id, id)).get()!;
const all = () => db.select().from(participants).all();
const countBy = (key: "sessionId" | "roomId", rows = all()) => {
  const m = new Map<string | null, number>();
  for (const p of rows) m.set(p[key], (m.get(p[key]) ?? 0) + 1);
  return m;
};

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matches, participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values([
    { id: "sesi-1", name: "Sesi 1", orderIndex: 1 },
    { id: "sesi-2", name: "Sesi 2", orderIndex: 2 },
  ]).run();
  db.insert(rooms).values([
    { id: "ruangan-1", name: "Ruangan 1" },
    { id: "ruangan-2", name: "Ruangan 2" },
  ]).run();
  // 40 peserta dari 4 klub, belum ditempatkan.
  db.insert(participants)
    .values(Array.from({ length: 40 }, (_, i) => ({
      id: `p-${String(i + 1).padStart(3, "0")}`,
      name: `Peserta ${i + 1}`,
      teamOrClub: `Klub ${(i % 4) + 1}`,
    })))
    .run();
});

describe("assignParticipants", () => {
  it("memindah sesi sekaligus mengosongkan ruangan lama", () => {
    db.update(participants).set({ sessionId: "sesi-1", roomId: "ruangan-1" }).where(eq(participants.id, "p-001")).run();
    assignParticipants({ ids: ["p-001"], sessionId: "sesi-2" });
    expect(get("p-001")).toMatchObject({ sessionId: "sesi-2", roomId: null });
  });

  it("menolak ruangan untuk peserta tanpa sesi dan ruangan yang penuh", () => {
    expectApiError(() => assignParticipants({ ids: ["p-001"], roomId: "ruangan-1" }), 422);
    const ids = all().slice(0, 17).map((p) => p.id);
    expectApiError(() => assignParticipants({ ids, sessionId: "sesi-1", roomId: "ruangan-1" }), 409);
    expect(get("p-001").sessionId).toBeNull();
  });

  it("menolak peserta yang sudah bertanding dan ID yang tidak ada", () => {
    db.update(participants).set({ sessionId: "sesi-1", roomId: "ruangan-1" }).run();
    db.insert(matches).values({
      id: "m1", sessionId: "sesi-1", roomId: "ruangan-1", round: 1, matchNumber: 1,
      participantAId: "p-001", participantBId: "p-002", status: "done",
    }).run();
    expectApiError(() => assignParticipants({ ids: ["p-001"], sessionId: "sesi-2" }), 409);
    expectApiError(() => assignParticipants({ ids: ["p-999"], sessionId: "sesi-2" }), 404);
  });
});

describe("autoAssign", () => {
  it("membagi rata ke sesi lalu ke ruangan dengan klub tersebar", () => {
    autoAssign({ kind: "sesi", mode: "unassigned" });
    expect([...countBy("sessionId").values()]).toEqual([20, 20]);

    autoAssign({ kind: "ruangan", mode: "unassigned", sessionId: "sesi-1" });
    const inSession = all().filter((p) => p.sessionId === "sesi-1");
    expect([...countBy("roomId", inSession).values()].sort()).toEqual([10, 10]);
    // Tiap klub (5 orang di sesi ini) tersebar ke dua ruangan.
    for (const room of ["ruangan-1", "ruangan-2"]) {
      const clubs = new Set(inSession.filter((p) => p.roomId === room).map((p) => p.teamOrClub));
      expect(clubs.size).toBe(4);
    }
  });

  it("mode 'unassigned' hanya mengisi yang belum dan menghormati isi yang ada", () => {
    db.update(participants).set({ sessionId: "sesi-1" }).where(eq(participants.teamOrClub, "Klub 1")).run();
    autoAssign({ kind: "sesi", mode: "unassigned" });
    expect(countBy("sessionId").get("sesi-1")).toBe(20);
    expect(all().filter((p) => p.teamOrClub === "Klub 1").every((p) => p.sessionId === "sesi-1")).toBe(true);
  });

  it("menolak bila kapasitas ruangan tidak cukup", () => {
    db.update(participants).set({ sessionId: "sesi-1" }).run();
    expectApiError(() => autoAssign({ kind: "ruangan", mode: "all", sessionId: "sesi-1" }), 409);
  });
});
