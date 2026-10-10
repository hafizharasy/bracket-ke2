import { connection } from "next/server";

import { getAdminMatchView } from "@/lib/admin-match-view";
import { requireAdminUser } from "@/server/admin-api";
import { ApiError, errorResponse } from "@/server/errors";

/**
 * GET /api/admin/matches/:id — detail laga untuk admin: peserta, skor,
 * hasil & foto bukti, asal slot, laga berikutnya, jejak audit hasil
 * (input/koreksi/pembatalan + pencatat), dan pelanggaran di laga itu.
 * Koreksi/pembatalan memakai PUT/DELETE /api/matches/:id/result.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/matches/[id]">) {
  // Data & sesi dibaca saat request, bukan saat prerender build.
  await connection();
  try {
    await requireAdminUser(request);
    const view = await getAdminMatchView((await ctx.params).id);
    if (!view) throw new ApiError(404, "Pertandingan tidak ditemukan.");
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
