import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { authAccounts, loginAttempts, rooms, users } from "@/db/schema";
import { hashUserPassword, storePasswordHash } from "@/server/credentials";
import { loginFailureStatus, loginWithPassword } from "@/server/login";
import { MAX_FAILED_ATTEMPTS } from "@/server/login-attempts";

const req = { headers: new Headers({ "x-forwarded-for": "10.0.0.7" }) };
const attempt = (email: string, password: string, role: "admin" | "pengawas" = "pengawas") =>
  loginWithPassword({ email, password }, role, req);

beforeAll(async () => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(async () => {
  for (const table of [loginAttempts, authAccounts, users, rooms]) db.delete(table).run();
  db.insert(rooms).values({ id: "ruangan-1", name: "Ruangan 1" }).run();
  db.insert(users).values([
    { id: "u-p", name: "P", email: "p@lrp.id", role: "pengawas", roomId: "ruangan-1" },
    { id: "u-a", name: "A", email: "a@lrp.id", role: "admin" },
  ]).run();
  const hash = await hashUserPassword("sandi-benar");
  storePasswordHash(db, "u-p", hash);
  storePasswordHash(db, "u-a", hash);
});

describe("loginWithPassword (jalur gagal)", () => {
  it("sandi salah & email tak dikenal → pesan sama, dicatat dengan IP", async () => {
    const wrong = await attempt("p@lrp.id", "salah");
    const unknown = await attempt("tidak-ada@lrp.id", "salah");
    expect(wrong).toMatchObject({ ok: false, code: "wrong", error: "Email atau sandi salah." });
    expect(unknown).toMatchObject({ ok: false, code: "wrong", error: "Email atau sandi salah." });
    expect(db.select().from(loginAttempts).all()).toEqual([
      expect.objectContaining({ email: "p@lrp.id", success: false, ipAddress: "10.0.0.7" }),
      expect.objectContaining({ email: "tidak-ada@lrp.id", success: false }),
    ]);
    expect(loginFailureStatus("wrong")).toBe(401);
  });

  it("peran salah dan akun nonaktif ditolak dengan penjelasan", async () => {
    expect(await attempt("a@lrp.id", "sandi-benar", "pengawas")).toMatchObject({ code: "role", hint: { href: "/masuk/admin" } });
    expect(await attempt("p@lrp.id", "sandi-benar", "admin")).toMatchObject({ code: "role", hint: { href: "/masuk" } });
    db.update(users).set({ active: false }).where(eq(users.id, "u-p")).run();
    expect(await attempt("p@lrp.id", "sandi-benar")).toMatchObject({ code: "inactive" });
  });

  it("dikunci setelah batas gagal — sandi benar pun ditolak sampai kunci berakhir", async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await attempt("p@lrp.id", "salah");
    const locked = await attempt("p@lrp.id", "sandi-benar");
    expect(locked).toMatchObject({ ok: false, code: "locked" });
    expect(locked.ok === false && locked.retryAt).toBeTruthy();
    expect(loginFailureStatus("locked")).toBe(423);
  });
});
