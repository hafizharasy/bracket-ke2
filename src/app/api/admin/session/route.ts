import { withAdmin } from "@/server/admin-api";
import { listOwnSessions, logout, revokeOwnSession } from "@/server/login";

/** GET /api/admin/session — perangkat tempat admin ini sedang login (`current` = perangkat ini). */
export const GET = withAdmin(async (request, _params, admin) =>
  Response.json({ user: { id: admin.id, name: admin.name }, sessions: await listOwnSessions(request.headers) }),
);

/**
 * DELETE /api/admin/session — logout admin utama (hapus cookie, tercatat di
 * audit_logs). `?semua=1` juga mengakhiri sesi di perangkat lain;
 * `?id=<sesi>` hanya mengakhiri satu sesi di perangkat lain (tetap login di sini).
 */
export const DELETE = withAdmin(async (request, _params, admin) => {
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  if (id) {
    revokeOwnSession(admin.id, id, admin);
    return new Response(null, { status: 204 });
  }
  await logout(request.headers, { everywhere: query.get("semua") === "1" });
  return new Response(null, { status: 204 });
});
