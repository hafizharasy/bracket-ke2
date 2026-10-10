import { z } from "zod";

import { readJson, requireAdminUser } from "@/server/admin-api";
import { autoAssign, autoAssignInput } from "@/server/assignments";
import { errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";

/**
 * POST /api/participants/auto-assign — bagi rata otomatis (admin).
 * { kind: "sesi", mode } atau { kind: "ruangan", mode, sessionId };
 * mode "unassigned" = hanya yang belum, "all" = bagi ulang.
 */
export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = autoAssignInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data pembagian tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    const result = autoAssign(parsed.data);
    notifyBracketChanged();
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
