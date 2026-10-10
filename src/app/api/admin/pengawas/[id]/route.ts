import { z } from "zod";

import { readJson, requireAdminUser } from "@/server/admin-api";
import { ApiError, errorResponse } from "@/server/errors";
import { deletePengawas, getPengawas, pengawasUpdateInput, updatePengawas } from "@/server/pengawas-accounts";

/** GET /api/admin/pengawas/:id — satu akun pengawas (admin). */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/pengawas/[id]">) {
  try {
    await requireAdminUser(request);
    const account = getPengawas((await ctx.params).id);
    if (!account) throw new ApiError(404, "Akun pengawas tidak ditemukan.");
    return Response.json(account);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/admin/pengawas/:id — ubah { name?, email?, roomId?, password?, active? }
 * (admin). Pindah ruangan, ganti sandi, atau nonaktif mengakhiri sesi login akun itu.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/pengawas/[id]">) {
  try {
    await requireAdminUser(request);
    const parsed = pengawasUpdateInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data akun tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    return Response.json(await updatePengawas((await ctx.params).id, parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/admin/pengawas/:id — hapus akun tanpa jejak hasil/pelanggaran (admin). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/pengawas/[id]">) {
  try {
    await requireAdminUser(request);
    deletePengawas((await ctx.params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
