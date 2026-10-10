import { LockIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Masuk Admin · Bracket LRP 2026" };

/** Tujuan pembatas akses area admin. Form login dibuat pada fitur Login Admin Utama. */
export default function MasukAdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <LockIcon className="size-8 text-muted-foreground" />
      <h1 className="font-heading text-xl font-semibold">Khusus Admin Utama</h1>
      <p className="text-sm text-muted-foreground">
        Silakan masuk dengan akun admin utama untuk membuka dashboard.
      </p>
      <Link href="/" className="text-sm underline underline-offset-2">
        Kembali ke bracket publik
      </Link>
    </main>
  );
}
