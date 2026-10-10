import { getRoom, getRoomMatches } from "@/db/queries/room";
import { authorize, requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";

/**
 * GET /api/rooms/:id/matches?sesi= — daftar laga di ruangan (pengawas
 * ruangan itu / admin), dengan nama peserta, status, skor, dan jadwal.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]/matches">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const room = getRoom(id);
    if (!room) throw new ApiError(404, "Ruangan tidak ditemukan.");
    authorize(user, "room:view", { roomId: room.id });
    const sessionId = new URL(request.url).searchParams.get("sesi");
    return Response.json(
      { room, matches: getRoomMatches(room.id, sessionId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
