"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

/** Interval cek versi saat stream SSE tidak tersedia. */
const FALLBACK_POLL_MS = 10_000;

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Jakarta",
});

type Mode = "connecting" | "realtime" | "polling";

/**
 * Live update berbasis versi: berlangganan /api/bracket/stream (SSE) dan
 * me-refresh halaman (RSC) hanya saat versi bagan berubah. Bila stream gagal,
 * beralih ke polling ringan /api/bracket/version (ETag/304). Saat tab tidak
 * terlihat, refresh ditunda sampai tab dibuka lagi.
 */
export function LiveUpdater({ version, updatedAt }: { version: number; updatedAt: string }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<Mode>("connecting");
  const [isRefreshing, startTransition] = useTransition();

  // Versi yang sedang tampil; dibaca dari callback tanpa memasang ulang koneksi.
  const shownVersion = useRef(version);
  useEffect(() => {
    shownVersion.current = version;
  }, [version]);

  useEffect(() => {
    if (paused) return;
    let pending = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const refresh = () => {
      if (document.visibilityState !== "visible") {
        pending = true;
        return;
      }
      pending = false;
      startTransition(() => router.refresh());
    };
    const handleVersion = (next: number) => {
      if (next !== shownVersion.current) refresh();
    };
    const onVisible = () => {
      if (pending && document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const startPolling = () => {
      setMode("polling");
      pollTimer = setInterval(async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const res = await fetch("/api/bracket/version", { cache: "no-cache" });
          if (res.ok) handleVersion((await res.json()).version);
        } catch {
          // jaringan putus sesaat; coba lagi di interval berikutnya
        }
      }, FALLBACK_POLL_MS);
    };

    let source: EventSource | undefined;
    if ("EventSource" in window) {
      source = new EventSource("/api/bracket/stream");
      source.addEventListener("open", () => setMode("realtime"));
      source.addEventListener("version", (event) => {
        setMode("realtime");
        handleVersion(JSON.parse((event as MessageEvent<string>).data).version);
      });
      source.addEventListener("error", () => {
        // EventSource menyambung ulang sendiri; bila ditutup permanen, pakai polling.
        if (source?.readyState === EventSource.CLOSED && !pollTimer) startPolling();
      });
    } else {
      startPolling();
    }

    return () => {
      source?.close();
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paused, router]);

  const label = paused
    ? "Live dijeda"
    : mode === "polling"
      ? "Live (cek berkala)"
      : mode === "connecting"
        ? "Menyambung…"
        : "Live";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5" aria-live="polite">
        <span
          className={cn(
            "size-2 rounded-full",
            paused || mode === "connecting" ? "bg-muted-foreground/50" : "animate-pulse bg-red-500",
            isRefreshing && "bg-amber-500",
          )}
        />
        {label} · diperbarui {timeFormat.format(new Date(updatedAt))} WIB
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
