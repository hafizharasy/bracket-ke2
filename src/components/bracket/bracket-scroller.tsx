"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Wadah gulir horizontal untuk bagan lebar. Menampilkan bayangan di tepi
 * yang masih bisa digulir, tombol ←/→ yang melompat per babak (kolom
 * ber-`data-round-col`), snap per babak saat digeser di layar sentuh, dan
 * bisa difokus supaya tombol panah keyboard ikut menggulir.
 */
export function BracketScroller({
  label,
  tone = "card",
  children,
}: {
  label: string;
  /** Warna permukaan di belakang bagan, untuk bayangan tepi. */
  tone?: "card" | "background" | "cream";
  children: ReactNode;
}) {
  const fade = tone === "card" ? "from-card" : tone === "cream" ? "from-cream" : "from-background";
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 1,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update]);

  function scrollByRound(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left;
    const offsets = [...el.querySelectorAll<HTMLElement>("[data-round-col]")].map(
      (col) => col.getBoundingClientRect().left - left + el.scrollLeft,
    );
    const target =
      direction === 1
        ? offsets.find((x) => x > el.scrollLeft + 1)
        : offsets.findLast((x) => x < el.scrollLeft - 1);
    el.scrollTo({ left: target ?? (direction === 1 ? el.scrollWidth : 0), behavior: "smooth" });
  }

  const scrollable = edges.start || edges.end;

  return (
    <div className="flex flex-col gap-1">
      {scrollable && (
        <div className="flex items-center justify-end gap-1">
          <span className="mr-1 text-[11px] text-muted-foreground sm:hidden">Geser untuk babak lain</span>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => scrollByRound(-1)}
            disabled={!edges.start}
            aria-label="Babak sebelumnya"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => scrollByRound(1)}
            disabled={!edges.end}
            aria-label="Babak berikutnya"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
      <div className="relative">
        <div
          ref={ref}
          onScroll={update}
          tabIndex={scrollable ? 0 : undefined}
          role="region"
          aria-label={label}
          className="snap-x snap-proximity overflow-x-auto overscroll-x-contain scroll-smooth pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r to-transparent transition-opacity",
            fade,
            edges.start ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l to-transparent transition-opacity",
            fade,
            edges.end ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
