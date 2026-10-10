import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { authAccounts, rooms, users } from "@/db/schema";
import { getSessionUser } from "@/server/auth";
import { clearUsers } from "@/test/db";

// Tanpa header, getSessionUser jatuh ke sesi stub pengawas (butuh cookies Next).
vi.mock("@/lib/pengawas-session", () => ({ getPengawasSession: async () => null }));

const request = (id: string) => new Request("http://x/api", { headers: { "x-dev-user-id": id } });

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  db.delete(authAccounts).run();
  clearUsers();
  db.delete(rooms).run();
  db.insert(rooms).values({ id: "ruangan-1", name: "Ruangan 1" }).run();
  db.insert(users).values({ id: "u-p1", name: "P1", email: "p1@x", role: "pengawas", roomId: "ruangan-1" }).run();
});

describe("getSessionUser", () => {
  it("akun baru aktif secara default", async () => {
    expect(db.select().from(users).get()).toMatchObject({ active: true, lastLoginAt: null });
    expect(await getSessionUser(request("u-p1"))).toMatchObject({ id: "u-p1", roomId: "ruangan-1" });
  });

  it("akun nonaktif dianggap belum login", async () => {
    db.update(users).set({ active: false }).where(eq(users.id, "u-p1")).run();
    expect(await getSessionUser(request("u-p1"))).toBeNull();
  });
});

describe("kredensial", () => {
  it("menyimpan hash sandi (bukan teks asli) yang bisa diverifikasi, lalu menggantinya", async () => {
    const { verifyPassword } = await import("better-auth/crypto");
    const { hashUserPassword, storePasswordHash } = await import("@/server/credentials");

    storePasswordHash(db, "u-p1", await hashUserPassword("sandi-lama-1"));
    storePasswordHash(db, "u-p1", await hashUserPassword("sandi-baru-2"));
    const rows = db.select().from(authAccounts).where(eq(authAccounts.userId, "u-p1")).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ providerId: "credential", accountId: "u-p1" });
    expect(rows[0].password).not.toContain("sandi-baru-2");
    expect(await verifyPassword({ hash: rows[0].password!, password: "sandi-baru-2" })).toBe(true);
    expect(await verifyPassword({ hash: rows[0].password!, password: "sandi-lama-1" })).toBe(false);
    await expect(hashUserPassword("pendek")).rejects.toThrow();
  });
});
