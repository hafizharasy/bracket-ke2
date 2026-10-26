import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { auditLogs, matches, matchOfficials, participants, rooms, sessionRooms, sessions } from "@/db/schema";
import { mockBracket } from "@/lib/mock/bracket-data";
import { generateBracketStructure } from "@/server/bracket-structure";
import { getMatchReferees } from "@/server/match-officials";
import { parseCsv } from "@/server/participant-import";
import { importRefereesCsv, parseRefereeCsv, REFEREE_HEADER, refereeSheetCsv } from "@/server/referee-import";

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matchOfficials, matches, auditLogs, participants, sessionRooms, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values(mockBracket.sessions.map((s) => ({ ...s, startTime: new Date(s.startTime!) }))).run();
  db.insert(rooms).values(mockBracket.rooms).run();
  db.insert(sessionRooms).values(mockBracket.sessionRooms).run();
  for (let i = 0; i < mockBracket.participants.length; i += 100) db.insert(participants).values(mockBracket.participants.slice(i, i + 100)).run();
  generateBracketStructure({}, null);
});

describe("impor nama pengawas", () => {
  it("daftar laga berisi semua laga dan bisa diunggah kembali setelah kolom Pengawas diisi", () => {
    const [header, ...rows] = parseCsv(refereeSheetCsv(";").replace(/^﻿/, ""));
    expect(header).toEqual(REFEREE_HEADER);
    expect(rows).toHaveLength(655);
    expect(rows[0].slice(1, 5)).toEqual(["Sesi 1", "Ruangan 1", "64 Besar Ruangan", "1"]);

    const filled = [header, ["m-s1-r1-b1-1", ...rows[0].slice(1, 8), "Pak Budi"], ["m-s1-r1-b1-2", ...rows[1].slice(1, 8), ""]];
    const csv = filled.map((r) => r.join(";")).join("\n");
    expect(importRefereesCsv(csv, { dryRun: true }).summary).toEqual({ filled: 1, skipped: 1, errors: 0 });
    expect(getMatchReferees().size).toBe(0);
    expect(importRefereesCsv(csv).saved).toBe(true);
    expect(getMatchReferees().get("m-s1-r1-b1-1")).toBe("Pak Budi");
  });

  it("mengenali laga dari Sesi + Ruangan + Babak + Laga tanpa ID, dan melaporkan baris yang salah", () => {
    const csv = [
      "Sesi,Ruangan,Babak,Laga,Pengawas",
      "Sesi 1,Ruangan 1,1,2,Bu Sari",
      "2,1,32 Besar Ruangan,1,Pak Andi",
      "Sesi 9,Ruangan 1,1,1,X",
      "Sesi 1,Ruangan 1,1,99,Y",
      "Sesi 1,Ruangan 1,1,2,Ganda",
      "Sesi 1,Ruangan 1,babak aneh,1,Z",
    ].join("\n");
    const { entries, errors } = parseRefereeCsv(csv);
    expect(entries.map((e) => [e.matchId, e.refereeName])).toEqual([
      ["m-s1-r1-b1-2", "Bu Sari"],
      ["m-s2-r1-b2-1", "Pak Andi"],
    ]);
    expect(errors.map((e) => e.line)).toEqual([4, 5, 6, 7]);
    expect(errors[0].message).toMatch(/Sesi "Sesi 9"/);
    expect(errors[2].message).toMatch(/baris 2/);
    // Ada galat → tidak ada yang disimpan.
    expect(importRefereesCsv(csv).saved).toBe(false);
    expect(getMatchReferees().size).toBe(0);
  });

  it("menolak berkas tanpa kolom Pengawas", () => {
    expect(parseRefereeCsv("Sesi,Ruangan\n1,1").errors[0].message).toMatch(/Pengawas/);
  });
});
