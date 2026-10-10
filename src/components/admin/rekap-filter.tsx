"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

/** Filter sesi & ruangan rekap (disimpan di URL: ?sesi=&ruangan=). */
export function RekapFilter({
  sessions,
  rooms,
}: {
  sessions: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: "sesi" | "ruangan", value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    start(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const control =
    "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className={cn("flex flex-wrap items-center gap-2 print:hidden", pending && "opacity-60")}>
      <select aria-label="Filter sesi" value={params.get("sesi") ?? ""} onChange={(e) => set("sesi", e.target.value)} className={control}>
        <option value="">Semua sesi</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select aria-label="Filter ruangan" value={params.get("ruangan") ?? ""} onChange={(e) => set("ruangan", e.target.value)} className={control}>
        <option value="">Semua ruangan</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </div>
  );
}
