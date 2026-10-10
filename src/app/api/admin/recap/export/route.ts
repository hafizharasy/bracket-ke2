import { getRecap, recapFilters } from "@/lib/recap-source";
import { type CsvSeparator, REPORT_INFO, REPORTS, reportCsv, reportFilename } from "@/lib/recap-export";
import { withAdmin } from "@/server/admin-api";
import { recordAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";

/**
 * GET /api/admin/recap/export?laporan=hasil|pelanggaran|juara&sesi=&ruangan=&pemisah=koma
 * — unduh laporan turnamen sebagai CSV (UTF-8 + BOM, default pemisah titik
 * koma untuk Excel Indonesia). Setiap unduhan dicatat di audit_logs (admin).
 */
export const GET = withAdmin(async (request, _params, admin) => {
  const p = new URL(request.url).searchParams;
  const kind = REPORTS.find((r) => r === p.get("laporan"));
  if (!kind) throw new ApiError(400, `Parameter laporan harus salah satu dari: ${REPORTS.join(", ")}.`);
  const separator: CsvSeparator = p.get("pemisah") === "koma" ? "," : ";";
  const recap = await getRecap(recapFilters(Object.fromEntries(p)));
  const filename = reportFilename(kind, recap);
  recordAudit({ actorId: admin.id, action: "report.export", entity: "report", entityId: kind, summary: `Unduh laporan ${REPORT_INFO[kind].title.toLowerCase()} (${filename})` });
  return new Response(reportCsv(recap, kind, separator), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
