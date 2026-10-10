// Pasangan semifinal diatur admin: dua juara ruangan-sesi per laga
// semifinal (best of 3). Yang diubah hanyalah tautan `nextMatchId` final
// ruangan → laga semifinal; slot semifinal lalu dihitung ulang dari final
// ruangan yang sudah selesai.

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { LAST_ROOM_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { recordAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";
import { repropagateAll } from "@/server/propagation";

/** pairs[k] = dua ID laga final ruangan untuk semifinal ke-(k+1). */
export const semifinalPairsInput = z.object({
  pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(1).max(100),
});

export function setSemifinalPairs(pairs: [string, string][], actorId: string | null) {
  const semis = db
    .select()
    .from(matches)
    .where(eq(matches.round, SEMIFINAL_ROUND))
    .all()
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const roomFinals = db.select().from(matches).where(eq(matches.round, LAST_ROOM_ROUND)).all();
  if (semis.length === 0) throw new ApiError(409, "Struktur bagan belum dibuat.");
  if (pairs.length !== semis.length) throw new ApiError(422, `Harus ada tepat ${semis.length} pasangan semifinal.`);

  const ids = pairs.flat();
  const known = new Set(roomFinals.map((m) => m.id));
  if (ids.some((id) => !known.has(id))) throw new ApiError(422, "Pasangan harus berisi laga final ruangan.");
  if (new Set(ids).size !== ids.length || ids.length !== roomFinals.length) {
    throw new ApiError(422, "Setiap juara ruangan harus dipasangkan tepat satu kali.");
  }
  if (semis.some((m) => m.status !== "scheduled")) {
    throw new ApiError(409, "Semifinal sudah dimulai; pasangan tidak bisa diubah lagi.");
  }

  return db.transaction((tx) => {
    pairs.forEach(([a, b], k) => {
      tx.update(matches).set({ nextMatchId: semis[k].id }).where(inArray(matches.id, [a, b])).run();
    });
    // Slot semifinal disusun ulang dari final ruangan yang sudah punya juara.
    tx.update(matches)
      .set({ participantAId: null, participantBId: null })
      .where(and(eq(matches.round, SEMIFINAL_ROUND), eq(matches.status, "scheduled")))
      .run();
    const report = repropagateAll(tx);
    if (report.conflicts.length) throw new ApiError(409, `Gagal menyusun slot semifinal: ${report.conflicts[0]}`);
    bumpBracketVersion(tx);
    recordAudit(
      { actorId, action: "bracket.semifinal-pairs", entity: "bracket", entityId: null, summary: `Pasangan ${pairs.length} semifinal diatur ulang.` },
      tx,
    );
    return { semifinals: pairs.length, filled: report.filled };
  });
}
