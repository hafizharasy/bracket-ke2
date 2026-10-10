import Link from "next/link";
import { Suspense } from "react";

import { LiveUpdater } from "@/components/bracket/live-updater";
import { RoomHomeSummary } from "@/components/ruangan/room-home-summary";
import { RoomMatchRow } from "@/components/ruangan/room-match-row";
import { buildSlotLabels, sortMatches } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { canAccessRoom, getPengawasSession } from "@/lib/pengawas-session";
import { ROOM_MATCH_GROUPS, roomMatchGroup } from "@/lib/room-matches";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ruangan · Bracket LRP 2026" };

export default function RuanganPage({ searchParams }: PageProps<"/ruangan">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <RoomMatches searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RoomMatches({ searchParams }: Pick<PageProps<"/ruangan">, "searchParams">) {
  const [session, query] = await Promise.all([getPengawasSession(), searchParams]);
  const data = await getBracket();

  const room = data.rooms.find((r) => r.id === session.roomId);
  const participants = new Map(data.participants.map((p) => [p.id, p]));
  const slotLabels = buildSlotLabels(data.matches, {
    sessions: new Map(data.sessions.map((s) => [s.id, s])),
    rooms: new Map(data.rooms.map((r) => [r.id, r])),
  });
  // Pengawas hanya melihat laga di ruangannya.
  const roomMatches = data.matches.filter((m) => canAccessRoom(session, m.roomId)).sort(sortMatches);

  // Sesi aktif: dari URL, atau sesi pertama yang masih punya laga belum selesai.
  const sessionsWithMatches = data.sessions.filter((s) =>
    roomMatches.some((m) => m.sessionId === s.id),
  );
  const requested = typeof query.sesi === "string" ? query.sesi : undefined;
  const activeSession =
    sessionsWithMatches.find((s) => s.id === requested) ??
    sessionsWithMatches.find((s) =>
      roomMatches.some((m) => m.sessionId === s.id && m.status !== "done"),
    ) ??
    sessionsWithMatches.at(-1);
  const matches = roomMatches.filter((m) => m.sessionId === activeSession?.id);

  const doneCount = matches.filter((m) => m.status === "done").length;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">{room?.name ?? "Ruangan"}</h1>
        {room?.location && <p className="text-sm text-muted-foreground">{room.location}</p>}
        <LiveUpdater version={data.version} updatedAt={data.updatedAt} />
      </div>

      <RoomHomeSummary
        pengawasName={session.name}
        sessionName={activeSession?.name ?? null}
        matches={matches}
        participants={participants}
      />

      <nav aria-label="Pilih sesi" className="flex gap-1.5 overflow-x-auto pb-1">
        {sessionsWithMatches.map((s) => (
          <Link
            key={s.id}
            href={`/ruangan?sesi=${s.id}`}
            scroll={false}
            aria-current={s.id === activeSession?.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
              s.id === activeSession?.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            {s.name}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-muted-foreground">
        {doneCount} dari {matches.length} laga selesai
      </p>

      {ROOM_MATCH_GROUPS.map((group) => {
        const list = matches.filter((m) => roomMatchGroup(m) === group.key);
        if (list.length === 0 && group.key !== "ongoing" && group.key !== "ready") return null;
        return (
          <section key={group.key} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">
              {group.title} <span className="font-normal text-muted-foreground">({list.length})</span>
            </h2>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                {group.empty}
              </p>
            ) : (
              list.map((match) => (
                <RoomMatchRow
                  key={match.id}
                  match={match}
                  participants={participants}
                  slotLabels={slotLabels.get(match.id)}
                />
              ))
            )}
          </section>
        );
      })}
    </>
  );
}
