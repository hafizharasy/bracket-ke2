import { getRoom } from "@/db/queries/room";
import { roomFromParam, withRoomAccess } from "@/server/room-guard";
import { getRoomViolationSummary } from "@/server/violations";

/**
 * GET /api/rooms/:id/violations?sesi= — daftar pelanggaran ruangan beserta
 * total (jumlah, peserta terlibat, per jenis, per peserta). Pengawas
 * ruangan itu / admin.
 */
export const GET = withRoomAccess("room:view", roomFromParam, (request, _params, { roomId }) => {
  const sessionId = new URL(request.url).searchParams.get("sesi");
  return Response.json(
    { room: getRoom(roomId), ...getRoomViolationSummary(roomId, sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
