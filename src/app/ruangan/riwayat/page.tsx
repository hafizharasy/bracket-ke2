import { CameraIcon, PencilIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { getBracket } from "@/lib/get-bracket";
import { requirePengawas } from "@/lib/pengawas-session";
import { getRoomHistory, type RoomHistoryItem } from "@/lib/room-history";
import { cn } from "@/lib/utils";

export const metadata = { title: "Riwayat hasil · Bracket LRP 2026" };

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export default function RiwayatPage({ searchParams }: PageProps<"/ruangan/riwayat">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <History searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function History({ searchParams }: Pick<PageProps<"/ruangan/riwayat">, "searchParams">) {
  const [session, query] = await Promise.all([requirePengawas("/ruangan/riwayat"), searchParams]);
  const [items, data] = await Promise.all([getRoomHistory(session.roomId), getBracket()]);
  const room = data.rooms.find((r) => r.id === session.roomId);

  const sessionFilter = typeof query.sesi === "string" ? query.sesi : null;
  const sessions = data.sessions.filter((s) => items.some((i) => i.sessionId === s.id));
  const visible = sessionFilter ? items.filter((i) => i.sessionId === sessionFilter) : items;

  return (
    <>
      <div>
        <h1 className="font-heading text-xl font-semibold">Riwayat hasil</h1>
        <p className="text-sm text-muted-foreground">
          {room?.name} · {items.length} hasil tercatat
        </p>
      </div>

      {sessions.length > 1 && (
        <nav aria-label="Filter sesi" className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip href="/ruangan/riwayat" active={!sessionFilter}>
            Semua
          </Chip>
          {sessions.map((s) => (
            <Chip key={s.id} href={`/ruangan/riwayat?sesi=${s.id}`} active={sessionFilter === s.id}>
              {s.name}
            </Chip>
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada hasil yang diinput di ruangan ini.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {visible.map((item) => (
            <HistoryRow
              key={item.matchId}
              item={item}
              sessionName={data.sessions.find((s) => s.id === item.sessionId)?.name}
            />
          ))}
        </ol>
      )}
    </>
  );
}

function HistoryRow({ item, sessionName }: { item: RoomHistoryItem; sessionName?: string }) {
  const sides = [
    { p: item.participantA, score: item.scoreA },
    { p: item.participantB, score: item.scoreB },
  ];
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {item.roundLabel} #{item.matchNumber}
        </span>
        {sessionName && <span>· {sessionName}</span>}
        {item.recordedAt && (
          <span className="ml-auto">dicatat {timeFormat.format(new Date(item.recordedAt))}</span>
        )}
      </div>
      {sides.map(({ p, score }) => {
        const won = p.id === item.winnerId;
        return (
          <div key={p.id} className={cn("flex items-center gap-2 text-sm", won ? "font-semibold" : "text-muted-foreground")}>
            {won ? <TrophyIcon className="size-3.5 text-emerald-600" aria-label="pemenang" /> : <span className="size-3.5" />}
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="tabular-nums">{score}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 border-t pt-2 text-xs">
        {item.proofPhotoUrl ? (
          <a href={item.proofPhotoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-foreground hover:underline">
            <CameraIcon className="size-3.5" /> Lihat bukti
          </a>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CameraIcon className="size-3.5" /> Bukti belum tersedia
          </span>
        )}
        {item.recordedBy && <span className="text-muted-foreground">oleh {item.recordedBy}</span>}
        {item.corrections > 0 && (
          <span className="text-amber-700 dark:text-amber-400">dikoreksi {item.corrections}×</span>
        )}
        <Link href={`/ruangan/riwayat/${item.matchId}`} className="ml-auto font-medium hover:underline">
          Detail
        </Link>
        <Link href={`/ruangan/laga/${item.matchId}`} className="flex items-center gap-1 font-medium hover:underline">
          <PencilIcon className="size-3.5" /> Koreksi
        </Link>
      </div>
    </li>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
