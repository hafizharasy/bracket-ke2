import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { getLockout, LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS, recordLoginAttempt } from "@/server/login-attempts";

const fail = (email = "a@x.id") => recordLoginAttempt({ email, role: "pengawas", success: false });

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  db.delete(loginAttempts).run();
});

describe("penguncian login", () => {
  it("mengunci setelah batas gagal dan tidak memengaruhi email lain", () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) fail();
    expect(getLockout("A@x.id")).toEqual({ locked: false, remaining: 1 });
    fail();
    const lock = getLockout("a@x.id");
    expect(lock.locked).toBe(true);
    expect(getLockout("b@x.id").locked).toBe(false);
  });

  it("login berhasil mengatur ulang hitungan gagal", () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) fail();
    recordLoginAttempt({ email: "a@x.id", role: "pengawas", success: true });
    fail();
    expect(getLockout("a@x.id")).toEqual({ locked: false, remaining: MAX_FAILED_ATTEMPTS - 1 });
  });

  it("kunci berakhir setelah jendela waktu lewat", () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) fail();
    const later = new Date(Date.now() + (LOCKOUT_MINUTES + 1) * 60_000);
    expect(getLockout("a@x.id", later).locked).toBe(false);
  });
});
