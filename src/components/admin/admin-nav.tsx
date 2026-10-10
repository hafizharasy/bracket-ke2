"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/peserta", label: "Peserta & Jadwal" },
  { href: "/admin/ruangan", label: "Ruangan & Sesi" },
  { href: "/admin/pengawas", label: "Akun Pengawas" },
] as const;

/** Navigasi utama area admin (gulir horizontal di layar kecil). */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu admin" className="mx-auto flex w-full max-w-6xl gap-4 overflow-x-auto px-4">
      {ADMIN_LINKS.map((link) => {
        const active = "exact" in link ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 py-2 text-sm font-medium",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
