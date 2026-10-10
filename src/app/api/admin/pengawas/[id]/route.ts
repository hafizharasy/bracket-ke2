import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";
import { deletePengawas, getPengawas, pengawasUpdateInput, updatePengawas } from "@/server/pengawas-accounts";

/** GET /api/admin/pengawas/:id — satu akun pengawas (admin). */
export const GET = withAdmin<{ id: string }>((_request, params) => {
  const account = getPengawas(params.id);
  if (!account) throw new ApiError(404, "Akun pengawas tidak ditemukan.");
  return Response.json(account);
});

/**
 * PATCH /api/admin/pengawas/:id — ubah { name?, email?, roomId?, password?, active? }
 * (admin). Pindah ruangan, ganti sandi, atau nonaktif mengakhiri sesi login akun itu.
 */
export const PATCH = withAdmin<{ id: string }>(async (request, params) => {
  const parsed = pengawasUpdateInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data akun tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  return Response.json(await updatePengawas(params.id, parsed.data));
});

/** DELETE /api/admin/pengawas/:id — hapus akun tanpa jejak hasil/pelanggaran (admin). */
export const DELETE = withAdmin<{ id: string }>((_request, params) => {
  deletePengawas(params.id);
  return new Response(null, { status: 204 });
});
