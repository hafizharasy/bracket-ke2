import { canAccessRoom, type PengawasSession } from "@/lib/pengawas-session";
import { bracketSource } from "@/server/live";

/**
 * Nama pengawas laga untuk halaman pengawas ruangan (matchId → nama), supaya
 * tiap pengawas tahu laga mana yang ia isi. Hanya laga di ruangan pengawas
 * yang login; tidak pernah dikirim ke halaman publik. Mode simulasi tidak
 * punya data pengawas.
 */
export async function loadRoomReferees(
  session: PengawasSession,
  list: { id: string; roomId: string }[],
): Promise<Record<string, string>> {
  if (bracketSource() !== "db") return {};
  const ids = list.filter((m) => canAccessRoom(session, m.roomId)).map((m) => m.id);
  const { getMatchReferees } = await import("@/server/match-officials");
  return Object.fromEntries(getMatchReferees(ids));
}
