import { getRoom, getRoomHistoryFromDb } from "@/db/queries/room";
import { roomFromParam, withRoomAccess } from "@/server/room-guard";

/**
 * GET /api/rooms/:id/history?sesi= — riwayat hasil di ruangan (pengawas
 * ruangan itu / admin): skor, pemenang, waktu catat, bukti, pencatat,
 * jumlah koreksi. Terbaru dulu.
 */
export const GET = withRoomAccess("room:view", roomFromParam, (request, _params, { roomId }) => {
  const sessionId = new URL(request.url).searchParams.get("sesi");
  return Response.json(
    { room: getRoom(roomId), history: getRoomHistoryFromDb(roomId, sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
