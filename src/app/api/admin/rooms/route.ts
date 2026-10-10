import { connection } from "next/server";

import { requireAdminUser } from "@/server/admin-api";
import { getRoomsMonitor } from "@/server/dashboard";
import { errorResponse } from "@/server/errors";

/**
 * GET /api/admin/rooms?sesi= — pantau semua ruangan (admin): status tiap
 * ruangan pada sesi (default sesi aktif), laga berjalan & berikutnya, juara
 * ruangan, jumlah pelanggaran, dan pengawas aktifnya. Sertakan `version`
 * untuk dibandingkan dengan /api/bracket/version.
 */
export async function GET(request: Request) {
  // Data & sesi dibaca saat request, bukan saat prerender build.
  await connection();
  try {
    const sesi = new URL(request.url).searchParams.get("sesi") ?? undefined;
    await requireAdminUser(request);
    return Response.json(await getRoomsMonitor(sesi), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
