import { getRoom } from "@/db/queries/room";
import { authorize, requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";
import { getRoomViolationSummary } from "@/server/violations";

/**
 * GET /api/rooms/:id/violations?sesi= — daftar pelanggaran ruangan beserta
 * total (jumlah, peserta terlibat, per jenis, per peserta). Pengawas
 * ruangan itu / admin.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]/violations">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const room = getRoom(id);
    if (!room) throw new ApiError(404, "Ruangan tidak ditemukan.");
    authorize(user, "room:view", { roomId: room.id });
    const sessionId = new URL(request.url).searchParams.get("sesi");
    return Response.json(
      { room, ...getRoomViolationSummary(room.id, sessionId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
