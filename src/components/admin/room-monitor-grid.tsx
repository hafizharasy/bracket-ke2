import { CrownIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

import type { RoomMonitor, RoomStatus } from "@/lib/room-monitor";
import { cn } from "@/lib/utils";

const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

const STATUS: Record<RoomStatus, { label: string; className: string }> = {
  berlangsung: { label: "LIVE", className: "bg-red-600 text-white" },
  siap: { label: "Siap", className: "bg-sky-600/15 text-sky-800 dark:text-sky-300" },
  menunggu: { label: "Menunggu", className: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  selesai: { label: "Selesai", className: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300" },
  kosong: { label: "Tidak ada laga", className: "bg-muted text-muted-foreground" },
};

/** Grid pemantauan 10 ruangan. `compact` untuk ringkasan di dashboard. */
export function RoomMonitorGrid({ rooms, compact = false }: { rooms: RoomMonitor[]; compact?: boolean }) {
  return (
    <ul className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-3")}>
      {rooms.map((room) => {
        const status = STATUS[room.status];
        return (
          <li
            key={room.roomId}
            className={cn("flex flex-col gap-2 rounded-xl border bg-card p-3", room.status === "berlangsung" && "border-red-500/50")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/admin/pantau/${room.roomId}${room.sessionId ? `?sesi=${room.sessionId}` : ""}`} className="font-medium hover:underline">
                  {room.name}
                </Link>
                {!compact && room.location && <div className="truncate text-xs text-muted-foreground">{room.location}</div>}
              </div>
              <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", status.className)}>
                {room.status === "berlangsung" && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
                {status.label}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{room.done}/{room.total} laga</span>
                {room.violations > 0 && (
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <ShieldAlertIcon className="size-3" /> {room.violations}
                  </span>
                )}
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(room.done / Math.max(1, room.total)) * 100}%` }} />
              </div>
            </div>

            {!compact &&
              room.live.map((m) => (
                <Link key={m.matchId} href={`/admin/laga/${m.matchId}`} className="block rounded-lg bg-red-500/5 p-2 text-sm hover:bg-red-500/10">
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="flex justify-between gap-2"><span className="truncate">{m.a}</span><span className="font-semibold tabular-nums">{m.scoreA ?? 0}</span></div>
                  <div className="flex justify-between gap-2"><span className="truncate">{m.b}</span><span className="font-semibold tabular-nums">{m.scoreB ?? 0}</span></div>
                </Link>
              ))}
            {compact && room.live.length > 0 && (
              <div className="truncate text-xs">
                {room.live[0].a} <span className="font-semibold tabular-nums">{room.live[0].scoreA ?? 0}–{room.live[0].scoreB ?? 0}</span> {room.live[0].b}
              </div>
            )}

            {room.champion ? (
              <div className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <CrownIcon className="size-3.5" /> Juara: {room.champion}
              </div>
            ) : (
              !compact &&
              room.next && (
                <Link href={`/admin/laga/${room.next.matchId}`} className="text-xs text-muted-foreground hover:text-foreground">
                  Berikutnya: {room.next.label}
                  {room.next.scheduledAt && ` · ${time.format(new Date(room.next.scheduledAt))}`}
                </Link>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
