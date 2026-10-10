import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { rooms, users } from "@/db/schema";
import { getSessionUser } from "@/server/auth";

// Tanpa header, getSessionUser jatuh ke sesi stub pengawas (butuh cookies Next).
vi.mock("@/lib/pengawas-session", () => ({ getPengawasSession: async () => null }));

const request = (id: string) => new Request("http://x/api", { headers: { "x-dev-user-id": id } });

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  db.delete(users).run();
  db.delete(rooms).run();
  db.insert(rooms).values({ id: "ruangan-1", name: "Ruangan 1" }).run();
  db.insert(users).values({ id: "u-p1", name: "P1", email: "p1@x", passwordHash: "!", role: "pengawas", roomId: "ruangan-1" }).run();
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
