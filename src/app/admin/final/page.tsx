import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { FinalStandingsTable } from "@/components/bracket/final-standings-table";
import { Badge } from "@/components/ui/badge";
import { FINAL_ROUND, SEMIFINAL_ROUND, WIN_TYPES, type WinType } from "@/lib/bracket";
import { finalistsOf, finalStandings, formatPoints, winPoints } from "@/lib/final-standings";
import { getBracket } from "@/lib/get-bracket";
import type { Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Semifinal & Final" };

const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const STATUS = {
  scheduled: { label: "Terjadwal", className: "" },
  ongoing: { label: "LIVE", className: "border-transparent bg-red-600 text-white" },
  done: { label: "Selesai", className: "" },
} as const;

export default function AdminFinalPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Semifinal & Final</h1>
        <p className="text-sm text-muted-foreground">
          Input hasil babak puncak dari satu tempat. Klik <b>Input hasil</b> pada laga yang pesertanya sudah lengkap. Semifinal:
          isi jumlah game (2–0 / 2–1). Final: pilih pemenang dan jenis kemenangan (poin).
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Lists />
      </Suspense>
    </main>
  );
}

async function Lists() {
  const data = await getBracket();
  const people = new Map(data.participants.map((p) => [p.id, p]));
  const rooms = new Map(data.rooms.map((r) => [r.id, r.name]));
  const semifinals = data.matches.filter((m) => m.round === SEMIFINAL_ROUND).sort((a, b) => a.matchNumber - b.matchNumber);
  const finals = data.matches.filter((m) => m.round === FINAL_ROUND).sort((a, b) => a.matchNumber - b.matchNumber);
  if (semifinals.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Struktur bagan belum dibuat.</p>;
  }
  const finalists = finalistsOf(data.matches);
  const standings = finalStandings(finals, finalists.filter((id): id is string => !!id));
  const pending = semifinals.filter((_, i) => !finalists[i]).map((m) => m.matchNumber);
  // Laga final per putaran (laga yang dijadwalkan bersamaan).
  const rounds = [...Map.groupBy(finals, (m) => m.scheduledAt ?? "")].sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          Semifinal <span className="font-normal text-muted-foreground">· best of 3 · {semifinals.filter((m) => m.status === "done").length}/{semifinals.length} selesai</span>
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {semifinals.map((m) => (
            <MatchRow key={m.id} match={m} label={`Semifinal #${m.matchNumber}`} people={people} room={rooms.get(m.roomId)} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          Final round-robin <span className="font-normal text-muted-foreground">· {finals.filter((m) => m.status === "done").length}/{finals.length} selesai</span>
        </h2>
        <FinalStandingsTable rows={standings} participants={people} pending={pending} complete={finals.length > 0 && finals.every((m) => m.status === "done")} />
        <div className="flex flex-col gap-4">
          {rounds.map(([at, list], i) => (
            <div key={at || i} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-muted-foreground">
                Putaran {i + 1}
                {at && ` · ${time.format(new Date(at))} WIB`}
              </h3>
              <ul className="divide-y rounded-xl border bg-card">
                {list.map((m) => (
                  <MatchRow key={m.id} match={m} label={`Final #${m.matchNumber}`} people={people} room={rooms.get(m.roomId)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function MatchRow({ match, label, people, room }: { match: Match; label: string; people: Map<string, Participant>; room?: string }) {
  const a = match.participantAId ? people.get(match.participantAId) : undefined;
  const b = match.participantBId ? people.get(match.participantBId) : undefined;
  const ready = !!(a && b);
  const isFinal = match.round === FINAL_ROUND;
  const value = (id: string | null, score: number | null) =>
    match.status !== "done" ? "–" : isFinal ? (id === match.winnerId ? `+${formatPoints(winPoints(match.winType))}` : "0") : String(score ?? "–");
  const status = STATUS[match.status];

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-sm">
      <span className="w-40 shrink-0 text-xs text-muted-foreground">
        <span className="block font-medium text-foreground">{label}</span>
        {[room, match.scheduledAt && time.format(new Date(match.scheduledAt))].filter(Boolean).join(" · ")}
      </span>
      <span className="min-w-56 flex-1">
        {[
          { p: a, v: value(match.participantAId, match.scoreA), id: match.participantAId, tag: isFinal ? "tuan rumah" : null },
          { p: b, v: value(match.participantBId, match.scoreB), id: match.participantBId, tag: isFinal ? "tamu" : null },
        ].map(({ p, v, id, tag }, i) => (
          <span key={i} className={cn("flex items-center gap-2", match.winnerId && id === match.winnerId && "font-semibold")}>
            <span className="w-8 text-right tabular-nums">{v}</span>
            <span className={cn("truncate", !p && "italic text-muted-foreground")}>{p?.name ?? "Menunggu pemenang"}</span>
            {tag && p && <span className="text-[11px] text-muted-foreground">({tag})</span>}
          </span>
        ))}
        {isFinal && match.status === "done" && match.winType && (
          <span className="block pl-10 text-xs text-muted-foreground">{WIN_TYPES[match.winType as WinType]?.label}</span>
        )}
      </span>
      <Badge variant={match.status === "done" ? "secondary" : "outline"} className={status.className}>
        {status.label}
      </Badge>
      {ready ? (
        <Link
          href={`/admin/laga/${match.id}`}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
            match.status === "done" ? "border hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <PencilIcon className="size-3.5" /> {match.status === "done" ? "Koreksi" : "Input hasil"}
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Peserta belum lengkap</span>
      )}
    </li>
  );
}
