"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Cari peserta (nama/sekolah) di bagan yang tampil: baris yang cocok
 * ditandai (data-search-hit) dan yang pertama digulir ke tengah layar.
 */
export function BracketSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    const clear = () => document.querySelectorAll("[data-search-hit]").forEach((el) => el.removeAttribute("data-search-hit"));
    const q = value.trim().toLowerCase();
    if (q.length < 2) {
      clear();
      setHits(null);
      return;
    }
    timer.current = setTimeout(() => {
      clear();
      // Bagan di dalam <details> yang tertutup ikut dibuka bila ada yang cocok.
      const rows = [...document.querySelectorAll<HTMLElement>("[data-pid]")].filter((el) =>
        (el.getAttribute("title") ?? "").toLowerCase().includes(q),
      );
      rows.forEach((el) => {
        el.setAttribute("data-search-hit", "");
        const details = el.closest("details");
        if (details && !details.open) details.open = true;
      });
      setHits(new Set(rows.map((el) => el.dataset.pid)).size);
      rows[0]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 250);
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <label className="relative flex h-10 items-center rounded-lg border-2 border-ink bg-white shadow-[3px_3px_0_0_var(--color-gold)]">
        <SearchIcon className="pointer-events-none absolute left-3 size-4 text-crimson" aria-hidden />
        <span className="sr-only">Cari peserta</span>
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Cari peserta atau sekolah"
          className="h-full w-full rounded-lg bg-transparent pr-8 pl-9 text-sm text-ink outline-none placeholder:text-ink/40"
        />
        {query && (
          <button type="button" onClick={() => search("")} className="absolute right-2 rounded p-1 text-ink/50 hover:text-ink" aria-label="Hapus pencarian">
            <XIcon className="size-3.5" />
          </button>
        )}
      </label>
      {hits !== null && (
        <span aria-live="polite" className="pl-1 text-[11px] text-ink/60">
          {hits === 0 ? "Tidak ditemukan di bagan yang tampil." : `${hits} peserta ditemukan — ditandai di bagan.`}
        </span>
      )}
    </div>
  );
}
