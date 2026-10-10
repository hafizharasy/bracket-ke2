import { Suspense } from "react";

import { PrintButton } from "@/components/admin/print-button";
import { RekapFilter } from "@/components/admin/rekap-filter";
import { ReportDownloads } from "@/components/admin/report-downloads";
import { getRecap, recapFilters } from "@/lib/recap-source";

export const metadata = { title: "Unduh Laporan · Rekap" };

export default function RekapUnduhPage({ searchParams }: PageProps<"/admin/rekap/unduh">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Downloads searchParams={searchParams} />
    </Suspense>
  );
}

async function Downloads({ searchParams }: Pick<PageProps<"/admin/rekap/unduh">, "searchParams">) {
  const recap = await getRecap(recapFilters(await searchParams));
  const scope = [
    recap.sessions.find((s) => s.id === recap.filters.sesi)?.name ?? "Semua sesi",
    recap.rooms.find((r) => r.id === recap.filters.ruangan)?.name ?? "semua ruangan",
  ].join(" · ");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RekapFilter sessions={recap.sessions} rooms={recap.rooms} />
        <PrintButton label="Cetak ringkasan" href={`/admin/rekap${recap.filters.sesi || recap.filters.ruangan ? `?${new URLSearchParams(Object.entries(recap.filters).filter(([, v]) => v) as [string, string][])}` : ""}`} />
      </div>
      <p className="text-sm text-muted-foreground">
        Cakupan laporan: <span className="font-medium text-foreground">{scope}</span>. Berkas CSV bisa dibuka di Excel / Google Sheets.
      </p>
      <ReportDownloads
        filters={recap.filters}
        counts={{
          hasil: `${recap.results.length} laga`,
          pelanggaran: `${recap.violations.length} catatan`,
          juara: `${recap.summary.roomChampions.length} ruangan-sesi`,
        }}
      />
    </div>
  );
}
