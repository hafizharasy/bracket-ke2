import { withAdmin } from "@/server/admin-api";
import { getDashboardSummary } from "@/server/dashboard";

/**
 * GET /api/admin/summary?aktivitas= — ringkasan turnamen untuk dashboard
 * admin: progres laga per sesi, juara ruangan, laga berikutnya, total
 * pelanggaran, perlu perhatian, aktivitas terbaru, dan status ruangan.
 */
export const GET = withAdmin(async (request) => {
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("aktivitas")) || 8, 1), 50);
  return Response.json(await getDashboardSummary({ activityLimit: limit }), { headers: { "Cache-Control": "no-store" } });
});
