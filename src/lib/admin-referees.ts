import { requireAdmin } from "@/lib/admin-session";
import { bracketSource } from "@/server/live";

/**
 * Nama pengawas laga untuk halaman admin (matchId → nama). Selalu
 * memeriksa sesi admin lebih dulu: data ini tidak boleh sampai ke publik
 * maupun pengawas ruangan. Mode simulasi tidak punya data pengawas.
 */
export async function loadReferees(matchIds: string[], next = "/admin"): Promise<Record<string, string>> {
  await requireAdmin(next);
  if (bracketSource() !== "db") return {};
  const { getMatchReferees } = await import("@/server/match-officials");
  return Object.fromEntries(getMatchReferees(matchIds));
}
