import { requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";
import { getParticipantViolations } from "@/server/violations";

/**
 * GET /api/participants/:id/violations — riwayat pelanggaran satu peserta.
 * Pengawas hanya melihat pelanggaran di ruangannya; admin melihat semua.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/participants/[id]/violations">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    if (user.role === "pengawas" && !user.roomId) throw new ApiError(403, "Akun tidak terikat ke ruangan.");
    const result = getParticipantViolations(id, user.role === "admin" ? null : user.roomId);
    if (!result) throw new ApiError(404, "Peserta tidak ditemukan.");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
