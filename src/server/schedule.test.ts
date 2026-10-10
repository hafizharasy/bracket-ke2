import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { matches, participants, rooms, sessions } from "@/db/schema";
import { ApiError } from "@/server/errors";
import {
  createRoom,
  createSession,
  deleteRoom,
  deleteSession,
  getSchedule,
  listRooms,
  listSessions,
  updateRoom,
  updateSessionSchedule,
} from "@/server/schedule";

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

const at = (hhmm: string) => new Date(`2026-11-01T${hhmm}:00+07:00`);
const matchTime = (id: string) => db.select().from(matches).where(eq(matches.id, id)).get()!.scheduledAt?.toISOString();

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matches, participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values([
    { id: "sesi-1", name: "Sesi 1", orderIndex: 1, startTime: at("08:00") },
    { id: "sesi-2", name: "Sesi 2", orderIndex: 2, startTime: at("10:00") },
  ]).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
  db.insert(participants).values([{ id: "p1", name: "Budi" }, { id: "p2", name: "Sari" }]).run();
  const base = { sessionId: "sesi-1", roomId: "ruangan-1", round: 1 };
  db.insert(matches).values([
    { ...base, id: "m1", matchNumber: 1, scheduledAt: at("08:00"), participantAId: "p1", participantBId: "p2", status: "done" },
    { ...base, id: "m2", matchNumber: 2, scheduledAt: at("08:10") },
    { ...base, id: "m3", matchNumber: 3, scheduledAt: at("10:00"), sessionId: "sesi-2" },
  ]).run();
});

describe("updateSessionSchedule", () => {
  it("menggeser jadwal laga belum selesai di sesi itu", () => {
    const result = updateSessionSchedule("sesi-1", { name: "Sesi Pagi", startTime: at("08:30").toISOString() });
    expect(result).toMatchObject({ shiftedMatches: 1, shiftMinutes: 30 });
    expect(matchTime("m1")).toBe(at("08:00").toISOString());
    expect(matchTime("m2")).toBe(at("08:40").toISOString());
    expect(matchTime("m3")).toBe(at("10:00").toISOString());
  });

  it("menolak jam yang melewati sesi berikutnya dan nama ganda", () => {
    expectApiError(() => updateSessionSchedule("sesi-1", { name: "Sesi 1", startTime: at("10:00").toISOString() }), 422);
    expectApiError(() => updateSessionSchedule("sesi-1", { name: "sesi 2", startTime: at("08:00").toISOString() }), 409);
  });
});

describe("updateRoom & getSchedule", () => {
  it("menyimpan ruangan dan menyajikan jadwal terurut dengan nama peserta", () => {
    updateRoom("ruangan-1", { name: "Ruang Utama", location: "Gedung A" });
    expectApiError(() => updateRoom("ruangan-2", { name: "ruang utama", location: "" }), 409);

    const schedule = getSchedule({ sesi: "sesi-1" });
    expect(schedule.sessions).toEqual([
      expect.objectContaining({ id: "sesi-1", firstMatchAt: at("08:00").toISOString(), lastMatchAt: at("08:10").toISOString() }),
    ]);
    expect(schedule.matches.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(schedule.matches[0].participantA).toEqual({ id: "p1", name: "Budi" });
    expect(getSchedule({ ruangan: "ruangan-1" }).rooms).toEqual([{ id: "ruangan-1", name: "Ruang Utama", location: "Gedung A" }]);
  });
});

describe("CRUD sesi & ruangan", () => {
  it("menghitung pemakaian dan menambah dengan ID & urutan berikutnya", () => {
    expect(listSessions()[0]).toMatchObject({ id: "sesi-1", matches: 2, participants: 0 });
    expect(listRooms()[0]).toMatchObject({ id: "ruangan-1", matches: 3, pengawas: 0 });

    expect(createSession({ name: "Sesi 3", startTime: at("13:00").toISOString() })).toMatchObject({ id: "sesi-3", orderIndex: 3 });
    expectApiError(() => createSession({ name: "Sesi 4", startTime: at("09:00").toISOString() }), 422);
    expect(createRoom({ name: "Ruangan 3", location: "" })).toMatchObject({ id: "ruangan-3", location: null });
    expectApiError(() => createRoom({ name: "ruangan 3", location: "" }), 409);
  });

  it("hanya menghapus sesi/ruangan yang belum dipakai", () => {
    expectApiError(() => deleteSession("sesi-1"), 409);
    expectApiError(() => deleteRoom("ruangan-1"), 409);
    deleteRoom("ruangan-2");
    db.delete(matches).where(eq(matches.sessionId, "sesi-2")).run();
    deleteSession("sesi-2");
    expect(listSessions().map((s) => s.id)).toEqual(["sesi-1"]);
    expect(listRooms().map((r) => r.id)).toEqual(["ruangan-1"]);
    expectApiError(() => deleteRoom("ruangan-9"), 404);
  });
});
