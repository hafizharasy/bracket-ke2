import Link from "next/link";
import { Suspense } from "react";

import { RoomMonitorGrid } from "@/components/admin/room-monitor-grid";
import { LiveUpdater } from "@/components/bracket/live-updater";
import { getBracket } from "@/lib/get-bracket";
import { monitorRooms } from "@/lib/room-monitor";
import { getViolationCountsByRoom } from "@/lib/room-violation-counts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pantau Ruangan" };

export default function PantauPage({ searchParams }: PageProps<"/admin/pantau">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Pantau Ruangan</h1>
        <p className="text-sm text-muted-foreground">Status 10 ruangan untuk sesi aktif, diperbarui otomatis.</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Monitor searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Monitor({ searchParams }: Pick<PageProps<"/admin/pantau">, "searchParams">) {
  const [data, counts, params] = await Promise.all([getBracket(), getViolationCountsByRoom(), searchParams]);
  const requested = typeof params.sesi === "string" ? params.sesi : undefined;
  const { sessionId, rooms } = monitorRooms(data, counts, requested);
  const summary = {
    live: rooms.filter((r) => r.status === "berlangsung").length,
    done: rooms.filter((r) => r.status === "selesai").length,
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Pilih sesi" className="flex flex-wrap gap-1.5">
          {data.sessions.map((s) => (
            <Link
              key={s.id}
              href={`/admin/pantau?sesi=${s.id}`}
              scroll={false}
              aria-current={s.id === sessionId ? "page" : undefined}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium",
                s.id === sessionId ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s.name}
            </Link>
          ))}
        </nav>
        <LiveUpdater version={data.version} updatedAt={data.updatedAt} />
      </div>
      <p className="text-sm text-muted-foreground">
        {summary.live} ruangan sedang bertanding · {summary.done} ruangan selesai
      </p>
      <RoomMonitorGrid rooms={rooms} />
    </>
  );
}
