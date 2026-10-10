import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { attentionItems } from "@/server/dashboard";

const allRooms = mockBracket.rooms.map((r) => ({ active: true, roomId: r.id }));

describe("attentionItems", () => {
  it("kosong bila jadwal lengkap dan tiap ruangan punya pengawas aktif", () => {
    expect(attentionItems(mockBracket, allRooms)).toEqual([]);
  });

  it("melaporkan ruangan tanpa pengawas aktif dan jadwal yang belum lengkap", () => {
    const accounts = allRooms.map((a, i) => (i === 0 ? { ...a, active: false } : a));
    const participants = mockBracket.participants.map((p, i) => (i === 0 ? { ...p, sessionId: null } : p));
    const items = attentionItems({ ...mockBracket, participants }, accounts);
    expect(items).toContainEqual({ text: "Ruangan 1 belum punya pengawas aktif", href: "/admin/pengawas" });
    expect(items.some((i) => i.text.includes("1 peserta belum punya sesi") && i.href === "/admin/peserta/sesi")).toBe(true);
  });
});

describe("getDashboardRevision", () => {
  it("berubah saat akun berubah, ada pelanggaran baru, atau versi bagan naik", async () => {
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const { db } = await import("@/db");
    const { bracketState, participants, rooms, users, violations } = await import("@/db/schema");
    const { getDashboardRevision } = await import("@/server/dashboard");
    migrate(db, { migrationsFolder: "drizzle" });
    for (const table of [violations, users, participants, rooms]) db.delete(table).run();
    db.insert(rooms).values({ id: "ruangan-1", name: "Ruangan 1" }).run();
    db.insert(participants).values({ id: "p1", name: "P1" }).run();

    const seen = new Set([await getDashboardRevision()]);
    db.insert(users).values({ id: "u1", name: "U", email: "u@x", role: "admin" }).run();
    seen.add(await getDashboardRevision());
    db.insert(violations).values({ id: "v1", participantId: "p1", roomId: "ruangan-1", type: "Terlambat hadir", recordedBy: "u1" }).run();
    seen.add(await getDashboardRevision());
    db.update(bracketState).set({ version: 99 }).run();
    seen.add(await getDashboardRevision());
    expect(seen.size).toBe(4);
    expect(await getDashboardRevision()).toBe([...seen].at(-1));
  });
});
