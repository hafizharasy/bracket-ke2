import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { matches, participants, rooms, sessions, users, violations } from "@/db/schema";
import type { SessionUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { listRoomViolations, recordViolation, violationInput } from "@/server/violations";

const pengawas1: SessionUser = { id: "u-p1", name: "Pengawas 1", role: "pengawas", roomId: "ruangan-1" };
const admin: SessionUser = { id: "u-admin", name: "Admin", role: "admin", roomId: null };

function expectApiError(fn: () => unknown, status: number) {
  expect(fn).toThrow(ApiError);
  try {
    fn();
  } catch (error) {
    expect((error as ApiError).status).toBe(status);
  }
}

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));

beforeEach(() => {
  for (const table of [violations, matches, users, participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
  db.insert(participants).values([
    { id: "p1", name: "A", roomId: "ruangan-1" },
    { id: "p2", name: "B", roomId: "ruangan-1" },
    { id: "p3", name: "C", roomId: "ruangan-2" },
  ]).run();
  db.insert(users).values([
    { id: "u-p1", name: "Pengawas 1", email: "p1@x", passwordHash: "!", role: "pengawas", roomId: "ruangan-1" },
    { id: "u-admin", name: "Admin", email: "a@x", passwordHash: "!", role: "admin" },
  ]).run();
  db.insert(matches).values([
    { id: "m1", round: 1, matchNumber: 1, sessionId: "sesi-1", roomId: "ruangan-1", participantAId: "p1", participantBId: "p2" },
    { id: "m2", round: 1, matchNumber: 1, sessionId: "sesi-1", roomId: "ruangan-2", participantAId: "p3", participantBId: "p1" },
  ]).run();
});

describe("recordViolation", () => {
  it("menyimpan pelanggaran di ruangan pengawas dan muncul di daftar ruangan", () => {
    const v = recordViolation({ participantId: "p1", matchId: "m1", type: "Terlambat hadir" }, pengawas1);
    expect(v).toMatchObject({ roomId: "ruangan-1", matchId: "m1", recordedBy: "Pengawas 1" });
    expect(listRoomViolations("ruangan-1")).toHaveLength(1);
    expect(listRoomViolations("ruangan-2")).toHaveLength(0);
  });

  it("ruangan mengikuti laga, jadi pengawas tidak bisa mencatat laga ruangan lain", () => {
    expectApiError(() => recordViolation({ participantId: "p1", matchId: "m2", type: "Terlambat hadir" }, pengawas1), 403);
    expect(recordViolation({ participantId: "p1", matchId: "m2", type: "Terlambat hadir" }, admin).roomId).toBe("ruangan-2");
  });

  it("menolak peserta yang tidak bertanding di laga itu atau tidak terdaftar di ruangan", () => {
    expectApiError(() => recordViolation({ participantId: "p3", matchId: "m1", type: "Lainnya", note: "x" }, pengawas1), 422);
    expectApiError(() => recordViolation({ participantId: "p3", type: "Terlambat hadir" }, pengawas1), 422);
  });

  it("validasi input: jenis baku, Lainnya wajib catatan", () => {
    expect(violationInput.safeParse({ participantId: "p1", type: "Bebas" }).success).toBe(false);
    expect(violationInput.safeParse({ participantId: "p1", type: "Lainnya" }).success).toBe(false);
    expect(violationInput.safeParse({ participantId: "p1", type: "Lainnya", note: "kronologi" }).success).toBe(true);
  });
});

describe("getRoomViolationSummary", () => {
  it("menghitung total, peserta terlibat, per jenis, per peserta, dan filter sesi", async () => {
    const { getRoomViolationSummary } = await import("@/server/violations");
    db.insert(sessions).values({ id: "sesi-2", name: "Sesi 2", orderIndex: 2 }).run();
    db.update(participants).set({ sessionId: "sesi-2" }).run();
    recordViolation({ participantId: "p1", matchId: "m1", type: "Terlambat hadir" }, pengawas1);
    recordViolation({ participantId: "p1", type: "Terlambat hadir" }, pengawas1);
    recordViolation({ participantId: "p2", matchId: "m1", type: "Lainnya", note: "x" }, pengawas1);

    const all = getRoomViolationSummary("ruangan-1");
    expect(all).toMatchObject({ total: 3, participantsInvolved: 2 });
    expect(all.byType[0]).toEqual({ type: "Terlambat hadir", count: 2 });
    expect(all.byParticipant[0]).toMatchObject({ participantId: "p1", count: 2 });
    expect(all.violations[0].matchLabel === null || typeof all.violations[0].matchLabel === "string").toBe(true);

    // Laga m1 di sesi-1; pelanggaran tanpa laga mengikuti sesi peserta (sesi-2).
    expect(getRoomViolationSummary("ruangan-1", "sesi-1").total).toBe(2);
    expect(getRoomViolationSummary("ruangan-1", "sesi-2").total).toBe(1);
    expect(getRoomViolationSummary("ruangan-2").total).toBe(0);
  });
});
