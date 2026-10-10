import { z } from "zod";

import { requireAdminUser, readJson } from "@/server/admin-api";
import { ApiError, errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { deleteParticipant, getParticipant, participantUpdateInput, updateParticipant } from "@/server/participants";

/** GET /api/participants/:id — satu peserta (admin). */
export async function GET(request: Request, ctx: RouteContext<"/api/participants/[id]">) {
  try {
    await requireAdminUser(request);
    const participant = getParticipant((await ctx.params).id);
    if (!participant) throw new ApiError(404, "Peserta tidak ditemukan.");
    return Response.json(participant);
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/participants/:id — ubah sebagian data peserta (admin). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/participants/[id]">) {
  try {
    await requireAdminUser(request);
    const parsed = participantUpdateInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data peserta tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    const updated = updateParticipant((await ctx.params).id, parsed.data);
    notifyBracketChanged();
    return Response.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/participants/:id — hapus peserta yang belum masuk bagan (admin). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/participants/[id]">) {
  try {
    await requireAdminUser(request);
    deleteParticipant((await ctx.params).id);
    notifyBracketChanged();
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
