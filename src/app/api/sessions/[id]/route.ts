import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { deleteSession, listSessions, sessionScheduleInput, updateSessionSchedule } from "@/server/schedule";

/**
 * PATCH /api/sessions/:id — ubah { name?, startTime? } (admin). Jam mulai
 * yang bergeser ikut menggeser jadwal laga sesi itu yang belum selesai.
 */
export const PATCH = withAdmin<{ id: string }>(async (request, params) => {
  const { id } = params;
  const current = listSessions().find((s) => s.id === id);
  if (!current) throw new ApiError(404, "Sesi tidak ditemukan.");
  const parsed = sessionScheduleInput.safeParse({ name: current.name, startTime: current.startTime, ...(await readJson(request)) });
  if (!parsed.success) {
    return Response.json({ error: "Data sesi tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const result = updateSessionSchedule(id, parsed.data);
  notifyBracketChanged();
  return Response.json({ ...listSessions().find((s) => s.id === id), shiftedMatches: result.shiftedMatches });
});

/** DELETE /api/sessions/:id — hapus sesi yang belum dipakai peserta/laga (admin). */
export const DELETE = withAdmin<{ id: string }>((_request, params) => {
  deleteSession(params.id);
  notifyBracketChanged();
  return new Response(null, { status: 204 });
});
