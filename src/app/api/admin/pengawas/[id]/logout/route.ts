import { requireAdminUser } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";
import { logoutPengawasEverywhere } from "@/server/pengawas-accounts";

/** POST /api/admin/pengawas/:id/logout — keluarkan akun dari semua perangkat → { revoked } (admin). */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/pengawas/[id]/logout">) {
  try {
    await requireAdminUser(request);
    return Response.json(logoutPengawasEverywhere((await ctx.params).id));
  } catch (error) {
    return errorResponse(error);
  }
}
