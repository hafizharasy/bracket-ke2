import { LockIcon } from "lucide-react";
import Link from "next/link";

/** Ditampilkan saat pengawas membuka laga di ruangan yang bukan miliknya. */
export function OtherRoomNotice({ roomName }: { roomName?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="flex items-start gap-2">
        <LockIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <span>
          Laga ini berlangsung di {roomName ?? "ruangan lain"}. Akun pengawas hanya bisa melihat dan
          mengisi hasil di ruangannya sendiri.
        </span>
      </p>
      <Link href="/ruangan" className="font-medium underline underline-offset-2">
        Kembali ke laga ruangan saya
      </Link>
    </div>
  );
}
