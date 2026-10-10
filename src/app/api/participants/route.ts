import { z } from "zod";

import { requireAdminUser, readJson } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { createParticipant, participantCreateInput, searchParticipants } from "@/server/participants";

/**
 * GET /api/participants?q=&sesi=&ruangan=&hal=&per= — cari peserta (admin).
 * `sesi`/`ruangan` = ID, atau "none" untuk yang belum ditempatkan.
 */
export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const p = new URL(request.url).searchParams;
    const result = searchParticipants({
      q: p.get("q") ?? undefined,
      sesi: p.get("sesi") ?? undefined,
      ruangan: p.get("ruangan") ?? undefined,
      page: Number(p.get("hal")) || 1,
      pageSize: Number(p.get("per")) || 50,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/participants — tambah peserta { name, teamOrClub?, sessionId?, roomId? } (admin). */
export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = participantCreateInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data peserta tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    const created = createParticipant(parsed.data);
    notifyBracketChanged();
    return Response.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
