import { z } from "zod";

import { readJson } from "@/server/admin-api";
import { notifyBracketChanged } from "@/server/live";
import { cancelMatchResult, matchResultInput, recordMatchResult } from "@/server/match-results";
import { roomOfMatchParam, withRoomAccess } from "@/server/room-guard";

/**
 * PUT /api/matches/:id/result — pengawas menyimpan (atau mengoreksi) hasil laga.
 * Body: { scoreA, scoreB, winnerId?, proofPhotoUrl }
 * 200 → { match, nextMatch } · 401 belum login · 403 bukan ruangannya ·
 * 404 laga tidak ada · 409 bentrok status · 422 data tidak valid.
 */
export const PUT = withRoomAccess("result:write", roomOfMatchParam, async (request, { id }, { user }) => {
  const parsed = matchResultInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json(
      { error: "Data hasil tidak valid.", issues: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }
  const saved = recordMatchResult(id, parsed.data, user);
  notifyBracketChanged();
  return Response.json(saved);
});

/**
 * DELETE /api/matches/:id/result — batalkan hasil laga (salah input).
 * 200 → { match, nextMatch } · 409 bila belum ada hasil atau laga berikutnya
 * sudah dimulai.
 */
export const DELETE = withRoomAccess("result:cancel", roomOfMatchParam, (_request, { id }, { user }) => {
  const cancelled = cancelMatchResult(id, user);
  notifyBracketChanged();
  return Response.json(cancelled);
});
