import { describe, expect, it } from "vitest";

import { ADMIN_ACTIONS, can, ROOM_ACTIONS } from "@/lib/policy";

const admin = { role: "admin" as const, roomId: null };
const pengawas1 = { role: "pengawas" as const, roomId: "ruangan-1" };

describe("can", () => {
  it("admin boleh semua aksi ruangan & admin", () => {
    for (const action of ROOM_ACTIONS) expect(can(admin, action, { roomId: "ruangan-7" })).toBe(true);
    for (const action of ADMIN_ACTIONS) expect(can(admin, action)).toBe(true);
  });

  it("pengawas hanya boleh aksi di ruangannya sendiri", () => {
    for (const action of ROOM_ACTIONS) {
      expect(can(pengawas1, action, { roomId: "ruangan-1" })).toBe(true);
      expect(can(pengawas1, action, { roomId: "ruangan-2" })).toBe(false);
    }
  });

  it("pengawas tidak boleh aksi admin", () => {
    for (const action of ADMIN_ACTIONS) expect(can(pengawas1, action)).toBe(false);
  });

  it("tanpa login, pengawas tanpa ruangan, atau peran tak dikenal → ditolak", () => {
    expect(can(null, "result:write", { roomId: "ruangan-1" })).toBe(false);
    expect(can({ role: "pengawas", roomId: null }, "room:view", { roomId: "ruangan-1" })).toBe(false);
    expect(can({ role: "tamu" as never, roomId: "ruangan-1" }, "room:view", { roomId: "ruangan-1" })).toBe(false);
  });
});
