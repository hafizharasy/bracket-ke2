"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/rekap", label: "Ringkasan" },
  { href: "/admin/rekap/hasil", label: "Hasil Pertandingan" },
  { href: "/admin/rekap/pelanggaran", label: "Pelanggaran" },
  { href: "/admin/rekap/unduh", label: "Unduh Laporan" },
];

/** Sub-navigasi Rekap & Ekspor; filter sesi/ruangan ikut terbawa antar tab. */
export function RekapTabs() {
  const pathname = usePathname();
  // Bawa filter sesi/ruangan saja (bukan ?cetak=1).
  const params = new URLSearchParams(useSearchParams());
  params.delete("cetak");
  const query = params.toString();
  return (
    <nav aria-label="Rekap & ekspor" className="flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={query ? `${tab.href}?${query}` : tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
