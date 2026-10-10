import { z } from "zod";

import { readJson, requireAdminUser } from "@/server/admin-api";
import { assignInput, assignParticipants } from "@/server/assignments";
import { errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";

/** POST /api/participants/assign — { ids, sessionId?, roomId? } (null = kosongkan) (admin). */
export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = assignInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data penetapan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    const result = assignParticipants(parsed.data);
    notifyBracketChanged();
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
