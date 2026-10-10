import { withAdmin } from "@/server/admin-api";
import { logoutPengawasEverywhere } from "@/server/pengawas-accounts";

/** POST /api/admin/pengawas/:id/logout — keluarkan akun dari semua perangkat → { revoked } (admin). */
export const POST = withAdmin<{ id: string }>((_request, params, admin) => {
  return Response.json(logoutPengawasEverywhere(params.id, admin.id));
});
