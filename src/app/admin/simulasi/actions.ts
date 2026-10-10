"use server";

import { assertAdminAction, getAdminSession } from "@/lib/admin-session";
import { ApiError } from "@/server/errors";
import { bracketSource, notifyBracketChanged } from "@/server/live";
import { clearAllResults, type SimulationInput, simulateResults, simulationInput } from "@/server/simulation";

export type SimulationActionResult = { ok: true; simulated: boolean; message: string } | { ok: false; error: string };

async function run(write: (actorId: string | null) => string): Promise<SimulationActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  if (bracketSource() !== "db") return { ok: true, simulated: true, message: "Mode data tiruan: tidak ada yang disimpan." };
  try {
    const admin = await getAdminSession();
    const message = write(admin?.userId ?? null);
    notifyBracketChanged();
    return { ok: true, simulated: false, message };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Isi hasil acak untuk laga yang siap dalam cakupan. */
export async function simulateAction(input: SimulationInput) {
  const parsed = simulationInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Pilihan simulasi tidak valid." };
  return run((actorId) => {
    const { finished, remaining } = simulateResults(parsed.data, actorId);
    return finished === 0
      ? "Tidak ada laga yang siap diisi pada pilihan ini (peserta laga belum lengkap atau sudah selesai)."
      : `${finished} laga diisi hasil acak. Sisa laga belum selesai di seluruh turnamen: ${remaining}.`;
  });
}

/** Hapus semua hasil (database dicadangkan dulu). */
export async function clearResultsAction(options: { violations: boolean; confirm: string }) {
  if (options.confirm.trim().toUpperCase() !== "HAPUS") return { ok: false as const, error: 'Ketik "HAPUS" untuk konfirmasi.' };
  return run((actorId) => {
    const { cleared, removedViolations } = clearAllResults({ violations: options.violations }, actorId);
    return `${cleared} laga dikembalikan ke terjadwal${options.violations ? `, ${removedViolations} pelanggaran dihapus` : ""}. Cadangan database sudah disimpan.`;
  });
}
