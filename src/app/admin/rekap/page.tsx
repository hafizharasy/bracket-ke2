import { CheckCircle2Icon, PencilLineIcon, RadioIcon, ShieldAlertIcon, TrophyIcon, UsersIcon } from "lucide-react";
import { Suspense } from "react";

import { RekapFilter } from "@/components/admin/rekap-filter";
import { getRecap, recapFilters } from "@/lib/recap-source";

export const metadata = { title: "Rekap & Ekspor" };

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default function RekapPage({ searchParams }: PageProps<"/admin/rekap">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Summary searchParams={searchParams} />
    </Suspense>
  );
}

async function Summary({ searchParams }: Pick<PageProps<"/admin/rekap">, "searchParams">) {
  const recap = await getRecap(recapFilters(await searchParams));
  const { summary } = recap;
  const scope = [
    recap.sessions.find((s) => s.id === recap.filters.sesi)?.name ?? "Semua sesi",
    recap.rooms.find((r) => r.id === recap.filters.ruangan)?.name ?? "semua ruangan",
  ].join(" · ");
  const maxType = Math.max(1, ...summary.violations.byType.map((t) => t.count));

  const cards = [
    { label: "Laga selesai", value: `${summary.matches.done}/${summary.matches.total}`, note: `${summary.matches.percent}%`, icon: CheckCircle2Icon, tone: "text-emerald-600" },
    { label: "Berlangsung", value: summary.matches.ongoing, note: `${summary.matches.scheduled} terjadwal`, icon: RadioIcon, tone: "text-red-600" },
    { label: "Hasil dikoreksi", value: summary.corrections, note: "koreksi tercatat", icon: PencilLineIcon, tone: "text-amber-600" },
    { label: "Pelanggaran", value: summary.violations.total, note: `${summary.violations.participants} peserta`, icon: ShieldAlertIcon, tone: "text-orange-600" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RekapFilter sessions={recap.sessions} rooms={recap.rooms} />
        <p className="text-xs text-muted-foreground">
          {scope} · per {dateTime.format(new Date(recap.generatedAt))} WIB
        </p>
      </div>

      <section aria-label="Ringkasan angka" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <Icon className={`size-5 ${tone}`} aria-hidden />
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
            <div className="text-sm">{label}</div>
            <div className="text-xs text-muted-foreground">{note}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Juara" className="flex min-w-0 flex-col gap-2">
          <h2 className="font-semibold">Juara</h2>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <TrophyIcon className="size-6 text-amber-500" aria-hidden />
            <div>
              <div className="text-xs text-muted-foreground">Juara LRP 2026</div>
              <div className="font-semibold">{summary.champion ?? "Belum ditentukan"}</div>
            </div>
          </div>
          <ChampionGrid champions={summary.roomChampions} />
        </section>

        <section aria-label="Pelanggaran per jenis" className="flex min-w-0 flex-col gap-2">
          <h2 className="font-semibold">Pelanggaran per jenis</h2>
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            {summary.violations.byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada pelanggaran pada filter ini.</p>
            ) : (
              summary.violations.byType.map((t) => (
                <div key={t.type} className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{t.type}</span>
                    <span className="tabular-nums text-muted-foreground">{t.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-orange-500" style={{ width: `${(t.count / maxType) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UsersIcon className="size-3.5" /> {summary.violations.participants} peserta tercatat melanggar
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Juara ruangan sebagai tabel ruangan × sesi (lebih ringkas dari daftar 40 baris). */
function ChampionGrid({ champions }: { champions: { sessionName: string; roomName: string; champion: string | null }[] }) {
  if (champions.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Tidak ada final ruangan pada filter ini.</p>;
  }
  const sessions = [...new Set(champions.map((c) => c.sessionName))];
  const rooms = [...new Set(champions.map((c) => c.roomName))];
  const get = (room: string, session: string) => champions.find((c) => c.roomName === room && c.sessionName === session);
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Juara ruangan per sesi</caption>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Ruangan</th>
            {sessions.map((s) => (
              <th key={s} className="px-3 py-2 font-medium">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rooms.map((room) => (
            <tr key={room}>
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">{room}</th>
              {sessions.map((session) => {
                const name = get(room, session)?.champion;
                return (
                  <td key={session} className="px-3 py-2">
                    {name ?? <span className="text-muted-foreground">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
