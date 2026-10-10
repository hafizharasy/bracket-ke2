import { getAdminMatchView } from "@/lib/admin-match-view";
import { withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";

/**
 * GET /api/admin/matches/:id — detail laga untuk admin: peserta, skor,
 * hasil & foto bukti, asal slot, laga berikutnya, jejak audit hasil
 * (input/koreksi/pembatalan + pencatat), dan pelanggaran di laga itu.
 * Koreksi/pembatalan memakai PUT/DELETE /api/matches/:id/result.
 */
export const GET = withAdmin<{ id: string }>(async (_request, params) => {
  const view = await getAdminMatchView(params.id);
  if (!view) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
});
