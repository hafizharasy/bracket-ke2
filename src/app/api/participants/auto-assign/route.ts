import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { autoAssign, autoAssignInput } from "@/server/assignments";
import { notifyBracketChanged } from "@/server/live";

/**
 * POST /api/participants/auto-assign — bagi rata otomatis (admin).
 * { kind: "sesi", mode } atau { kind: "ruangan", mode, sessionId };
 * mode "unassigned" = hanya yang belum, "all" = bagi ulang.
 */
export const POST = withAdmin(async (request) => {
  const parsed = autoAssignInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data pembagian tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const result = autoAssign(parsed.data);
  notifyBracketChanged();
  return Response.json(result);
});
