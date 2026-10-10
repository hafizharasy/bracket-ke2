import { filterViolations, groupViolationsByParticipant, summarizeViolations } from "@/lib/recap";
import { getRecap, recapFilters } from "@/lib/recap-source";
import { withAdmin } from "@/server/admin-api";

/**
 * GET /api/admin/recap/violations?sesi=&ruangan=&jenis=&q=&tampilan=peserta&hal=&per=
 * — rekap pelanggaran (admin): ringkasan (jumlah, peserta, peserta berulang,
 * per jenis, per ruangan) dan daftar catatan — atau per peserta dengan
 * `tampilan=peserta` — berhalaman. Filter `jenis` & `q` (nama/ID peserta)
 * berlaku untuk ringkasan dan daftar.
 */
export const GET = withAdmin(async (request) => {
  const p = new URL(request.url).searchParams;
  const recap = await getRecap(recapFilters(Object.fromEntries(p)));
  const rows = filterViolations(recap.violations, { type: p.get("jenis") ?? undefined, q: p.get("q") ?? undefined });
  const list = p.get("tampilan") === "peserta" ? groupViolationsByParticipant(rows) : rows;
  const pageSize = Math.min(Math.max(Number(p.get("per")) || 50, 1), 500);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(Number(p.get("hal")) || 1, 1), pages);
  return Response.json(
    {
      filters: recap.filters,
      generatedAt: recap.generatedAt,
      summary: summarizeViolations(rows),
      view: p.get("tampilan") === "peserta" ? "peserta" : "catatan",
      items: list.slice((page - 1) * pageSize, page * pageSize),
      total: list.length,
      page,
      pageSize,
      pages,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
