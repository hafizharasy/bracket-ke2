import { Suspense } from "react";

import { RekapTabs } from "@/components/admin/rekap-tabs";

export default function RekapLayout({ children }: LayoutProps<"/admin/rekap">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Rekap & Ekspor</h1>
        <p className="text-sm text-muted-foreground">
          Rekap hasil pertandingan dan pelanggaran per sesi/ruangan, serta unduh laporan untuk panitia.
        </p>
      </div>
      <Suspense fallback={<div className="h-9" />}>
        <RekapTabs />
      </Suspense>
      {children}
    </main>
  );
}
