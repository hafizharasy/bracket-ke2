import { MATCH_STATUSES } from "@/db/schema";
import { queryResults } from "@/lib/recap";
import { getRecap, recapFilters } from "@/lib/recap-source";
import { withAdmin } from "@/server/admin-api";

/**
 * GET /api/admin/recap/results?sesi=&ruangan=&status=&babak=&q=&koreksi=1&hal=&per=
 * — rekap hasil pertandingan (admin): baris per laga (peserta, skor,
 * pemenang, status, pencatat, waktu catat, koreksi, bukti) berhalaman,
 * plus ringkasan progres laga & juara sesuai filter sesi/ruangan.
 */
export const GET = withAdmin(async (request) => {
  const p = new URL(request.url).searchParams;
  const recap = await getRecap(recapFilters(Object.fromEntries(p)));
  const status = MATCH_STATUSES.find((s) => s === p.get("status"));
  const result = queryResults(recap.results, {
    status,
    round: Number(p.get("babak")) || undefined,
    q: p.get("q") ?? undefined,
    onlyCorrected: p.get("koreksi") === "1",
    page: Number(p.get("hal")) || 1,
    pageSize: Number(p.get("per")) || 50,
  });
  const { matches, corrections, roomChampions, champion } = recap.summary;
  return Response.json(
    { filters: recap.filters, generatedAt: recap.generatedAt, summary: { matches, corrections, roomChampions, champion }, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
});
