"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/ruangan", label: "Laga" },
  { href: "/ruangan/riwayat", label: "Riwayat" },
];

/** Tab navigasi area pengawas. */
export function RoomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu pengawas" className="mx-auto flex w-full max-w-3xl gap-4 px-4">
      {LINKS.map((link) => {
        const active =
          link.href === "/ruangan"
            ? pathname === "/ruangan" || pathname.startsWith("/ruangan/laga")
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 py-2 text-sm font-medium",
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
