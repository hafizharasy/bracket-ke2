// Tes akses endpoint pelanggaran: pengawas hanya ruangannya, admin semua.
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postViolation } from "@/app/api/violations/route";
import { GET as getParticipantViolations } from "@/app/api/participants/[id]/violations/route";
import { GET as getRoomViolations } from "@/app/api/rooms/[id]/violations/route";
import { db } from "@/db";
import { matches, participants, rooms, sessions, users, violations } from "@/db/schema";
import { clearUsers } from "@/test/db";

// Tanpa header x-dev-user-id, sesi stub menunjuk akun yang tidak ada → anonim.
vi.mock("@/lib/pengawas-session", () => ({
  getPengawasSession: async () => ({ userId: "tidak-ada", name: "-", roomId: "ruangan-1" }),
}));

const req = (url: string, user?: string, body?: unknown) =>
  new Request(`http://test${url}`, {
    method: body ? "POST" : "GET",
    headers: { ...(user ? { "x-dev-user-id": user } : {}), "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));

beforeEach(() => {
  for (const table of [violations, matches]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
  db.insert(participants).values([
    { id: "p1", name: "A", roomId: "ruangan-1" },
    { id: "p2", name: "B", roomId: "ruangan-1" },
    { id: "p3", name: "C", roomId: "ruangan-2" },
    { id: "p4", name: "D", roomId: "ruangan-2" },
  ]).run();
  db.insert(users).values([
    { id: "u-p1", name: "P1", email: "p1@x", role: "pengawas", roomId: "ruangan-1" },
    { id: "u-p2", name: "P2", email: "p2@x", role: "pengawas", roomId: "ruangan-2" },
    { id: "u-admin", name: "Admin", email: "a@x", role: "admin" },
  ]).run();
  db.insert(matches).values([
    { id: "m1", round: 1, matchNumber: 1, sessionId: "sesi-1", roomId: "ruangan-1", participantAId: "p1", participantBId: "p2" },
    { id: "m2", round: 1, matchNumber: 1, sessionId: "sesi-1", roomId: "ruangan-2", participantAId: "p3", participantBId: "p4" },
  ]).run();
});

describe("POST /api/violations", () => {
  it("pengawas mencatat di ruangannya (201), ditolak di ruangan lain (403), anonim 401", async () => {
    expect((await postViolation(req("/api/violations", "u-p1", { participantId: "p1", matchId: "m1", type: "Terlambat hadir" }))).status).toBe(201);
    expect((await postViolation(req("/api/violations", "u-p1", { participantId: "p3", matchId: "m2", type: "Terlambat hadir" }))).status).toBe(403);
    expect((await postViolation(req("/api/violations", "u-p1", { participantId: "p3", roomId: "ruangan-2", type: "Terlambat hadir" }))).status).toBe(403);
    expect((await postViolation(req("/api/violations", undefined, { participantId: "p1", type: "Terlambat hadir" }))).status).toBe(401);
    expect((await postViolation(req("/api/violations", "u-admin", { participantId: "p3", matchId: "m2", type: "Terlambat hadir" }))).status).toBe(201);
  });
});

describe("GET pelanggaran", () => {
  beforeEach(async () => {
    await postViolation(req("/api/violations", "u-p1", { participantId: "p1", matchId: "m1", type: "Terlambat hadir" }));
    await postViolation(req("/api/violations", "u-p2", { participantId: "p3", matchId: "m2", type: "Tidak hadir (WO)" }));
  });

  it("ringkasan ruangan: hanya ruangan sendiri, admin semua", async () => {
    const own = await getRoomViolations(req("/api/rooms/ruangan-1/violations", "u-p1"), ctx({ id: "ruangan-1" }));
    expect(own.status).toBe(200);
    expect((await own.json()).total).toBe(1);
    expect((await getRoomViolations(req("/api/rooms/ruangan-2/violations", "u-p1"), ctx({ id: "ruangan-2" }))).status).toBe(403);
    expect((await getRoomViolations(req("/api/rooms/ruangan-2/violations", "u-admin"), ctx({ id: "ruangan-2" }))).status).toBe(200);
  });

  it("per peserta: pengawas hanya melihat catatan di ruangannya", async () => {
    // p3 punya pelanggaran di ruangan 2 → tidak terlihat oleh pengawas ruangan 1.
    const asP1 = await (await getParticipantViolations(req("/api/participants/p3/violations", "u-p1"), ctx({ id: "p3" }))).json();
    expect(asP1.total).toBe(0);
    const asAdmin = await (await getParticipantViolations(req("/api/participants/p3/violations", "u-admin"), ctx({ id: "p3" }))).json();
    expect(asAdmin.total).toBe(1);
    expect((await getParticipantViolations(req("/api/participants/p3/violations"), ctx({ id: "p3" }))).status).toBe(401);
  });
});
