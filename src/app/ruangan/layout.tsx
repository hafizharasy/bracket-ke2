import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { RoomLockBadge } from "@/components/ruangan/room-lock-badge";
import { RoomNav } from "@/components/ruangan/room-nav";
import { getAdminSession } from "@/lib/admin-session";
import { requirePengawas } from "@/lib/pengawas-session";

export default function RuanganLayout({ children }: LayoutProps<"/ruangan">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center gap-2 px-4">
          <ShieldCheckIcon className="size-4 text-emerald-600" aria-hidden />
          <span className="text-sm font-semibold">Area Pengawas</span>
          <Suspense>
            <RoomLockBadge />
          </Suspense>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" />
            Bracket publik
          </Link>
        </div>
        {/* Tab aktif dibaca dari URL → perlu Suspense pada rute dinamis. */}
        <Suspense fallback={<div className="h-9" />}>
          <RoomNav />
        </Suspense>
      </header>
      {/* Pembatas akses: hanya pengawas yang sudah login. */}
      <Suspense fallback={<div className="mx-auto m-6 h-64 w-full max-w-3xl animate-pulse rounded-xl bg-muted" />}>
        <RuanganGuard>{children}</RuanganGuard>
      </Suspense>
    </div>
  );
}

async function RuanganGuard({ children }: { children: React.ReactNode }) {
  // Admin utama memantau dari dashboard, bukan area pengawas.
  if (await getAdminSession()) redirect("/admin/pantau");
  await requirePengawas();
  return children;
}
