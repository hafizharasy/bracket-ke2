import Link from "next/link";

import type { Room, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BracketFilterValue = { sessionId: string | null; roomId: string | null };

/** Bangun query string filter; nilai null dihapus dari URL. */
function filterHref({ sessionId, roomId }: BracketFilterValue) {
  const params = new URLSearchParams();
  if (sessionId) params.set("sesi", sessionId);
  if (roomId) params.set("ruangan", roomId);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * Filter bagan per sesi dan ruangan. Disimpan di URL (?sesi=&ruangan=)
 * supaya tautan hasil filter bisa dibagikan; cukup berupa tautan biasa.
 */
export function BracketFilter({
  sessions,
  rooms,
  value,
}: {
  sessions: Session[];
  rooms: Room[];
  value: BracketFilterValue;
}) {
  return (
    <nav aria-label="Filter bagan" className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <FilterRow label="Sesi">
        <Chip href={filterHref({ ...value, sessionId: null })} active={!value.sessionId}>
          Semua
        </Chip>
        {sessions.map((s) => (
          <Chip
            key={s.id}
            href={filterHref({ ...value, sessionId: s.id })}
            active={value.sessionId === s.id}
          >
            {s.name}
          </Chip>
        ))}
      </FilterRow>
      <FilterRow label="Ruangan">
        <Chip href={filterHref({ ...value, roomId: null })} active={!value.roomId}>
          Semua
        </Chip>
        {rooms.map((r) => (
          <Chip
            key={r.id}
            href={filterHref({ ...value, roomId: r.id })}
            active={value.roomId === r.id}
          >
            {r.name.replace("Ruangan ", "R")}
          </Chip>
        ))}
      </FilterRow>
      {(value.sessionId || value.roomId) && (
        <Link
          href="/"
          scroll={false}
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Hapus semua filter
        </Link>
      )}
    </nav>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
