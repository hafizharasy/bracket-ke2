import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { deleteParticipant, getParticipant, participantUpdateInput, updateParticipant } from "@/server/participants";

/** GET /api/participants/:id — satu peserta (admin). */
export const GET = withAdmin<{ id: string }>((_request, params) => {
  const participant = getParticipant(params.id);
  if (!participant) throw new ApiError(404, "Peserta tidak ditemukan.");
  return Response.json(participant);
});

/** PATCH /api/participants/:id — ubah sebagian data peserta (admin). */
export const PATCH = withAdmin<{ id: string }>(async (request, params) => {
  const parsed = participantUpdateInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data peserta tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const updated = updateParticipant(params.id, parsed.data);
  notifyBracketChanged();
  return Response.json(updated);
});

/** DELETE /api/participants/:id — hapus peserta yang belum masuk bagan (admin). */
export const DELETE = withAdmin<{ id: string }>((_request, params) => {
  deleteParticipant(params.id);
  notifyBracketChanged();
  return new Response(null, { status: 204 });
});
