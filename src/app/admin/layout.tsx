import { ArrowLeftIcon, LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = { title: { template: "%s · Admin LRP 2026", default: "Admin LRP 2026" } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-2 px-4">
          <LayoutDashboardIcon className="size-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Admin Utama</span>
          <Link href="/" className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-3" />
            Bracket publik
          </Link>
        </div>
        {/* Tab aktif dibaca dari URL → perlu Suspense pada rute dinamis. */}
        <Suspense fallback={<div className="h-9" />}>
          <AdminNav />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
