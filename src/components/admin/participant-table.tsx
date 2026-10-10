import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { ParticipantEditButton } from "@/components/admin/participant-edit-button";
import type { Participant, Room, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 50;

export type ParticipantQuery = { q: string; sesi: string; ruangan: string; page: number };

export function filterParticipants(participants: Participant[], query: ParticipantQuery) {
  const q = query.q.trim().toLowerCase();
  return participants.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q) && !(p.teamOrClub ?? "").toLowerCase().includes(q)) {
      return false;
    }
    if (query.sesi === "none" ? !!p.sessionId : query.sesi && p.sessionId !== query.sesi) return false;
    if (query.ruangan === "none" ? !!p.roomId : query.ruangan && p.roomId !== query.ruangan) return false;
    return true;
  });
}

/** Tabel peserta dengan pencarian, filter sesi/ruangan, total, dan halaman. */
export function ParticipantTable({
  participants,
  sessions,
  rooms,
  query,
}: {
  participants: Participant[];
  sessions: Session[];
  rooms: Room[];
  query: ParticipantQuery;
}) {
  const filtered = filterParticipants(participants, query);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const sessionName = new Map(sessions.map((s) => [s.id, s.name]));
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));

  const href = (patch: Partial<ParticipantQuery>) => {
    const next = { ...query, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.sesi) params.set("sesi", next.sesi);
    if (next.ruangan) params.set("ruangan", next.ruangan);
    if (next.page > 1) params.set("hal", String(next.page));
    const s = params.toString();
    return s ? `/admin/peserta?${s}` : "/admin/peserta";
  };
  const isFiltered = !!(query.q || query.sesi || query.ruangan);
  const selectClass = "h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section className="flex flex-col gap-3">
      <form action="/admin/peserta" className="flex flex-wrap items-end gap-2" role="search">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Cari peserta</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Cari nama, ID, atau sekolah…"
            className={cn(selectClass, "w-full pl-9")}
          />
        </label>
        <select name="sesi" defaultValue={query.sesi} aria-label="Filter sesi" className={selectClass}>
          <option value="">Semua sesi</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="none">Belum ada sesi</option>
        </select>
        <select name="ruangan" defaultValue={query.ruangan} aria-label="Filter ruangan" className={selectClass}>
          <option value="">Semua ruangan</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
          <option value="none">Belum ada ruangan</option>
        </select>
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          Cari
        </button>
        {isFiltered && (
          <Link href="/admin/peserta" className="flex h-10 items-center px-2 text-sm text-muted-foreground underline underline-offset-2">
            Reset
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length === 0
          ? "Tidak ada peserta yang cocok."
          : `Menampilkan ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length} dari ${filtered.length} peserta`}
        {isFiltered && ` (total semua: ${participants.length})`}
      </p>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Sekolah</th>
                <th className="px-3 py-2 font-medium">Sesi</th>
                <th className="px-3 py-2 font-medium">Ruangan</th>
                <th className="px-3 py-2"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.id.toUpperCase()}</td>
                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p.teamOrClub ?? "—"}</td>
                  <td className="px-3 py-1.5">{p.sessionId ? sessionName.get(p.sessionId) : <Unset />}</td>
                  <td className="px-3 py-1.5">{p.roomId ? roomName.get(p.roomId) : <Unset />}</td>
                  <td className="px-3 py-1 text-right">
                    <ParticipantEditButton participant={p} sessions={sessions} rooms={rooms} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Halaman" className="flex items-center justify-between text-sm">
          <PageLink href={href({ page: page - 1 })} disabled={page <= 1}>
            <ChevronLeftIcon className="size-4" /> Sebelumnya
          </PageLink>
          <span className="text-muted-foreground">Halaman {page} dari {pages}</span>
          <PageLink href={href({ page: page + 1 })} disabled={page >= pages}>
            Berikutnya <ChevronRightIcon className="size-4" />
          </PageLink>
        </nav>
      )}
    </section>
  );
}

function Unset() {
  return <span className="text-xs text-amber-700 dark:text-amber-400">Belum</span>;
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="flex items-center gap-1 text-muted-foreground/50">{children}</span>;
  return (
    <Link href={href} className="flex items-center gap-1 font-medium hover:underline">
      {children}
    </Link>
  );
}
