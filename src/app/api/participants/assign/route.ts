import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { assignInput, assignParticipants } from "@/server/assignments";
import { notifyBracketChanged } from "@/server/live";

/** POST /api/participants/assign — { ids, sessionId?, roomId? } (null = kosongkan) (admin). */
export const POST = withAdmin(async (request) => {
  const parsed = assignInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data penetapan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const result = assignParticipants(parsed.data);
  notifyBracketChanged();
  return Response.json(result);
});
