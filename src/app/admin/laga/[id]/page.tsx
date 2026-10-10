import { ArrowLeftIcon, ArrowRightIcon, CameraOffIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RefereeEditor } from "@/components/admin/referee-editor";
import { ResultForm } from "@/components/ruangan/result-form";
import { Badge } from "@/components/ui/badge";
import { getAdminMatchView } from "@/lib/admin-match-view";
import { loadReferees } from "@/lib/admin-referees";
import { getBracket } from "@/lib/get-bracket";
import { nextPreview } from "@/lib/next-preview";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail laga" };

const dt = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const fmt = (iso: string | null) => (iso ? `${dt.format(new Date(iso))} WIB` : "—");
const STATUS = { scheduled: "Terjadwal", ongoing: "Berlangsung", done: "Selesai" } as const;
const ACTION = { create: "Input hasil", correct: "Koreksi", cancel: "Dibatalkan" } as const;

export default function AdminMatchPage({ params }: PageProps<"/admin/laga/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: Pick<PageProps<"/admin/laga/[id]">, "params">) {
  const { id } = await params;
  const referees = await loadReferees([id], `/admin/laga/${id}`);
  const [m, data] = await Promise.all([getAdminMatchView(id), getBracket()]);
  if (!m) notFound();
  const match = data.matches.find((x) => x.id === id)!;
  const a = data.participants.find((p) => p.id === match.participantAId);
  const b = data.participants.find((p) => p.id === match.participantBId);
  const nameOf = (pid: string) => (pid === m.participantA?.id ? m.participantA.name : pid === m.participantB?.id ? m.participantB.name : pid);

  return (
    <>
      <Link
        href={`/admin/pantau/${m.room.id}?sesi=${m.session.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> {m.room.name} · {m.session.name}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          {m.roundLabel} · Laga #{m.matchNumber}
        </h1>
        <Badge className={cn(m.status === "ongoing" && "bg-red-600 text-white")} variant={m.status === "done" ? "secondary" : m.status === "ongoing" ? "default" : "outline"}>
          {STATUS[m.status]}
        </Badge>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        {m.session.name} · {m.room.name}
        {m.room.location && ` (${m.room.location})`} · {fmt(m.scheduledAt)}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {([["a", m.participantA, m.scoreA, m.sources.a], ["b", m.participantB, m.scoreB, m.sources.b]] as const).map(([key, p, score, source]) => {
          const won = !!p && p.id === m.winnerId;
          return (
            <div key={key} className={cn("flex flex-col items-center gap-1 rounded-xl border p-4 text-center", won && "border-emerald-500 bg-emerald-500/5")}>
              <span className="text-4xl font-bold tabular-nums">{score ?? "–"}</span>
              <span className={cn("font-medium", !p && "italic text-muted-foreground")}>{p?.name ?? source ?? "Belum ada"}</span>
              {p && <span className="text-xs text-muted-foreground">{p.teamOrClub ?? "Tanpa sekolah"} · {p.id.toUpperCase()}</span>}
              {won && <Badge className="mt-1 bg-emerald-600 text-white"><TrophyIcon data-icon="inline-start" /> Pemenang</Badge>}
            </div>
          );
        })}
      </div>

      {m.nextMatch && (
        <Link href={`/admin/laga/${m.nextMatch.id}`} className="flex items-center gap-1.5 rounded-xl border bg-muted/40 p-3 text-sm hover:bg-muted">
          Pemenang maju ke <ArrowRightIcon className="size-3.5" /> <span className="font-medium">{m.nextMatch.label}</span>
        </Link>
      )}

      <RefereeEditor key={referees[id] ?? ""} rows={[{ matchId: id, label: `${m.roundLabel} #${m.matchNumber}` }]} initial={referees} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{m.status === "done" ? "Koreksi hasil (admin)" : "Input hasil (admin)"}</h2>
        {a && b ? (
          <ResultForm key={match.id} match={match} participantA={a} participantB={b} next={nextPreview(data, match)} />
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Peserta laga ini belum lengkap. Hasil bisa diisi setelah pemenang laga sebelumnya ditentukan.
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Foto bukti</h2>
          {m.result?.proofPhotoUrl ? (
            <a href={m.result.proofPhotoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto dari penyimpanan bukti */}
              <img src={m.result.proofPhotoUrl} alt="Foto bukti hasil" className="max-h-80 w-full object-contain" />
            </a>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              <CameraOffIcon className="size-6" /> Belum ada foto bukti.
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Jejak hasil</h2>
          {m.history.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Belum ada catatan hasil.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {m.history.map((h) => (
                <li key={h.id} className="rounded-xl border bg-card p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className={cn("font-medium", h.action === "cancel" && "text-destructive", h.action === "correct" && "text-amber-700 dark:text-amber-400")}>
                      {ACTION[h.action]}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmt(h.recordedAt)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {h.scoreA}–{h.scoreB}, pemenang {nameOf(h.winnerId)}
                    {h.recordedBy && ` · oleh ${h.recordedBy}`}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Pelanggaran di laga ini ({m.violations.length})</h2>
        {m.violations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada pelanggaran tercatat.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {m.violations.map((v) => (
              <li key={v.id} className="flex flex-wrap gap-x-2 px-3 py-2 text-sm">
                <span className="font-medium">{v.participantName}</span>
                <span className="text-amber-700 dark:text-amber-400">{v.type}</span>
                {v.note && <span className="text-muted-foreground">— {v.note}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{fmt(v.occurredAt)} · {v.recordedBy}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
