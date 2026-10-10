import { z } from "zod";

import { requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";
import { recordViolation, violationInput } from "@/server/violations";

/**
 * POST /api/violations — catat pelanggaran peserta.
 * Body: { participantId, matchId?, roomId?, type, note?, occurredAt? }
 * 201 → pelanggaran tersimpan · 401/403 akses · 404 peserta/laga tidak ada ·
 * 422 data tidak valid (mis. jenis Lainnya tanpa catatan).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => {
      throw new ApiError(400, "Body harus JSON.");
    });
    const parsed = violationInput.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Data pelanggaran tidak valid.", issues: z.flattenError(parsed.error).fieldErrors },
        { status: 422 },
      );
    }
    return Response.json(recordViolation(parsed.data, user), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
