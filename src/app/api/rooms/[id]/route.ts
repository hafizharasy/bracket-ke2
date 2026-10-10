import { z } from "zod";

import { readJson, requireAdminUser } from "@/server/admin-api";
import { ApiError, errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { deleteRoom, listRooms, roomInput, updateRoom } from "@/server/schedule";

/** PATCH /api/rooms/:id — ubah { name?, location? } (admin). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/rooms/[id]">) {
  try {
    await requireAdminUser(request);
    const { id } = await ctx.params;
    const current = listRooms().find((r) => r.id === id);
    if (!current) throw new ApiError(404, "Ruangan tidak ditemukan.");
    const parsed = roomInput.safeParse({ name: current.name, location: current.location ?? "", ...(await readJson(request)) });
    if (!parsed.success) {
      return Response.json({ error: "Data ruangan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    updateRoom(id, parsed.data);
    notifyBracketChanged();
    return Response.json(listRooms().find((r) => r.id === id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/rooms/:id — hapus ruangan yang belum dipakai peserta/laga/pengawas (admin). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/rooms/[id]">) {
  try {
    await requireAdminUser(request);
    deleteRoom((await ctx.params).id);
    notifyBracketChanged();
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
