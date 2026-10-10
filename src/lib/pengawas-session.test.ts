import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/pengawas-session";

describe("safeNext", () => {
  it("mengizinkan path area pengawas", () => {
    expect(safeNext("/ruangan/riwayat")).toBe("/ruangan/riwayat");
    expect(safeNext("/ruangan/laga/m-s1-r1-b1-1")).toBe("/ruangan/laga/m-s1-r1-b1-1");
    expect(safeNext("/ruangan?sesi=sesi-2")).toBe("/ruangan?sesi=sesi-2");
  });

  it("menolak tujuan lain (cegah open redirect)", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/admin", "/ruanganX", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/ruangan");
    }
  });
});
