import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RefereeEditor } from "@/components/admin/referee-editor";
import { Badge } from "@/components/ui/badge";
import { loadReferees } from "@/lib/admin-referees";
import { roundLabel, sortMatches } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { cn } from "@/lib/utils";

export const metadata = { title: "Laga ruangan" };

const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const STATUS = { scheduled: "Terjadwal", ongoing: "LIVE", done: "Selesai" } as const;

export default function RoomMatchesPage({ params, searchParams }: PageProps<"/admin/pantau/[roomId]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <RoomMatches params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RoomMatches({ params, searchParams }: Pick<PageProps<"/admin/pantau/[roomId]">, "params" | "searchParams">) {
  const [{ roomId }, query, data] = await Promise.all([params, searchParams, getBracket()]);
  const room = data.rooms.find((r) => r.id === roomId);
  if (!room) notFound();
  const session = data.sessions.find((s) => s.id === query.sesi) ?? data.sessions[0];
  const name = (id: string | null) => (id ? data.participants.find((p) => p.id === id)?.name : null);
  const list = data.matches.filter((m) => m.roomId === room.id && m.sessionId === session.id).sort(sortMatches);
  const referees = await loadReferees(list.map((m) => m.id), `/admin/pantau/${room.id}`);

  return (
    <>
      <Link href={`/admin/pantau?sesi=${session.id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Pantau ruangan
      </Link>
      <h1 className="font-heading text-2xl font-semibold">
        {room.name} · {session.name}
      </h1>
      <nav aria-label="Pilih sesi" className="flex flex-wrap gap-1.5">
        {data.sessions.map((s) => (
          <Link key={s.id} href={`/admin/pantau/${room.id}?sesi=${s.id}`} scroll={false} aria-current={s.id === session.id ? "page" : undefined}
            className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", s.id === session.id ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted")}>
            {s.name}
          </Link>
        ))}
      </nav>
      <ul className="divide-y rounded-xl border bg-card">
        {list.map((m) => (
          <li key={m.id}>
            <Link href={`/admin/laga/${m.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
              <span className="w-40 shrink-0 text-xs text-muted-foreground">
                {roundLabel(m.round)} #{m.matchNumber}
                {m.scheduledAt && ` · ${time.format(new Date(m.scheduledAt))}`}
                <span className="block truncate">{referees[m.id] ? `Pengawas: ${referees[m.id]}` : <span className="text-amber-700 dark:text-amber-400">Pengawas belum diisi</span>}</span>
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className={cn(m.winnerId === m.participantAId && m.winnerId && "font-semibold")}>{name(m.participantAId) ?? "—"}</span>
                <span className="mx-1.5 tabular-nums text-muted-foreground">{m.scoreA ?? "–"}:{m.scoreB ?? "–"}</span>
                <span className={cn(m.winnerId === m.participantBId && m.winnerId && "font-semibold")}>{name(m.participantBId) ?? "—"}</span>
              </span>
              <Badge variant={m.status === "done" ? "secondary" : "outline"} className={cn(m.status === "ongoing" && "border-transparent bg-red-600 text-white")}>
                {STATUS[m.status]}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > 0 && (
        <RefereeEditor
          key={`${session.id}-${JSON.stringify(referees)}`}
          initial={referees}
          rows={list.map((m) => ({
            matchId: m.id,
            label: `${roundLabel(m.round)} #${m.matchNumber}`,
            detail: [name(m.participantAId), name(m.participantBId)].filter(Boolean).join(" vs ") || undefined,
          }))}
        />
      )}
    </>
  );
}
