import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { authAccounts, authSessions, rooms, sessions, users, violations, participants } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { createPengawas, deletePengawas, listPengawas, updatePengawas } from "@/server/pengawas-accounts";
import { clearUsers } from "@/test/db";

async function expectApiError(fn: () => unknown, status: number) {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error(`Diharapkan ApiError ${status}, tetapi tidak ada error.`);
}

const sessionCount = (userId: string) => db.select().from(authSessions).where(eq(authSessions.userId, userId)).all().length;
const addSession = (userId: string) =>
  db.insert(authSessions).values({ id: crypto.randomUUID(), token: crypto.randomUUID(), userId, expiresAt: new Date(Date.now() + 3600_000) }).run();

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [violations, authSessions, authAccounts]) db.delete(table).run();
  clearUsers();
  for (const table of [participants, rooms, sessions]) db.delete(table).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
});

const base = { name: "Pengawas Satu", email: "Satu@LRP.id", roomId: "ruangan-1", password: "rahasia-123" };

describe("akun pengawas", () => {
  it("membuat akun aktif dengan email huruf kecil dan sandi ter-hash", async () => {
    const account = await createPengawas({ ...base, email: "satu@lrp.id" });
    expect(account).toMatchObject({ email: "satu@lrp.id", roomId: "ruangan-1", active: true });
    const credential = db.select().from(authAccounts).where(eq(authAccounts.userId, account.id)).get()!;
    expect(await verifyPassword({ hash: credential.password!, password: "rahasia-123" })).toBe(true);
    expect(listPengawas()).toHaveLength(1);
  });

  it("menolak email ganda dan ruangan yang tidak ada", async () => {
    await createPengawas({ ...base, email: "satu@lrp.id" });
    await expectApiError(() => createPengawas({ ...base, email: "satu@lrp.id" }), 409);
    await expectApiError(() => createPengawas({ ...base, email: "dua@lrp.id", roomId: "ruangan-9" }), 422);
  });

  it("mengakhiri sesi saat pindah ruangan, ganti sandi, atau dinonaktifkan — tidak saat ganti nama", async () => {
    const { id } = await createPengawas({ ...base, email: "satu@lrp.id" });
    addSession(id);
    await updatePengawas(id, { name: "Nama Baru" });
    expect(sessionCount(id)).toBe(1);
    await updatePengawas(id, { roomId: "ruangan-2" });
    expect(sessionCount(id)).toBe(0);
    addSession(id);
    await updatePengawas(id, { active: false });
    expect(sessionCount(id)).toBe(0);
    expect(listPengawas()[0]).toMatchObject({ name: "Nama Baru", roomId: "ruangan-2", active: false });
  });

  it("menghapus akun tanpa jejak, menolak akun yang sudah mencatat pelanggaran", async () => {
    const a = await createPengawas({ ...base, email: "satu@lrp.id" });
    const b = await createPengawas({ ...base, email: "dua@lrp.id" });
    db.insert(participants).values({ id: "p1", name: "P1" }).run();
    db.insert(violations).values({ id: "v1", participantId: "p1", roomId: "ruangan-1", type: "lainnya", recordedBy: b.id }).run();
    deletePengawas(a.id);
    expect(db.select().from(authAccounts).where(eq(authAccounts.userId, a.id)).all()).toHaveLength(0);
    await expectApiError(() => deletePengawas(b.id), 409);
    await expectApiError(() => deletePengawas("u-x"), 404);
    expect(db.select().from(users).all().map((u) => u.id)).toEqual([b.id]);
  });
});

describe("sesi login akun", () => {
  it("menghitung sesi aktif dan mengeluarkan dari semua perangkat", async () => {
    const { logoutPengawasEverywhere } = await import("@/server/pengawas-accounts");
    const { purgeExpiredSessions } = await import("@/server/credentials");
    const { id } = await createPengawas({ ...base, email: "satu@lrp.id" });
    addSession(id);
    addSession(id);
    db.insert(authSessions).values({ id: "old", token: "old", userId: id, expiresAt: new Date(Date.now() - 1000) }).run();
    expect(listPengawas()[0].activeSessions).toBe(2);
    expect(purgeExpiredSessions()).toBe(1);
    expect(logoutPengawasEverywhere(id)).toEqual({ revoked: 2 });
    expect(listPengawas()[0].activeSessions).toBe(0);
    await expectApiError(() => logoutPengawasEverywhere("u-x"), 404);
  });
});
