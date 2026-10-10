import { describe, expect, it } from "vitest";

import { nextParticipantIds, parseCsv, parseParticipantCsv } from "@/server/participant-import";

const sessions = [1, 2].map((n) => ({ id: `sesi-${n}`, name: `Sesi ${n}`, orderIndex: n, startTime: null }));
const rooms = [1, 2, 3].map((n) => ({ id: `ruangan-${n}`, name: `Ruangan ${n}`, location: null }));

describe("parseCsv", () => {
  it("menangani kutip, koma dalam sel, titik koma, dan CRLF", () => {
    expect(parseCsv('nama,klub\r\n"Budi, S.",LRP\r\n\r\n')).toEqual([["nama", "klub"], ["Budi, S.", "LRP"]]);
    expect(parseCsv("nama;klub\nAni;\"LRP \"\"A\"\"\"\n")).toEqual([["nama", "klub"], ["Ani", 'LRP "A"']]);
  });
});

describe("parseParticipantCsv", () => {
  it("memetakan sesi/ruangan dari ID, nama, atau angka dan melaporkan galat per baris", () => {
    const csv = ["nama,klub,sesi,ruangan", "Budi,LRP Bandung,Sesi 1,Ruangan 2", "Ani,,2,3", "Cici,,sesi-9,", ",LRP,,", "Dodo,,,1", "Eka,,,"].join("\n");
    const { rows, errors } = parseParticipantCsv(csv, sessions, rooms);
    expect(rows.map((r) => r.values)).toEqual([
      { name: "Budi", teamOrClub: "LRP Bandung", sessionId: "sesi-1", roomId: "ruangan-2" },
      { name: "Ani", teamOrClub: null, sessionId: "sesi-2", roomId: "ruangan-3" },
      { name: "Eka", teamOrClub: null, sessionId: null, roomId: null },
    ]);
    expect(errors.map((e) => e.line)).toEqual([4, 5, 6]);
  });

  it("menolak berkas tanpa kolom nama", () => {
    expect(parseParticipantCsv("klub\nLRP", sessions, rooms).errors[0].message).toContain("nama");
  });
});

describe("nextParticipantIds", () => {
  it("melanjutkan nomor terbesar", () => {
    expect(nextParticipantIds(["p-001", "p-640", "x"], 2)).toEqual(["p-641", "p-642"]);
    expect(nextParticipantIds([], 1)).toEqual(["p-001"]);
  });
});
