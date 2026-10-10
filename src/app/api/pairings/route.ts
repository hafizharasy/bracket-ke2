import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { getPairings, pairingInput, savePairings } from "@/server/pairings";

/** GET /api/pairings?sesi=&ruangan= — susunan pasangan babak 1 (admin). */
export const GET = withAdmin((request) => {
  const p = new URL(request.url).searchParams;
  const sesi = p.get("sesi");
  const ruangan = p.get("ruangan");
  if (!sesi || !ruangan) throw new ApiError(400, "Parameter sesi dan ruangan wajib diisi.");
  return Response.json(getPairings(sesi, ruangan), { headers: { "Cache-Control": "no-store" } });
});

/** PUT /api/pairings — { sessionId, roomId, order } simpan pasangan babak 1 (admin). */
export const PUT = withAdmin(async (request) => {
  const parsed = pairingInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data pasangan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const result = savePairings(parsed.data);
  notifyBracketChanged();
  return Response.json(result);
});
