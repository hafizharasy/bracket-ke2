import { ShieldAlertIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";

import type { ActivityItem } from "@/lib/admin-activity";

const time = new Intl.DateTimeFormat("id-ID", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Umpan aktivitas terbaru (hasil & pelanggaran) di dashboard admin. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Belum ada aktivitas.</p>;
  return (
    <ol className="divide-y rounded-xl border bg-card">
      {items.map((item, i) => {
        const href = item.matchId ? `/admin/laga/${item.matchId}` : undefined;
        const body =
          item.kind === "result" ? (
            <>
              <TrophyIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{item.winner}</span> menang {item.score}
                <span className="block text-xs text-muted-foreground">{item.roomName} · {item.label}</span>
              </span>
            </>
          ) : (
            <>
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{item.participant}</span> — {item.type}
                <span className="block text-xs text-muted-foreground">{item.roomName}</span>
              </span>
            </>
          );
        return (
          <li key={`${item.kind}-${i}`}>
            {(() => {
              const inner = (
                <>
                  {body}
                  <span className="shrink-0 text-xs text-muted-foreground">{time.format(new Date(item.at))}</span>
                </>
              );
              const cls = "flex items-start gap-2.5 px-3 py-2.5 text-sm";
              return href ? (
                <Link href={href} className={`${cls} hover:bg-muted/50`}>{inner}</Link>
              ) : (
                <div className={cls}>{inner}</div>
              );
            })()}
          </li>
        );
      })}
    </ol>
  );
}
