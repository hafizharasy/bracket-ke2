import { getRoom, getRoomHistoryFromDb } from "@/db/queries/room";
import { assertRoomAccess, requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";

/**
 * GET /api/rooms/:id/history?sesi= — riwayat hasil di ruangan (pengawas
 * ruangan itu / admin): skor, pemenang, waktu catat, bukti, pencatat,
 * jumlah koreksi. Terbaru dulu.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]/history">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const room = getRoom(id);
    if (!room) throw new ApiError(404, "Ruangan tidak ditemukan.");
    assertRoomAccess(user, room.id);
    const sessionId = new URL(request.url).searchParams.get("sesi");
    return Response.json(
      { room, history: getRoomHistoryFromDb(room.id, sessionId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
