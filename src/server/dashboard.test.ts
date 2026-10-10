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
