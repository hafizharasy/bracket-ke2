import { CheckCircle2Icon, ClipboardListIcon, PlayIcon, RadioIcon, ShieldAlertIcon, TimerIcon } from "lucide-react";
import Link from "next/link";

import { roundLabel } from "@/lib/bracket";
import type { Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Ringkasan beranda pengawas: sapaan, hitungan laga sesi aktif, kartu aksi
 * berikutnya (laga berjalan / siap terdekat), dan pintasan.
 */
export function RoomHomeSummary({
  pengawasName,
  sessionName,
  matches,
  participants,
}: {
  pengawasName: string;
  sessionName: string | null;
  matches: Match[];
  participants: Map<string, Participant>;
}) {
  const live = matches.filter((m) => m.status === "ongoing");
  const ready = matches.filter((m) => m.status === "scheduled" && m.participantAId && m.participantBId);
  const done = matches.filter((m) => m.status === "done").length;
  const next = live[0] ?? ready[0];
  const name = (id: string | null) => (id ? participants.get(id)?.name : undefined) ?? "—";

  const stats = [
    { label: "Berlangsung", value: live.length, icon: RadioIcon, tone: live.length ? "text-red-600" : "text-muted-foreground" },
    { label: "Siap main", value: ready.length, icon: TimerIcon, tone: "text-sky-600" },
    { label: "Selesai", value: `${done}/${matches.length}`, icon: CheckCircle2Icon, tone: "text-emerald-600" },
  ];

  return (
    <section aria-label="Ringkasan ruangan" className="flex flex-col gap-3">
      <p className="text-sm">
        Halo, <span className="font-semibold">{pengawasName}</span>
        {sessionName && <span className="text-muted-foreground"> · {sessionName}</span>}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border bg-card p-2.5">
            <Icon className={cn("size-4", tone)} aria-hidden />
            <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {next ? (
        <Link
          href={`/ruangan/laga/${next.id}`}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 transition-colors",
            next.status === "ongoing" ? "border-red-500/60 bg-red-500/5 hover:bg-red-500/10" : "border-primary/40 bg-primary/5 hover:bg-primary/10",
          )}
        >
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", next.status === "ongoing" ? "bg-red-600 text-white" : "bg-primary text-primary-foreground")}>
            <PlayIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">
              {next.status === "ongoing" ? "Sedang berlangsung — isi hasil setelah selesai" : "Laga berikutnya"} · {roundLabel(next.round)} #{next.matchNumber}
              {next.scheduledAt && ` · ${time.format(new Date(next.scheduledAt))}`}
            </span>
            <span className="block truncate font-medium">
              {name(next.participantAId)} vs {name(next.participantBId)}
            </span>
          </span>
        </Link>
      ) : (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          {done === matches.length && matches.length > 0 ? "Semua laga sesi ini sudah selesai." : "Belum ada laga yang siap dimainkan."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/ruangan/pelanggaran/baru" className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium hover:bg-muted/50">
          <ShieldAlertIcon className="size-4 text-amber-600" /> Catat pelanggaran
        </Link>
        <Link href="/ruangan/riwayat" className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium hover:bg-muted/50">
          <ClipboardListIcon className="size-4 text-muted-foreground" /> Riwayat hasil
        </Link>
      </div>
    </section>
  );
}
