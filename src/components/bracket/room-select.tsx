"use client";

import { ChevronDownIcon, DoorOpenIcon } from "lucide-react";
import { useRouter } from "next/navigation";

type Value = { sessionId: string | null; roomId: string | null };

/** Pilihan ruangan; mengganti ?ruangan= di URL. */
export function RoomSelect({ rooms, value }: { rooms: { id: string; name: string }[]; value: Value }) {
  const router = useRouter();
  return (
    <label className="relative flex h-10 w-full shrink-0 items-center rounded-lg border-2 border-ink bg-white shadow-[3px_3px_0_0_var(--color-gold)]">
      <DoorOpenIcon className="pointer-events-none absolute left-3 size-4 text-crimson" aria-hidden />
      <span className="sr-only">Pilih ruangan</span>
      <select
        value={value.roomId ?? ""}
        onChange={(e) => {
          const params = new URLSearchParams();
          if (value.sessionId) params.set("sesi", value.sessionId);
          if (e.target.value) params.set("ruangan", e.target.value);
          const query = params.toString();
          router.push(query ? `/?${query}#bracket` : "/#bracket", { scroll: false });
        }}
        className="h-full w-full appearance-none rounded-lg bg-transparent pr-8 pl-9 text-sm font-semibold text-ink outline-none"
      >
        <option value="">Semua ruangan</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 size-4 text-ink/60" aria-hidden />
    </label>
  );
}
