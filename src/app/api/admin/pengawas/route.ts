import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { createPengawas, listPengawas, pengawasCreateInput } from "@/server/pengawas-accounts";

/** GET /api/admin/pengawas — semua akun pengawas (tanpa sandi) (admin). */
export const GET = withAdmin(() => {
  return Response.json(listPengawas(), { headers: { "Cache-Control": "no-store" } });
});

/** POST /api/admin/pengawas — buat akun { name, email, roomId, password } (admin). */
export const POST = withAdmin(async (request) => {
  const parsed = pengawasCreateInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data akun tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  return Response.json(await createPengawas(parsed.data), { status: 201 });
});
