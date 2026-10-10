"use client";

import {
  DicesIcon,
  ClipboardListIcon,
  DoorOpenIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const ADMIN_LINKS: {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    exact: true,
  },
  { href: "/admin/pantau", label: "Pantau Ruangan", icon: MonitorIcon },
  { href: "/admin/peserta", label: "Peserta & Jadwal", icon: UsersIcon },
  { href: "/admin/ruangan", label: "Ruangan & Sesi", icon: DoorOpenIcon },
  { href: "/admin/pengawas", label: "Akun Pengawas", icon: UserCogIcon },
  { href: "/admin/rekap", label: "Rekap & Ekspor", icon: ClipboardListIcon },
  { href: "/admin/simulasi", label: "Simulasi", icon: DicesIcon },
];

function useActive() {
  const pathname = usePathname();
  return (link: (typeof ADMIN_LINKS)[number]) =>
    link.exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** Navigasi admin: tab horizontal di layar kecil. */
export function AdminTabs() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Menu admin"
      className="flex gap-4 overflow-x-auto px-4 lg:hidden"
    >
      {ADMIN_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link) ? "page" : undefined}
          className={cn(
            "shrink-0 border-b-2 py-2 text-sm font-medium",
            isActive(link)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Navigasi admin: sidebar di layar lebar. */
export function AdminSidebar() {
  const isActive = useActive();
  return (
    <nav aria-label="Menu admin" className="flex flex-col gap-0.5">
      {ADMIN_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link) ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
              isActive(link)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
