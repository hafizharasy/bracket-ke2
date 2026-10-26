"use server";

import { assertAdminAction, getAdminSession } from "@/lib/admin-session";
import { ApiError } from "@/server/errors";
import { bracketSource } from "@/server/live";
import { refereeEntriesInput, setMatchReferees } from "@/server/match-officials";
import { importRefereesCsv } from "@/server/referee-import";

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

export type RefereeImportResult =
  | {
      ok: true;
      simulated: false;
      saved: boolean;
      entries: { line: number; label: string; refereeName: string }[];
      errors: { line: number; message: string }[];
      summary: { filled: number; skipped: number; errors: number };
    }
  | { ok: true; simulated: true }
  | { ok: false; error: string };

/** Impor nama pengawas dari teks CSV (Excel diubah ke CSV di browser): periksa dulu (`dryRun`), lalu simpan. */
export async function importRefereesAction(text: string, dryRun: boolean): Promise<RefereeImportResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  if (text.length > 2_000_000) return { ok: false, error: "Berkas terlalu besar." };
  if (bracketSource() !== "db") return { ok: true, simulated: true };
  try {
    const admin = await getAdminSession();
    const result = importRefereesCsv(text, { dryRun }, admin?.userId ?? null);
    return {
      ok: true,
      simulated: false,
      saved: result.saved,
      entries: result.entries.map(({ line, label, refereeName }) => ({ line, label, refereeName })),
      errors: result.errors,
      summary: result.summary,
    };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}
