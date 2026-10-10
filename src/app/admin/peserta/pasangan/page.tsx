import Link from "next/link";
import { Suspense } from "react";

import { PairingEditor, type PairingPlayer } from "@/components/admin/pairing-editor";
import { PLAYERS_PER_ROOM, roomsInSession } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pasangan Tanding" };

export default function PasanganPage({ searchParams }: PageProps<"/admin/peserta/pasangan">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Pairings searchParams={searchParams} />
    </Suspense>
  );
}

async function Pairings({ searchParams }: Pick<PageProps<"/admin/peserta/pasangan">, "searchParams">) {
  const [data, params] = await Promise.all([getBracket(), searchParams]);
  const { participants, sessions, matches } = data;
  const session = sessions.find((s) => s.id === params.sesi) ?? sessions[0];
  // Hanya ruangan yang dipakai di sesi terpilih.
  const rooms = session ? roomsInSession(data, session.id) : [];
  const room = rooms.find((r) => r.id === params.ruangan) ?? rooms[0];
  if (!session || !room) return <p className="text-sm text-muted-foreground">Sesi/ruangan belum ada.</p>;

  const toPlayer = (id: string | null): PairingPlayer | null => {
    const p = id ? participants.find((x) => x.id === id) : undefined;
    return p ? { id: p.id, name: p.name, club: p.teamOrClub } : null;
  };
  const roomMatches = matches.filter((m) => m.sessionId === session.id && m.roomId === room.id);
  const roundOne = roomMatches.filter((m) => m.round === 1).sort((a, b) => a.matchNumber - b.matchNumber);
  const initial = roundOne.flatMap((m) => [toPlayer(m.participantAId), toPlayer(m.participantBId)]).filter((p): p is PairingPlayer => !!p);
  const inBracket = new Set(initial.map((p) => p.id));
  const bench = participants
    .filter((p) => p.sessionId === session.id && p.roomId === room.id && !inBracket.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, club: p.teamOrClub }));
  const locked = roomMatches.some((m) => m.status !== "scheduled");
  const href = (s: string, r: string) => `/admin/peserta/pasangan?sesi=${s}&ruangan=${r}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <nav aria-label="Pilih sesi" className="flex flex-wrap gap-1.5">
          {sessions.map((s) => (
            <Link key={s.id} href={`/admin/peserta/pasangan?sesi=${s.id}`} scroll={false} aria-current={s.id === session.id ? "page" : undefined}
              className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", s.id === session.id ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted")}>
              {s.name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Pilih ruangan" className="flex gap-1.5 overflow-x-auto pb-1">
          {rooms.map((r) => (
            <Link key={r.id} href={href(session.id, r.id)} scroll={false} aria-current={r.id === room.id ? "page" : undefined}
              className={cn("shrink-0 rounded-lg border px-2.5 py-1 text-sm", r.id === room.id ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted")}>
              {r.name.replace("Ruangan ", "R")}
            </Link>
          ))}
        </nav>
      </div>
      <h2 className="text-sm font-semibold">
        Babak 1 · {session.name} · {room.name}{" "}
        <span className="font-normal text-muted-foreground">({roundOne.length} laga)</span>
      </h2>
      <PairingEditor
        key={`${session.id}-${room.id}`}
        sessionId={session.id}
        roomId={room.id}
        initial={initial}
        bench={bench}
        locked={locked}
        slots={PLAYERS_PER_ROOM}
      />
    </div>
  );
}
