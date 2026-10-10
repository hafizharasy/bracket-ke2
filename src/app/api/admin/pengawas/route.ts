import { connection } from "next/server";
import { z } from "zod";

import { readJson, requireAdminUser } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";
import { createPengawas, listPengawas, pengawasCreateInput } from "@/server/pengawas-accounts";

/** GET /api/admin/pengawas — semua akun pengawas (tanpa sandi) (admin). */
export async function GET(request: Request) {
  // Data & sesi dibaca saat request, bukan saat prerender build.
  await connection();
  try {
    await requireAdminUser(request);
    return Response.json(listPengawas(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/pengawas — buat akun { name, email, roomId, password } (admin). */
export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = pengawasCreateInput.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: "Data akun tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
    }
    return Response.json(await createPengawas(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
