import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { loginPengawas } from "@/app/masuk/actions";
import { getPengawasSession, safeNext } from "@/lib/pengawas-session";

export const metadata = { title: "Masuk Pengawas · Bracket LRP 2026" };

export default function MasukPengawasPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-600/10">
          <ShieldCheckIcon className="size-6 text-emerald-600" aria-hidden />
        </span>
        <h1 className="font-heading text-2xl font-semibold">Masuk Pengawas</h1>
        <p className="text-sm text-muted-foreground">
          Gunakan akun ruangan dari admin. Setelah masuk, Anda hanya bisa mengelola ruangan Anda.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-xs">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <FormOrRedirect searchParams={searchParams} />
        </Suspense>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-xl bg-muted/60 p-3 text-center text-xs text-muted-foreground">
          Mode pengembangan: masuk dengan email akun pengawas (mis. ruangan2@lrp.local) dan sandi demo{" "}
          <code className="font-mono">pengawas123</code>.
        </p>
      )}

      <div className="flex flex-col items-center gap-1 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Lihat bracket publik
        </Link>
      </div>
    </main>
  );
}

/** Sudah login sebagai pengawas → langsung ke ruangan (atau `next`). */
async function FormOrRedirect({ searchParams }: Pick<PageProps<"/masuk">, "searchParams">) {
  const [session, params] = await Promise.all([getPengawasSession(), searchParams]);
  const next = typeof params.next === "string" ? params.next : undefined;
  if (session) redirect(safeNext(next));
  const notice =
    params.keluar === "1"
      ? "Anda telah keluar. Sampai jumpa!"
      : params.alasan === "sesi"
        ? "Sesi Anda berakhir. Silakan masuk lagi untuk melanjutkan."
        : null;
  return (
    <>
      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <LoginForm submit={loginPengawas} next={next} />
    </>
  );
}
