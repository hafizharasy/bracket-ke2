import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { notifyBracketChanged } from "@/server/live";
import { createParticipant, participantCreateInput, searchParticipants } from "@/server/participants";

/**
 * GET /api/participants?q=&sesi=&ruangan=&hal=&per= — cari peserta (admin).
 * `sesi`/`ruangan` = ID, atau "none" untuk yang belum ditempatkan.
 */
export const GET = withAdmin((request) => {
  const p = new URL(request.url).searchParams;
  const result = searchParticipants({
    q: p.get("q") ?? undefined,
    sesi: p.get("sesi") ?? undefined,
    ruangan: p.get("ruangan") ?? undefined,
    page: Number(p.get("hal")) || 1,
    pageSize: Number(p.get("per")) || 50,
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
});

/** POST /api/participants — tambah peserta { name, teamOrClub?, sessionId?, roomId? } (admin). */
export const POST = withAdmin(async (request) => {
  const parsed = participantCreateInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data peserta tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const created = createParticipant(parsed.data);
  notifyBracketChanged();
  return Response.json(created, { status: 201 });
});
