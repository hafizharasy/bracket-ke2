import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { summarizeTournament } from "@/lib/tournament-summary";

describe("summarizeTournament", () => {
  it("meringkas data tiruan: Sesi 1–2 selesai, Sesi 3 berjalan", () => {
    const s = summarizeTournament(mockBracket);
    expect(s.participants).toBe(640);
    expect(s.matches.total).toBe(639);
    expect(s.matches.done + s.matches.ongoing + s.matches.scheduled).toBe(639);
    expect(s.activeSession).toMatchObject({ id: "sesi-3", state: "berjalan" });
    expect(s.sessions[0]).toMatchObject({ done: 150, total: 150 });
    expect(s.roomChampions).toEqual({ decided: 20, total: 40 });
    expect(s.champion).toBeNull();
    expect(s.nextMatch).not.toBeNull();
  });
});
