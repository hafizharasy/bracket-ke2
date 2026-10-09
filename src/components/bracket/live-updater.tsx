"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

// Refresh penuh ±350 KB (gzip) tanpa filter, jadi jangan terlalu sering.
const POLL_MS = 10_000;

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Jakarta",
});

/**
 * Live update lewat polling: tiap POLL_MS halaman di-refresh (RSC) sehingga
 * bagan mengambil data terbaru dari server. Berhenti saat tab tidak terlihat
 * atau dijeda pengguna.
 */
export function LiveUpdater({ updatedAt }: { updatedAt: string }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [paused, router]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5" aria-live="polite">
        <span
          className={cn(
            "size-2 rounded-full",
            paused ? "bg-muted-foreground/50" : "animate-pulse bg-red-500",
            isRefreshing && "bg-amber-500",
          )}
        />
        {paused ? "Live dijeda" : "Live"} · diperbarui {timeFormat.format(new Date(updatedAt))} WIB
      </span>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="flex items-center gap-1 rounded-md border px-2 py-0.5 hover:bg-muted"
        aria-pressed={paused}
      >
        {paused ? <PlayIcon className="size-3" /> : <PauseIcon className="size-3" />}
        {paused ? "Lanjutkan" : "Jeda"}
      </button>
    </div>
  );
}
