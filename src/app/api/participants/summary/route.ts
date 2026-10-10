import { getBracket } from "@/lib/get-bracket";
import { summarizePlacement } from "@/lib/schedule-completeness";
import { requireAdminUser } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";

/**
 * GET /api/participants/summary — ringkasan kelengkapan peserta (admin):
 * jumlah per sesi × ruangan, yang belum ditempatkan, status pasangan babak 1,
 * dan daftar pemeriksaan kelengkapan jadwal (`checks`, `ready`).
 */
export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const data = await getBracket();
    return Response.json(summarizePlacement(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
