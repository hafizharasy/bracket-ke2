import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { monitorRooms } from "@/lib/room-monitor";

describe("monitorRooms", () => {
  it("memakai sesi aktif (Sesi 3 berjalan) dan menandai ruangan berlangsung", () => {
    const { sessionId, rooms } = monitorRooms(mockBracket, new Map([["ruangan-1", 3]]));
    expect(sessionId).toBe("sesi-3");
    expect(rooms).toHaveLength(2); // Sesi 3 memakai Ruangan 1–2
    expect(rooms[0]).toMatchObject({ status: "berlangsung", total: 63, violations: 3 });
    expect(rooms[0].live.length).toBeGreaterThan(0);
  });

  it("sesi yang sudah selesai → semua ruangan selesai dengan juara ruangan", () => {
    const { rooms } = monitorRooms(mockBracket, new Map(), "sesi-1");
    expect(rooms.every((r) => r.status === "selesai" && r.champion)).toBe(true);
  });

  it("sesi yang belum mulai → siap dimainkan", () => {
    const { rooms } = monitorRooms(mockBracket, new Map(), "sesi-4");
    expect(rooms.every((r) => r.status === "siap" && r.done === 0 && r.next)).toBe(true);
  });
});
