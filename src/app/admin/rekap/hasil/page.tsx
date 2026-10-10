import { Suspense } from "react";

import { RekapFilter } from "@/components/admin/rekap-filter";
import { ResultRecapList } from "@/components/admin/result-recap-list";
import { getRecap, recapFilters } from "@/lib/recap-source";

export const metadata = { title: "Hasil Pertandingan · Rekap" };

export default function RekapHasilPage({ searchParams }: PageProps<"/admin/rekap/hasil">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/admin/rekap/hasil">, "searchParams">) {
  const recap = await getRecap(recapFilters(await searchParams));
  return (
    <div className="flex flex-col gap-4">
      <RekapFilter sessions={recap.sessions} rooms={recap.rooms} />
      {/* key: reset pencarian & halaman saat filter sesi/ruangan berubah */}
      <ResultRecapList key={`${recap.filters.sesi ?? ""}-${recap.filters.ruangan ?? ""}`} rows={recap.results} />
    </div>
  );
}
