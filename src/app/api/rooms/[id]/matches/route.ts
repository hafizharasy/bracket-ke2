import { getRoom, getRoomMatches } from "@/db/queries/room";
import { roomFromParam, withRoomAccess } from "@/server/room-guard";

/**
 * GET /api/rooms/:id/matches?sesi= — daftar laga di ruangan (pengawas
 * ruangan itu / admin), dengan nama peserta, status, skor, dan jadwal.
 */
export const GET = withRoomAccess("room:view", roomFromParam, (request, _params, { roomId }) => {
  const sessionId = new URL(request.url).searchParams.get("sesi");
  return Response.json(
    { room: getRoom(roomId), matches: getRoomMatches(roomId, sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
