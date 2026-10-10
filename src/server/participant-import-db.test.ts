import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditLogs, matches, matchOfficials, matchResultHistory, matchResults, participants, rooms, sessionRooms, sessions, violations } from "@/db/schema";
import { ApiError } from "@/server/errors";
import { importParticipantsCsv } from "@/server/participant-import";

const csv = (lines: string[]) => ["nama,sekolah,sesi,ruangan", ...lines].join("\n");
const all = () => db.select().from(participants).all();

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [violations, matchResultHistory, matchResults, matchOfficials, matches, auditLogs, participants, sessionRooms, rooms, sessions]) {
    db.delete(table).run();
  }
  db.insert(sessions).values([{ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }, { id: "sesi-2", name: "Sesi 2", orderIndex: 2 }]).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }]).run();
  // Ruangan 2 hanya dipakai di Sesi 1.
  db.insert(sessionRooms).values([
    { sessionId: "sesi-1", roomId: "ruangan-1" },
    { sessionId: "sesi-1", roomId: "ruangan-2" },
    { sessionId: "sesi-2", roomId: "ruangan-1" },
  ]).run();
});

describe("importParticipantsCsv", () => {
  it("memeriksa tanpa menyimpan, lalu menyimpan dengan ID berurutan dan jejak audit", () => {
    const text = csv(["Budi,SMAN 1,Sesi 1,Ruangan 2", "Ani,,2,1", "Cici,SMAN 2,,"]);
    const dry = importParticipantsCsv(text, { dryRun: true });
    expect(dry).toMatchObject({ saved: false, errors: [], summary: { valid: 3, withoutSession: 1, withoutRoom: 1 } });
    expect(all()).toHaveLength(0);

    expect(importParticipantsCsv(text, {}, null)).toMatchObject({ saved: true });
    expect(all().map((p) => [p.id, p.name, p.teamOrClub, p.sessionId, p.roomId])).toEqual([
      ["p-001", "Budi", "SMAN 1", "sesi-1", "ruangan-2"],
      ["p-002", "Ani", null, "sesi-2", "ruangan-1"],
      ["p-003", "Cici", "SMAN 2", null, null],
    ]);
    expect(db.select().from(auditLogs).all()[0]).toMatchObject({ action: "participant.import" });
  });

  it("menolak ruangan yang tidak dipakai sesinya dan ruangan-sesi yang melebihi 64 peserta; tidak menyimpan apa pun", () => {
    db.insert(participants).values(Array.from({ length: 63 }, (_, i) => ({ id: `p-${i + 1}`, name: `Lama ${i}`, sessionId: "sesi-2", roomId: "ruangan-1" }))).run();
    const result = importParticipantsCsv(csv(["Budi,,Sesi 2,Ruangan 2", "Ani,,2,1", "Cici,,2,1"]));
    expect(result.saved).toBe(false);
    expect(result.errors.map((e) => e.message)).toEqual([
      "Sesi 2 · Ruangan 1: 65 peserta (maks. 64, 63 sudah ada).",
      "Ruangan 2 tidak dipakai di Sesi 2.",
    ]);
    expect(all()).toHaveLength(63);
  });

  it("mode ganti menghapus peserta lama & bagan, tetapi ditolak bila laga sudah dimulai", () => {
    db.insert(participants).values({ id: "p-001", name: "Lama", sessionId: "sesi-1", roomId: "ruangan-1" }).run();
    db.insert(matches).values({ id: "m1", sessionId: "sesi-1", roomId: "ruangan-1", round: 1, matchNumber: 1, participantAId: "p-001" }).run();
    expect(importParticipantsCsv(csv(["Baru,,1,1"]), { replace: true })).toMatchObject({ saved: true });
    expect(all().map((p) => p.name)).toEqual(["Baru"]);
    expect(db.select().from(matches).all()).toHaveLength(0);

    db.insert(matches).values({ id: "m2", sessionId: "sesi-1", roomId: "ruangan-1", round: 1, matchNumber: 1, status: "ongoing" }).run();
    expect(() => importParticipantsCsv(csv(["Lagi,,1,1"]), { replace: true })).toThrow(ApiError);
    expect(db.select().from(participants).where(eq(participants.name, "Baru")).all()).toHaveLength(1);
  });
});
