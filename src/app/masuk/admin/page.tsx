import { LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { loginAdmin } from "@/app/masuk/actions";
import { LoginForm } from "@/components/auth/login-form";
import { getAdminSession } from "@/lib/admin-session";

export const metadata = { title: "Masuk Admin · Bracket LRP 2026" };

export default function MasukAdminPage({ searchParams }: PageProps<"/masuk/admin">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <LayoutDashboardIcon className="size-6 text-primary" aria-hidden />
        </span>
        <h1 className="font-heading text-2xl font-semibold">Masuk Admin Utama</h1>
        <p className="text-sm text-muted-foreground">Akses penuh untuk mengelola peserta, jadwal, ruangan, dan akun pengawas.</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-xs">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <FormOrRedirect searchParams={searchParams} />
        </Suspense>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-xl bg-muted/60 p-3 text-center text-xs text-muted-foreground">
          Mode pengembangan: admin@lrp.local dengan sandi demo <code className="font-mono">admin12345</code>.
        </p>
      )}

      <div className="flex flex-col items-center gap-1 text-sm">
        <Link href="/masuk" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Masuk sebagai pengawas ruangan
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Lihat bracket publik
        </Link>
      </div>
    </main>
  );
}

/** Sudah login sebagai admin → langsung ke dashboard. */
async function FormOrRedirect({ searchParams }: Pick<PageProps<"/masuk/admin">, "searchParams">) {
  const [session, params] = await Promise.all([getAdminSession(), searchParams]);
  const next = typeof params.next === "string" ? params.next : undefined;
  if (session) redirect(next?.startsWith("/admin") ? next : "/admin");
  const notice =
    params.keluar === "1" ? "Anda telah keluar." : params.alasan === "sesi" ? "Sesi admin berakhir. Silakan masuk lagi." : null;
  return (
    <>
      {notice && <p role="status" className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p>}
      <LoginForm submit={loginAdmin} next={next} />
    </>
  );
}
