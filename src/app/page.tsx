import { Suspense } from "react";

import { ArenaFooter, ArenaHeader, FormatSection } from "@/components/arena/arena-chrome";
import { ARENA_BOOT_SCRIPT, RevealObserver } from "@/components/arena/arena-client";
import { BracketSkeleton, PublicBracket } from "@/components/arena/public-bracket";

/**
 * Halaman publik statis: kerangka (header, format, footer) diprerender sekali,
 * bagan disusun di browser dari /api/bracket. Ratusan penonton yang membuka
 * atau memuat ulang bersamaan tidak membebani server untuk merender bagan.
 */
export default function BracketPage() {
  return (
    <div className="arena flex min-h-full flex-1 flex-col" suppressHydrationWarning>
      {/* Tema malam tersimpan & animasi gulir dipasang sebelum halaman tampil. */}
      <script dangerouslySetInnerHTML={{ __html: ARENA_BOOT_SCRIPT }} />
      <RevealObserver />
      <ArenaHeader />
      <main className="flex flex-1 flex-col">
        {/* Filter dibaca dari URL di browser (useSearchParams), jadi perlu Suspense. */}
        <Suspense fallback={<BracketSkeleton />}>
          <PublicBracket />
        </Suspense>
      </main>
      <FormatSection />
      <ArenaFooter />
    </div>
  );
}
