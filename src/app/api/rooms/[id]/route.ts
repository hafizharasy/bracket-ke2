import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { deleteRoom, listRooms, roomInput, updateRoom } from "@/server/schedule";

/** PATCH /api/rooms/:id — ubah { name?, location? } (admin). */
export const PATCH = withAdmin<{ id: string }>(async (request, params) => {
  const { id } = params;
  const current = listRooms().find((r) => r.id === id);
  if (!current) throw new ApiError(404, "Ruangan tidak ditemukan.");
  const parsed = roomInput.safeParse({ name: current.name, location: current.location ?? "", ...(await readJson(request)) });
  if (!parsed.success) {
    return Response.json({ error: "Data ruangan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  updateRoom(id, parsed.data);
  notifyBracketChanged();
  return Response.json(listRooms().find((r) => r.id === id));
});

/** DELETE /api/rooms/:id — hapus ruangan yang belum dipakai peserta/laga/pengawas (admin). */
export const DELETE = withAdmin<{ id: string }>((_request, params) => {
  deleteRoom(params.id);
  notifyBracketChanged();
  return new Response(null, { status: 204 });
});
