import { connection } from "next/server";

import { requireAdminUser } from "@/server/admin-api";
import { getDashboardSummary } from "@/server/dashboard";
import { errorResponse } from "@/server/errors";

/**
 * GET /api/admin/summary?aktivitas= — ringkasan turnamen untuk dashboard
 * admin: progres laga per sesi, juara ruangan, laga berikutnya, total
 * pelanggaran, perlu perhatian, aktivitas terbaru, dan status ruangan.
 */
export async function GET(request: Request) {
  // Data & sesi dibaca saat request, bukan saat prerender build.
  await connection();
  try {
    await requireAdminUser(request);
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("aktivitas")) || 8, 1), 50);
    return Response.json(await getDashboardSummary({ activityLimit: limit }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
