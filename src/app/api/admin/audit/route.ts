import { withAdmin } from "@/server/admin-api";
import { listAudit } from "@/server/audit";

/** GET /api/admin/audit?batas= — jejak aksi admin terbaru (login, akun, dll.) (admin). */
export const GET = withAdmin((request) => {
  const limit = Number(new URL(request.url).searchParams.get("batas")) || 50;
  return Response.json(listAudit(limit), { headers: { "Cache-Control": "no-store" } });
});
