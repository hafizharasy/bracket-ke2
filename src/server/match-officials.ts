// Nama pengawas (wasit) per laga — data PRIVAT admin. Disimpan di tabel
// terpisah (match_officials) supaya tidak pernah ikut terbaca oleh query
// bagan publik maupun data pengawas ruangan. Hanya dipanggil dari halaman
// & action admin.

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, matchOfficials } from "@/db/schema";
import { recordAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";

/** Nama bebas diketik admin; string kosong = hapus nama pengawas laga itu. */
export const refereeName = z.string().trim().max(100);
export const refereeEntriesInput = z
  .array(z.object({ matchId: z.string().min(1), refereeName }))
  .min(1)
  .max(200);

/** Nama pengawas per laga (matchId → nama). Tanpa argumen: semua laga. */
export function getMatchReferees(matchIds?: string[]): Map<string, string> {
  if (matchIds && matchIds.length === 0) return new Map();
  const rows = db
    .select({ matchId: matchOfficials.matchId, refereeName: matchOfficials.refereeName })
    .from(matchOfficials)
    .where(matchIds ? inArray(matchOfficials.matchId, matchIds) : undefined)
    .all();
  return new Map(rows.map((r) => [r.matchId, r.refereeName]));
}

/**
 * Simpan nama pengawas untuk satu atau beberapa laga sekaligus (mis. satu
 * ruangan). Nama kosong menghapus entri. Jejak audit tidak menyimpan nama.
 */
export function setMatchReferees(entries: z.infer<typeof refereeEntriesInput>, actorId: string | null) {
  const ids = [...new Set(entries.map((e) => e.matchId))];
  const known = new Set(
    db.select({ id: matches.id }).from(matches).where(inArray(matches.id, ids)).all().map((m) => m.id),
  );
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) throw new ApiError(404, `Laga tidak ditemukan: ${missing.slice(0, 5).join(", ")}.`);

  return db.transaction((tx) => {
    const now = new Date();
    let saved = 0;
    let cleared = 0;
    for (const { matchId, refereeName: name } of entries) {
      if (!name) {
        cleared += tx.delete(matchOfficials).where(eq(matchOfficials.matchId, matchId)).run().changes;
        continue;
      }
      tx.insert(matchOfficials)
        .values({ matchId, refereeName: name, updatedBy: actorId, updatedAt: now })
        .onConflictDoUpdate({ target: matchOfficials.matchId, set: { refereeName: name, updatedBy: actorId, updatedAt: now } })
        .run();
      saved++;
    }
    recordAudit(
      {
        actorId,
        action: "match.referee",
        entity: "match",
        entityId: ids.length === 1 ? ids[0] : null,
        summary: `Nama pengawas laga diperbarui: ${saved} diisi, ${cleared} dihapus.`,
      },
      tx,
    );
    return { saved, cleared };
  });
}
