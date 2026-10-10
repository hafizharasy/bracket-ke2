import { getRecentActivity } from "@/lib/admin-activity";
import { getBracket } from "@/lib/get-bracket";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";
import { monitorRooms } from "@/lib/room-monitor";
import { getViolationCountsByRoom } from "@/lib/room-violation-counts";
import { checkScheduleCompleteness } from "@/lib/schedule-completeness";
import { summarizeTournament } from "@/lib/tournament-summary";
import type { BracketData } from "@/lib/types";
import { getTotalViolations } from "@/lib/violation-totals";

export type AttentionItem = { text: string; href: string };

/** Hal yang perlu ditindak admin: jadwal belum lengkap & ruangan tanpa pengawas aktif. */
export function attentionItems(
  data: Pick<BracketData, "participants" | "sessions" | "rooms" | "matches">,
  accounts: { active: boolean; roomId: string | null }[],
): AttentionItem[] {
  return [
    ...checkScheduleCompleteness(data)
      .filter((c) => !c.ok)
      .map((c) => ({ text: `${c.label}: ${c.detail}`, href: c.href })),
    ...data.rooms
      .filter((r) => !accounts.some((a) => a.active && a.roomId === r.id))
      .map((r) => ({ text: `${r.name} belum punya pengawas aktif`, href: "/admin/pengawas" })),
  ];
}

/**
 * Ringkasan dashboard admin: progres turnamen, total pelanggaran, hal yang
 * perlu perhatian, aktivitas terbaru, dan status ruangan sesi aktif.
 * Satu sumber untuk halaman /admin dan GET /api/admin/summary.
 */
export async function getDashboardSummary({ activityLimit = 8 } = {}) {
  const [data, violations, violationsByRoom, activity, accounts] = await Promise.all([
    getBracket(),
    getTotalViolations(),
    getViolationCountsByRoom(),
    getRecentActivity(activityLimit),
    getPengawasAccounts(),
  ]);
  const monitor = monitorRooms(data, violationsByRoom);
  return {
    version: data.version,
    updatedAt: data.updatedAt,
    summary: summarizeTournament(data),
    violations,
    attention: attentionItems(data, accounts),
    activity,
    monitor,
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;
