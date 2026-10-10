"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pesan + tautan masuk lagi (kembali ke halaman ini) saat sesi habis. */
export function SessionExpiredNotice({ message }: { message: string }) {
  const pathname = usePathname();
  return (
    <p className="text-destructive">
      {message}{" "}
      <Link href={`/masuk?next=${encodeURIComponent(pathname)}&alasan=sesi`} className="font-medium underline underline-offset-2">
        Masuk lagi
      </Link>
    </p>
  );
}
