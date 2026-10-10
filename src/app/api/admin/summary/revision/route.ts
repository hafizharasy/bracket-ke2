import { withAdmin } from "@/server/admin-api";
import { getDashboardRevision } from "@/server/dashboard";

/**
 * GET /api/admin/summary/revision — penanda versi ringkasan dashboard
 * (`{ version }`, string) untuk polling berkala; mendukung ETag/304.
 * Bila berubah, muat ulang /api/admin/summary (atau halaman /admin).
 */
export const GET = withAdmin(async (request) => {
  const version = await getDashboardRevision();
  const headers = { ETag: `"r${version}"`, "Cache-Control": "no-cache" };
  if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
  return Response.json({ version, checkedAt: new Date().toISOString() }, { headers });
});
