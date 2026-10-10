import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { notifyBracketChanged } from "@/server/live";
import { sessionRoomsInput, setSessionRooms } from "@/server/schedule";

/**
 * PUT /api/sessions/:id/rooms — atur ruangan yang dipakai sesi { roomIds }
 * (admin). Ruangan yang dilepas harus kosong dari peserta sesi itu.
 * `structureStale` = struktur bagan perlu disusun ulang.
 */
export const PUT = withAdmin<{ id: string }>(async (request, params) => {
  const parsed = sessionRoomsInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Daftar ruangan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const result = setSessionRooms(params.id, parsed.data.roomIds);
  notifyBracketChanged();
  return Response.json(result);
});
