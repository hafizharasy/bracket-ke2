// Kerangka halaman publik bertema arena: header, lencana judul seksi,
// seksi format kompetisi, dan footer.

import { LogInIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const EVENT_NAME = "MCR & LRP 2026";
export const EVENT_TAGLINE = "UNESA · Championship";

/** Logo bulat merah-kuning dengan bintang + nama acara. */
export function ArenaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-11 items-center justify-center rounded-full border-[3px] border-gold bg-crimson">
        <span className="flex size-7 items-center justify-center rounded-full bg-gold">
          <StarIcon className="size-4 fill-crimson text-crimson" aria-hidden />
        </span>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] tracking-wide text-gold">{EVENT_NAME}</span>
        <span className="block text-[9px] font-bold tracking-[0.12em] text-white/80 uppercase">{EVENT_TAGLINE}</span>
      </span>
    </span>
  );
}

const NAV = [
  { href: "#bracket", label: "Bracket" },
  { href: "#final", label: "Final" },
  { href: "#format", label: "Format" },
];

export function ArenaHeader() {
  return (
    <header className="sticky top-0 z-40 bg-ink">
      <div className="arena-checker h-1.5" aria-hidden />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${EVENT_NAME} — beranda`}>
          <ArenaLogo />
        </Link>
        <nav aria-label="Navigasi halaman" className="mx-auto hidden items-center gap-8 md:flex">
          {NAV.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "relative py-5 text-sm font-semibold transition-colors hover:text-gold",
                i === 0 ? "text-gold after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-t after:bg-gold" : "text-white/85",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Link
          href="/masuk"
          className="ml-auto flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink shadow-[3px_3px_0_0_var(--color-crimson)] transition-transform hover:-translate-y-0.5 md:ml-0"
        >
          <LogInIcon className="size-4" aria-hidden />
          <span className="hidden sm:inline">Masuk pengawas</span>
          <span className="sm:hidden">Masuk</span>
        </Link>
      </div>
      <div className="h-0.5 bg-crimson" aria-hidden />
    </header>
  );
}

/** Lencana kuning kecil di atas judul seksi, mis. "Jalur menuju juara". */
export function SectionBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border-2 border-ink bg-gold px-3 py-1 font-display text-[10px] tracking-[0.15em] text-ink uppercase shadow-[3px_3px_0_0_var(--color-crimson)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const FORMAT = [
  { title: "Babak ruangan", text: "64 peserta per ruangan bertanding dengan sistem eliminasi 1 vs 1 hingga tersisa satu juara ruangan." },
  { title: "Semifinal", text: "Para juara ruangan saling berhadapan dalam format best of three — yang lebih dulu menang 2 game lolos." },
  {
    title: "Final",
    text: "Finalis bertemu dua kali (tuan rumah & tamu) dalam kompetisi penuh. Poin: +3 menang 4 pion, +2 menang 3 pion, +1 3 pion tercepat, +½ 2 pion terbanyak.",
  },
];

export function FormatSection() {
  return (
    <section id="format" className="scroll-mt-20 bg-ink text-white">
      <div className="arena-checker h-3" aria-hidden />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-4">
          <SectionBadge>Format kompetisi</SectionBadge>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">Adil sejak babak pertama hingga final.</h2>
          <p className="max-w-md text-[15px] text-[#d9cbbd]">
            Setiap tahap dirancang untuk memastikan peserta terbaik maju dengan sistem pertandingan yang transparan.
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {FORMAT.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-5 rounded-xl border border-gold/40 bg-white/[0.03] p-5 shadow-[3px_3px_0_0_rgb(209_15_47/0.6)]"
            >
              <span className="font-display text-lg text-gold">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-display text-sm tracking-wide uppercase">{step.title}</span>
                <span className="mt-1 block text-sm text-[#d9cbbd]">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ArenaFooter() {
  return (
    <footer className="border-t border-gold/20 bg-ink-deep text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <ArenaLogo />
        <p className="text-xs text-white/60">© 2026 {EVENT_NAME}. Sistem turnamen resmi.</p>
        <p className="font-display text-[10px] tracking-[0.2em] text-gold/80">Fair play. Great games.</p>
      </div>
    </footer>
  );
}
