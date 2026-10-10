import { withAdmin } from "@/server/admin-api";
import { getRoomsMonitor } from "@/server/dashboard";

/**
 * GET /api/admin/rooms?sesi= — pantau semua ruangan (admin): status tiap
 * ruangan pada sesi (default sesi aktif), laga berjalan & berikutnya, juara
 * ruangan, jumlah pelanggaran, dan pengawas aktifnya. Sertakan `version`
 * untuk dibandingkan dengan /api/bracket/version.
 */
export const GET = withAdmin(async (request) => {
  const sesi = new URL(request.url).searchParams.get("sesi") ?? undefined;
  return Response.json(await getRoomsMonitor(sesi), { headers: { "Cache-Control": "no-store" } });
});
