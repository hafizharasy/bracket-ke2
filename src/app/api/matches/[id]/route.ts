import { getMatchDetail } from "@/db/queries/match-detail";
import { errorResponse } from "@/server/errors";

/** GET /api/matches/:id — detail satu pertandingan (publik). 404 bila tidak ada. */
export async function GET(_request: Request, ctx: RouteContext<"/api/matches/[id]">) {
  try {
    const { id } = await ctx.params;
    const detail = await getMatchDetail(id);
    if (!detail) return Response.json({ error: "Pertandingan tidak ditemukan." }, { status: 404 });
    return Response.json(detail, { headers: { "Cache-Control": "no-cache" } });
  } catch (error) {
    return errorResponse(error);
  }
}
