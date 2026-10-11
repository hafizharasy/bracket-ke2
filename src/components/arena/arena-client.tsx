"use client";

import { MenuIcon, MoonIcon, SunIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const THEME_KEY = "arena-theme";

/**
 * Skrip kecil yang dijalankan sebelum halaman tampil: memasang tema malam
 * yang tersimpan (tanpa kedip) dan menandai bahwa animasi gulir aktif.
 */
export const ARENA_BOOT_SCRIPT = `try{var a=document.currentScript.parentElement;if(localStorage.getItem("${THEME_KEY}")==="night")a.dataset.theme="night";if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("reveal-ready")}catch(e){}`;

function arenaRoot() {
  return document.querySelector<HTMLElement>(".arena");
}

/** Tombol siang/malam (disimpan di browser pengunjung). */
export function ThemeToggle({ className }: { className?: string }) {
  const [night, setNight] = useState(false);

  useEffect(() => {
    // Sinkronkan dengan tema yang sudah dipasang skrip boot.
    const id = requestAnimationFrame(() => setNight(arenaRoot()?.dataset.theme === "night"));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle() {
    const next = !night;
    setNight(next);
    const root = arenaRoot();
    if (root) {
      if (next) root.dataset.theme = "night";
      else delete root.dataset.theme;
    }
    try {
      localStorage.setItem(THEME_KEY, next ? "night" : "day");
    } catch {
      // penyimpanan diblokir: tema tetap berlaku sampai halaman ditutup
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={night ? "Ganti ke mode siang" : "Ganti ke mode malam"}
      aria-pressed={night}
      className={cn(
        "relative flex h-9 w-[4.5rem] shrink-0 items-center justify-between rounded-full border-2 border-navy bg-cream px-1.5 shadow-[2px_2px_0_0_var(--color-gold)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-7 rounded-full bg-gold transition-[left] duration-300 ease-out",
          night ? "left-[calc(100%-1.95rem)]" : "left-0.5",
        )}
      />
      <SunIcon className={cn("relative size-4", night ? "text-ink/50" : "text-navy")} aria-hidden />
      <MoonIcon className={cn("relative size-4", night ? "text-navy" : "text-ink/50")} aria-hidden />
    </button>
  );
}

/**
 * Memunculkan elemen ber-`data-reveal` saat masuk layar (fade + geser naik).
 * Elemen baru (mis. setelah pembaruan live) ikut diamati.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = arenaRoot();
    if (!root || !("IntersectionObserver" in window)) {
      document.documentElement.classList.remove("reveal-ready");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0 },
    );
    const watch = (scope: ParentNode) =>
      scope.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => io.observe(el));
    watch(root);
    const mo = new MutationObserver(() => watch(root));
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}

/** Angka yang menghitung naik saat pertama kali terlihat. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      done.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1200);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(value * eased).toLocaleString("id-ID");
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("id-ID")}
    </span>
  );
}

/** Menu ringkas untuk layar kecil. */
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Tutup menu" : "Buka menu"}
        className="flex size-9 items-center justify-center rounded-lg border-2 border-navy/80 bg-cream text-ink"
      >
        {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>
      <div
        className={cn(
          "absolute inset-x-0 top-full origin-top border-b-4 border-gold bg-cream px-4 shadow-lg transition-all duration-300",
          open ? "visible scale-y-100 opacity-100" : "invisible scale-y-95 opacity-0",
        )}
      >
        <nav aria-label="Navigasi halaman" className="mx-auto flex max-w-6xl flex-col py-2">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="border-b border-ink/10 py-3 font-display text-sm text-ink last:border-0"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
