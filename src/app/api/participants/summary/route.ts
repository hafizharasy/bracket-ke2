import { getBracket } from "@/lib/get-bracket";
import { summarizePlacement } from "@/lib/schedule-completeness";
import { withAdmin } from "@/server/admin-api";

/**
 * GET /api/participants/summary — ringkasan kelengkapan peserta (admin):
 * jumlah per sesi × ruangan, yang belum ditempatkan, status pasangan babak 1,
 * dan daftar pemeriksaan kelengkapan jadwal (`checks`, `ready`).
 */
export const GET = withAdmin(async () => {
  const data = await getBracket();
  return Response.json(summarizePlacement(data), { headers: { "Cache-Control": "no-store" } });
});
