"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/peserta", label: "Daftar Peserta" },
  { href: "/admin/peserta/sesi", label: "Pembagian Sesi" },
  { href: "/admin/peserta/ruangan", label: "Penempatan Ruangan" },
  { href: "/admin/peserta/pasangan", label: "Pasangan Tanding" },
];

/** Sub-navigasi fitur Atur Peserta & Jadwal. */
export function PesertaTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Atur peserta & jadwal" className="flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
