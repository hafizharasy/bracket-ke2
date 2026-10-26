import type { CsvSeparator } from "@/lib/recap-export";
import { withAdmin } from "@/server/admin-api";
import { recordAudit } from "@/server/audit";
import { refereeSheetCsv } from "@/server/referee-import";

/**
 * GET /api/admin/referees/export?pemisah=koma — daftar semua laga + nama
 * pengawas saat ini (CSV UTF-8 + BOM, default titik koma untuk Excel
 * Indonesia). Diisi di Excel lalu diunggah lewat "Impor nama pengawas".
 * Berisi data privat (nama pengawas): hanya admin, dan dicatat di audit.
 */
export const GET = withAdmin((request, _params, admin) => {
  const separator: CsvSeparator = new URL(request.url).searchParams.get("pemisah") === "koma" ? "," : ";";
  recordAudit({ actorId: admin.id, action: "report.export", entity: "report", entityId: "pengawas", summary: "Unduh daftar laga untuk nama pengawas" });
  return new Response(refereeSheetCsv(separator), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="daftar-laga-pengawas.csv"',
      "Cache-Control": "no-store",
    },
  });
});
