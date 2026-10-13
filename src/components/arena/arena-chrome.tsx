// Kerangka halaman publik bertema karnaval: header, lencana judul seksi,
// seksi format kompetisi, dan footer.

import { StarIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MobileNav, ThemeToggle } from "@/components/arena/arena-client";
import { cn } from "@/lib/utils";

export const EVENT_NAME = "MCR & LRP 2026";
export const EVENT_TAGLINE = "UNESA · Championship";

/** Logo bulat merah-kuning dengan bintang + nama acara. */
export function ArenaLogo({ className, tone = "auto" }: { className?: string; tone?: "auto" | "dark" }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-gold bg-crimson shadow-[2px_2px_0_0_var(--color-navy)]">
        <span className="flex size-7 items-center justify-center rounded-full bg-gold">
          <StarIcon className="size-4 fill-crimson text-crimson" aria-hidden />
        </span>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] tracking-wide text-gold [text-shadow:1px_1px_0_var(--color-navy)]">
          {EVENT_NAME}
        </span>
        <span
          className={cn(
            "block text-[9px] font-bold tracking-[0.12em] uppercase",
            tone === "dark" ? "text-white/75" : "text-ink/70",
          )}
        >
          {EVENT_TAGLINE}
        </span>
      </span>
    </span>
  );
}

export const NAV = [
  { href: "#bracket", label: "Bracket" },
  { href: "#semifinal", label: "Semifinal" },
  { href: "#final", label: "Final" },
  { href: "#format", label: "Format" },
];

export function ArenaHeader() {
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-md">
      <div className="arena-checker h-1.5" aria-hidden />
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={`${EVENT_NAME} — beranda`} className="mr-auto">
          <ArenaLogo />
        </Link>
        <nav aria-label="Navigasi halaman" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group relative py-5 text-sm font-semibold text-ink/75 transition-colors hover:text-crimson"
            >
              {item.label}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 rounded-t bg-crimson transition-transform duration-300 group-hover:scale-x-100"
              />
            </a>
          ))}
        </nav>
        <ThemeToggle className="md:ml-4" />
        <MobileNav items={NAV} />
      </div>
      <div className="h-[3px] bg-crimson" aria-hidden />
      <div className="h-[3px] bg-gold" aria-hidden />
    </header>
  );
}

/** Lencana kecil di atas judul seksi, mis. "Jalur menuju juara". */
export function SectionBadge({ children, className, tone = "gold" }: { children: ReactNode; className?: string; tone?: "gold" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1 font-display text-[10px] tracking-[0.15em] uppercase",
        tone === "gold"
          ? "border-navy bg-gold text-navy shadow-[3px_3px_0_0_var(--color-crimson)]"
          : "border-transparent bg-crimson text-white shadow-[3px_3px_0_0_var(--color-gold)]",
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
    <section
      id="format"
      className="relative scroll-mt-20 overflow-hidden bg-navy bg-cover bg-center text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgb(25 58 85 / 0.88), rgb(17 19 38 / 0.96)), url(/arena/carnival-night.jpg)",
      }}
    >
      <div className="arena-checker h-3" aria-hidden />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div data-reveal className="flex flex-col items-start gap-4">
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
              data-reveal
              style={{ ["--i" as string]: i + 1 }}
              className="flex gap-5 rounded-xl border border-gold/35 bg-navy/60 p-5 shadow-[3px_3px_0_0_rgb(200_16_46/0.7)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
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
        <ArenaLogo tone="dark" />
        <p className="text-xs text-white/60">
          © 2026 {EVENT_NAME}. Sistem turnamen resmi. ·{" "}
          <Link href="/privasi" className="underline underline-offset-2 hover:text-gold">
            Kebijakan Privasi
          </Link>
        </p>
        <p className="font-display text-[10px] tracking-[0.2em] text-gold/80">Fair play. Great games.</p>
      </div>
    </footer>
  );
}
