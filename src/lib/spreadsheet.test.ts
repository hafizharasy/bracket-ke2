import { describe, expect, it } from "vitest";

import { rowsToCsv } from "@/lib/spreadsheet";
import { parseParticipantCsv } from "@/server/participant-import";

describe("rowsToCsv", () => {
  it("mengubah baris Excel menjadi CSV yang dibaca impor peserta", () => {
    const csv = rowsToCsv([
      ["Nama", "Sekolah", "Sesi", "Ruangan"],
      ["  Budi Santoso ", "SMAN 3, Bandung", 1, "Ruangan 1"],
      ['Ani "Ani" Lestari', null, "Sesi 2", 2],
      [null, null, null, null],
    ]);
    expect(csv).toBe('Nama,Sekolah,Sesi,Ruangan\nBudi Santoso,"SMAN 3, Bandung",1,Ruangan 1\n"Ani ""Ani"" Lestari",,Sesi 2,2\n');
    const sessions = [{ id: "sesi-1", name: "Sesi 1" }, { id: "sesi-2", name: "Sesi 2" }];
    const rooms = [{ id: "ruangan-1", name: "Ruangan 1" }, { id: "ruangan-2", name: "Ruangan 2" }];
    const { rows, errors } = parseParticipantCsv(csv, sessions as never, rooms as never);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.values)).toMatchObject([
      { name: "Budi Santoso", teamOrClub: "SMAN 3, Bandung", sessionId: "sesi-1", roomId: "ruangan-1" },
      { name: 'Ani "Ani" Lestari', teamOrClub: null, sessionId: "sesi-2", roomId: "ruangan-2" },
    ]);
  });
});
