import { CalendarClockIcon, CheckCircle2Icon, CrownIcon, RadioIcon, ShieldAlertIcon, TrophyIcon, UsersIcon } from "lucide-react";

import type { TournamentSummary } from "@/lib/tournament-summary";
import { cn } from "@/lib/utils";

const time = new Intl.DateTimeFormat("id-ID", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Kartu ringkasan turnamen untuk dashboard admin. */
export function TournamentSummaryCards({ summary, violations }: { summary: TournamentSummary; violations: number }) {
  const { matches, activeSession } = summary;
  const cards = [
    { label: "Peserta", value: summary.participants, icon: UsersIcon },
    { label: "Laga selesai", value: `${matches.done}/${matches.total}`, icon: CheckCircle2Icon },
    { label: "Sedang berjalan", value: matches.ongoing, icon: RadioIcon, live: matches.ongoing > 0 },
    { label: "Juara ruangan", value: `${summary.roomChampions.decided}/${summary.roomChampions.total}`, icon: CrownIcon },
    { label: "Pelanggaran", value: violations, icon: ShieldAlertIcon },
  ];

  return (
    <section aria-label="Ringkasan turnamen" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Progres turnamen</div>
            <div className="text-3xl font-semibold tabular-nums">{matches.percent}%</div>
          </div>
          <div className="text-right text-sm">
            {summary.champion ? (
              <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                <TrophyIcon className="size-4" /> Juara: {summary.champion}
              </span>
            ) : activeSession ? (
              <span>
                {activeSession.name}{" "}
                <span className={cn("font-medium", activeSession.state === "berjalan" ? "text-red-600" : "text-muted-foreground")}>
                  {activeSession.state === "berjalan" ? "sedang berjalan" : activeSession.state === "berikutnya" ? "berikutnya" : "selesai"}
                </span>
              </span>
            ) : null}
            {summary.nextMatch && (
              <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <CalendarClockIcon className="size-3.5" />
                Laga siap berikutnya: {summary.nextMatch.label}
                {summary.nextMatch.roomName && ` · ${summary.nextMatch.roomName}`}
                {summary.nextMatch.scheduledAt && ` · ${time.format(new Date(summary.nextMatch.scheduledAt))}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${matches.done} selesai, ${matches.ongoing} berjalan dari ${matches.total} laga`}>
          <div className="bg-emerald-500" style={{ width: `${(matches.done / Math.max(1, matches.total)) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(matches.ongoing / Math.max(1, matches.total)) * 100}%` }} />
        </div>
        <div className="grid gap-2 pt-1 sm:grid-cols-4">
          {summary.sessions.map((s) => (
            <div key={s.id} className="text-xs">
              <div className="flex justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="tabular-nums text-muted-foreground">{s.done}/{s.total}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", s.done === s.total ? "bg-emerald-500" : "bg-primary")} style={{ width: `${(s.done / Math.max(1, s.total)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, live }) => (
          <div key={label} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", live && "border-red-500/50")}>
            <Icon className={cn("size-5 shrink-0", live ? "text-red-500" : "text-muted-foreground")} aria-hidden />
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{label}</div>
              <div className="text-xl font-semibold tabular-nums">{value}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
