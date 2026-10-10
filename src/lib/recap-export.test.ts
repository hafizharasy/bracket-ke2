import { describe, expect, it } from "vitest";

import { getMockRecap } from "@/lib/mock/recap-data";
import { reportCsv, reportFilename, toCsv } from "@/lib/recap-export";

describe("ekspor CSV", () => {
  it("mengutip sel bila perlu, menetralkan formula, dan memakai BOM + CRLF", () => {
    const csv = toCsv(["a", "b"], [["x;y", 'kata "kutip"'], ["=SUM(A1)", null]], ";");
    expect(csv).toBe('﻿a;b\r\n"x;y";"kata ""kutip"""\r\n\'=SUM(A1);\r\n');
    expect(toCsv(["a"], [["x;y"]], ",")).toBe("﻿a\r\nx;y\r\n");
  });

  it("menyusun laporan hasil, pelanggaran, dan juara sesuai filter", () => {
    const recap = getMockRecap({ sesi: "sesi-1", ruangan: "ruangan-2" });
    const lines = (csv: string) => csv.trim().split("\r\n");
    expect(lines(reportCsv(recap, "hasil"))).toHaveLength(1 + 63);
    expect(lines(reportCsv(recap, "hasil"))[1]).toContain("Sesi 1;Ruangan 2;64 Besar Ruangan;1;");
    expect(lines(reportCsv(recap, "pelanggaran"))).toHaveLength(1 + recap.violations.length);
    expect(lines(reportCsv(recap, "juara"))).toEqual(["Sesi;Ruangan;Juara ruangan", expect.stringMatching(/^Sesi 1;Ruangan 2;.+/)]);
    expect(reportFilename("hasil", recap)).toMatch(/^rekap-hasil-sesi-1-ruangan-2-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("laporan juara tanpa filter menyertakan baris juara turnamen", () => {
    const csv = reportCsv(getMockRecap({}), "juara", ",");
    expect(csv.trim().split("\r\n").at(-1)).toBe("Turnamen,Final,Belum ditentukan");
  });
});
