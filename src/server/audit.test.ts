import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { listAudit, recordAudit } from "@/server/audit";
import { clearUsers } from "@/test/db";

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  db.delete(auditLogs).run();
  clearUsers();
  db.insert(users).values([
    { id: "a1", name: "Admin Satu", email: "a1@x", role: "admin" },
    { id: "a2", name: "Admin Dua", email: "a2@x", role: "admin" },
  ]).run();
});

describe("admin aktif terakhir", () => {
  it("boleh menonaktifkan admin selama masih ada admin aktif lain", () => {
    db.update(users).set({ active: false }).where(eq(users.id, "a2")).run();
    expect(() => db.update(users).set({ active: false }).where(eq(users.id, "a1")).run()).toThrow(/admin aktif terakhir/);
    expect(() => db.delete(users).where(eq(users.id, "a1")).run()).toThrow(/admin aktif terakhir/);
    // Admin nonaktif boleh dihapus.
    db.delete(users).where(eq(users.id, "a2")).run();
    expect(db.select().from(users).all()).toHaveLength(1);
  });
});

describe("jejak aksi admin", () => {
  it("mencatat dan menampilkan terbaru dulu dengan nama pencatat", () => {
    recordAudit({ actorId: "a1", action: "room.update", entity: "room", entityId: "ruangan-1", summary: "Ruangan 1 → Aula" });
    recordAudit({ actorId: "a2", action: "account.create", entity: "user", entityId: "u-x", summary: "Akun baru" });
    const list = listAudit();
    expect(list.map((e) => e.action)).toEqual(["account.create", "room.update"]);
    expect(list[1]).toMatchObject({ actorName: "Admin Satu", entityId: "ruangan-1" });
  });
});
