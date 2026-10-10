import { connection } from "next/server";
import { z } from "zod";

import { readJson, requireAdminUser } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { createSession, listSessions, sessionScheduleInput } from "@/server/schedule";

/** GET /api/sessions — daftar sesi terurut + jumlah peserta & laga (publik). */
export async function GET() {
  await connection();
  try {
    return Response.json(listSessions(), { headers: { "Cache-Control": "no-cache" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/sessions — tambah sesi { name, startTime } di akhir urutan (admin). */
export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = sessionScheduleInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data sesi tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    const created = createSession(parsed.data);
    notifyBracketChanged();
    return Response.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
