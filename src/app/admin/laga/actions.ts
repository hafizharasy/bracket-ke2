"use server";

import { assertAdminAction, getAdminSession } from "@/lib/admin-session";
import { ApiError } from "@/server/errors";
import { bracketSource } from "@/server/live";
import { refereeEntriesInput, setMatchReferees } from "@/server/match-officials";

export type RefereeEntry = { matchId: string; refereeName: string };
export type RefereeSaveResult = { ok: true; simulated: boolean; saved: number; cleared: number } | { ok: false; error: string };

/**
 * Simpan nama pengawas laga (privat, hanya admin). Tidak memicu pembaruan
 * bagan publik karena nama ini memang tidak pernah ditampilkan di sana.
 */
export async function saveRefereesAction(entries: RefereeEntry[]): Promise<RefereeSaveResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  const parsed = refereeEntriesInput.safeParse(entries);
  if (!parsed.success) return { ok: false, error: "Nama pengawas maksimal 100 karakter." };
  if (bracketSource() !== "db") return { ok: true, simulated: true, saved: 0, cleared: 0 };
  try {
    const admin = await getAdminSession();
    return { ok: true, simulated: false, ...setMatchReferees(parsed.data, admin?.userId ?? null) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}
