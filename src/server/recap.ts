import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { getBracketFromDb } from "@/db/queries/bracket";
import { matchResultHistory, matchResults, users } from "@/db/schema";
import { buildRecap, type RecapData, type RecapFilters, type ResultMeta } from "@/lib/recap";
import { listViolations } from "@/server/violations";

/** Pencatat, waktu catat, bukti, dan jumlah koreksi tiap laga yang punya hasil. */
export function resultMeta(): Map<string, ResultMeta> {
  const corrections = new Map(
    db
      .select({ matchId: matchResultHistory.matchId, n: count() })
      .from(matchResultHistory)
      .where(eq(matchResultHistory.action, "correct"))
      .groupBy(matchResultHistory.matchId)
      .all()
      .map((r) => [r.matchId, r.n]),
  );
  return new Map(
    db
      .select({ matchId: matchResults.matchId, recordedAt: matchResults.recordedAt, recorder: users.name, proof: matchResults.proofPhotoUrl })
      .from(matchResults)
      .leftJoin(users, eq(users.id, matchResults.recordedBy))
      .all()
      .map((r) => [
        r.matchId,
        {
          recordedAt: r.recordedAt?.toISOString() ?? null,
          recordedBy: r.recorder ?? null,
          corrections: corrections.get(r.matchId) ?? 0,
          hasProof: !!r.proof,
        },
      ]),
  );
}

/** Rekap dari database: hasil laga (+ pencatat & koreksi) dan pelanggaran, sesuai filter. */
export function getDbRecap(filters: RecapFilters): RecapData {
  return buildRecap(getBracketFromDb(), listViolations(), filters, resultMeta());
}
