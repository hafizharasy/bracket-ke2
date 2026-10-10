import { Suspense } from "react";

import { PesertaTabs } from "@/components/admin/peserta-tabs";

export default function PesertaLayout({ children }: LayoutProps<"/admin/peserta">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Atur Peserta & Jadwal</h1>
        <p className="text-sm text-muted-foreground">
          Daftar peserta, pembagian ke 4 sesi dan 10 ruangan, serta penyusunan pasangan tanding.
        </p>
      </div>
      <Suspense fallback={<div className="h-9" />}>
        <PesertaTabs />
      </Suspense>
      {children}
    </main>
  );
}
