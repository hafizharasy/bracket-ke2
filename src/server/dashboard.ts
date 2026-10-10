import { connection } from "next/server";
import { count, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getRecentActivity } from "@/lib/admin-activity";
import { getBracket } from "@/lib/get-bracket";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";
import { monitorRooms } from "@/lib/room-monitor";
import { getViolationCountsByRoom } from "@/lib/room-violation-counts";
import { checkScheduleCompleteness } from "@/lib/schedule-completeness";
import { summarizeTournament } from "@/lib/tournament-summary";
import type { BracketData } from "@/lib/types";
import { getTotalViolations } from "@/lib/violation-totals";
import { getBracketVersion } from "@/server/live";

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
  // Data live dari database: selalu dibaca saat request, bukan saat build.
  await connection();
  const [data, violations, violationsByRoom, activity, accounts] = await Promise.all([
    getBracket(),
    getTotalViolations(),
    getViolationCountsByRoom(),
    getRecentActivity(activityLimit),
    getPengawasAccounts(),
  ]);
  const monitor = monitorRooms(data, violationsByRoom);
  return {
    revision: await getDashboardRevision(),
    generatedAt: new Date().toISOString(),
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

/**
 * Pantau semua ruangan untuk satu sesi (default: sesi aktif): status, laga
 * berjalan, laga berikutnya, juara, pelanggaran, dan pengawas aktif tiap
 * ruangan. Satu sumber untuk /admin/pantau dan GET /api/admin/rooms.
 */
export async function getRoomsMonitor(sessionId?: string) {
  // Data live dari database: selalu dibaca saat request, bukan saat build.
  await connection();
  const [data, violationsByRoom, accounts] = await Promise.all([
    getBracket(),
    getViolationCountsByRoom(),
    getPengawasAccounts(),
  ]);
  const monitor = monitorRooms(data, violationsByRoom, sessionId);
  const rooms = monitor.rooms.map((room) => ({
    ...room,
    pengawas: accounts
      .filter((a) => a.active && a.roomId === room.roomId)
      .map((a) => ({ id: a.id, name: a.name, lastLoginAt: a.lastLoginAt })),
  }));
  return {
    version: data.version,
    updatedAt: data.updatedAt,
    sessionId: monitor.sessionId,
    sessions: data.sessions.map((s) => ({ id: s.id, name: s.name, startTime: s.startTime })),
    counts: {
      live: rooms.filter((r) => r.status === "berlangsung").length,
      done: rooms.filter((r) => r.status === "selesai").length,
    },
    rooms,
  };
}

/**
 * Penanda versi ringkasan dashboard: berubah bila bagan berubah (hasil,
 * jadwal, peserta), ada pelanggaran baru, atau akun berubah. Klien cukup
 * membandingkan string ini (polling ringan) sebelum memuat ulang ringkasan.
 */
export async function getDashboardRevision() {
  // Data live dari database: selalu dibaca saat request, bukan saat build.
  await connection();
  const [{ version }, violations] = await Promise.all([getBracketVersion(), getTotalViolations()]);
  const accounts = db
    .select({ n: count(), changed: sql<number>`coalesce(max(max(coalesce(${users.updatedAt}, 0)), max(coalesce(${users.lastLoginAt}, 0))), 0)` })
    .from(users)
    .get();
  return `${version}.${violations}.${accounts?.n ?? 0}.${accounts?.changed ?? 0}`;
}
