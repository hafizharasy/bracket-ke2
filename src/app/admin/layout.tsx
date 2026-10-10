import { ArrowLeftIcon, LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminSidebar, AdminTabs } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";

export const metadata = { title: { template: "%s · Admin LRP 2026", default: "Admin LRP 2026" } };

/**
 * Kerangka area admin: header + tab di layar kecil, sidebar di layar lebar
 * (lg). Konten tiap halaman mengatur lebarnya sendiri.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="flex h-12 items-center gap-2 px-4">
          <LayoutDashboardIcon className="size-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Admin Bracket LRP 2026</span>
          <Suspense>
            <AdminName />
          </Suspense>
          <Link href="/" className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-3" />
            Bracket publik
          </Link>
          <LogoutButton role="admin" className="ml-3" />
        </div>
        {/* Tab aktif dibaca dari URL → perlu Suspense pada rute dinamis. */}
        <Suspense fallback={<div className="h-9 lg:hidden" />}>
          <AdminTabs />
        </Suspense>
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 border-r p-3 lg:block print:hidden">
          <div className="flex h-full flex-col">
            <Suspense>
              <AdminSidebar />
            </Suspense>
            <LogoutButton role="admin" className="mt-auto rounded-lg px-3 py-2 text-sm hover:bg-muted" />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Pembatas akses: konten admin hanya dirender untuk admin utama. */}
          <Suspense fallback={<div className="m-6 h-64 animate-pulse rounded-xl bg-muted" />}>
            <AdminGuard>{children}</AdminGuard>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AdminGuard({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

async function AdminName() {
  const session = await getAdminSession();
  return session ? <span className="hidden text-xs text-muted-foreground sm:inline">· {session.name}</span> : null;
}
