import Link from "next/link";

import { BracketSearch } from "@/components/bracket/bracket-search";
import { RoomSelect } from "@/components/bracket/room-select";
import type { Room, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BracketFilterValue = { sessionId: string | null; roomId: string | null };

/** Bangun query string filter; nilai null dihapus dari URL. */
export function filterHref({ sessionId, roomId }: BracketFilterValue) {
  const params = new URLSearchParams();
  if (sessionId) params.set("sesi", sessionId);
  if (roomId) params.set("ruangan", roomId);
  const query = params.toString();
  return query ? `/?${query}#bracket` : "/#bracket";
}

/**
 * Filter bagan per sesi (tab) dan ruangan (pilihan), disimpan di URL
 * (?sesi=&ruangan=) supaya bisa dibagikan, plus pencarian peserta di bagan.
 */
export function BracketFilter({
  sessions,
  rooms,
  value,
}: {
  sessions: Session[];
  /** Ruangan yang bisa dipilih (yang dipakai di sesi terpilih). */
  rooms: Room[];
  value: BracketFilterValue;
}) {
  return (
    <nav aria-label="Filter bagan" className="flex flex-col gap-4 border-b-2 border-ink/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap gap-1.5">
        <Tab href={filterHref({ sessionId: null, roomId: value.roomId })} active={!value.sessionId}>
          Semua sesi
        </Tab>
        {sessions.map((s) => (
          <Tab key={s.id} href={filterHref({ sessionId: s.id, roomId: null })} active={value.sessionId === s.id}>
            {s.name}
          </Tab>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row lg:w-[26rem] lg:flex-col">
        <RoomSelect rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} value={value} />
        <BracketSearch />
      </div>
    </nav>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full px-4 py-2 text-xs font-bold transition-colors",
        active ? "bg-crimson text-white shadow-[3px_3px_0_0_var(--color-gold)]" : "text-ink/70 hover:bg-ink/5",
      )}
    >
      {children}
    </Link>
  );
}
