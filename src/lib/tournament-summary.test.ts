import { describe, expect, it } from "vitest";

import { mockBracket } from "@/lib/mock/bracket-data";
import { summarizeTournament } from "@/lib/tournament-summary";

describe("summarizeTournament", () => {
  it("meringkas data tiruan: Sesi 1–2 selesai, Sesi 3 berjalan", () => {
    const s = summarizeTournament(mockBracket);
    expect(s.participants).toBe(640);
    expect(s.matches.total).toBe(655);
    expect(s.matches.done + s.matches.ongoing + s.matches.scheduled).toBe(655);
    expect(s.activeSession).toMatchObject({ id: "sesi-3", state: "berjalan" });
    expect(s.sessions[0]).toMatchObject({ done: 189, total: 189 });
    expect(s.roomChampions).toEqual({ decided: 6, total: 10 });
    expect(s.champion).toBeNull();
    expect(s.nextMatch).not.toBeNull();
  });
});
