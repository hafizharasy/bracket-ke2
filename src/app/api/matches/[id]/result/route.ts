import { z } from "zod";

import { requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { cancelMatchResult, matchResultInput, recordMatchResult } from "@/server/match-results";

/**
 * PUT /api/matches/:id/result — pengawas menyimpan (atau mengoreksi) hasil laga.
 * Body: { scoreA, scoreB, winnerId?, proofPhotoUrl }
 * 200 → { match, nextMatch } · 401 belum login · 403 bukan ruangannya ·
 * 404 laga tidak ada · 409 bentrok status · 422 data tidak valid.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/matches/[id]/result">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;

    const body = await request.json().catch(() => {
      throw new ApiError(400, "Body harus JSON.");
    });
    const parsed = matchResultInput.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Data hasil tidak valid.", issues: z.flattenError(parsed.error).fieldErrors },
        { status: 422 },
      );
    }

    const saved = recordMatchResult(id, parsed.data, user);
    notifyBracketChanged();
    return Response.json(saved);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/matches/:id/result — batalkan hasil laga (salah input).
 * 200 → { match, nextMatch } · 409 bila belum ada hasil atau laga berikutnya
 * sudah dimulai.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/matches/[id]/result">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const cancelled = cancelMatchResult(id, user);
    notifyBracketChanged();
    return Response.json(cancelled);
  } catch (error) {
    return errorResponse(error);
  }
}
