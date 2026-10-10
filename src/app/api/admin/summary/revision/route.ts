import { connection } from "next/server";

import { requireAdminUser } from "@/server/admin-api";
import { getDashboardRevision } from "@/server/dashboard";
import { errorResponse } from "@/server/errors";

/**
 * GET /api/admin/summary/revision — penanda versi ringkasan dashboard
 * (`{ version }`, string) untuk polling berkala; mendukung ETag/304.
 * Bila berubah, muat ulang /api/admin/summary (atau halaman /admin).
 */
export async function GET(request: Request) {
  // Data & sesi dibaca saat request, bukan saat prerender build.
  await connection();
  try {
    await requireAdminUser(request);
    const version = await getDashboardRevision();
    const headers = { ETag: `"r${version}"`, "Cache-Control": "no-cache" };
    if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
    return Response.json({ version, checkedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
