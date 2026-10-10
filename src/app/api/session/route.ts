import { connection } from "next/server";

import { errorResponse } from "@/server/errors";
import { getCurrentSession, logout } from "@/server/login";

/**
 * GET /api/session — sesi login saat ini: { user, room, expiresAt }.
 * 401 bila belum login, sesi kedaluwarsa, atau akun dinonaktifkan.
 */
export async function GET(request: Request) {
  await connection();
  try {
    const session = await getCurrentSession(request.headers);
    if (!session) return Response.json({ error: "Belum login atau sesi berakhir." }, { status: 401 });
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/session — keluar: akhiri sesi & hapus cookie (204, juga bila sudah keluar). */
export async function DELETE(request: Request) {
  try {
    await logout(request.headers);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
