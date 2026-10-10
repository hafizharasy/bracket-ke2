import { Suspense } from "react";

import { RekapFilter } from "@/components/admin/rekap-filter";
import { DownloadCsvButton } from "@/components/admin/report-downloads";
import { ViolationRecap } from "@/components/admin/violation-recap";
import { getRecap, recapFilters } from "@/lib/recap-source";

export const metadata = { title: "Pelanggaran · Rekap" };

export default function RekapPelanggaranPage({ searchParams }: PageProps<"/admin/rekap/pelanggaran">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Violations searchParams={searchParams} />
    </Suspense>
  );
}

async function Violations({ searchParams }: Pick<PageProps<"/admin/rekap/pelanggaran">, "searchParams">) {
  const recap = await getRecap(recapFilters(await searchParams));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RekapFilter sessions={recap.sessions} rooms={recap.rooms} />
        {/* Cukup kirim data laporan ini ke klien. */}
        <DownloadCsvButton recap={{ ...recap, results: [] }} kind="pelanggaran" />
      </div>
      <ViolationRecap key={`${recap.filters.sesi ?? ""}-${recap.filters.ruangan ?? ""}`} rows={recap.violations} />
    </div>
  );
}
