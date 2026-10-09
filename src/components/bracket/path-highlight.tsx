"use client";

import { useState, type ReactNode } from "react";

/**
 * Menyorot jalur seorang peserta di seluruh bagan: saat baris peserta
 * (elemen ber-`data-pid`) disentuh/di-hover, semua baris dengan peserta
 * yang sama ikut disorot sehingga terlihat ia maju sampai babak mana.
 */
export function PathHighlight({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState<string | null>(null);

  return (
    <div
      onPointerOver={(e) => {
        const row = (e.target as HTMLElement).closest<HTMLElement>("[data-pid]");
        setPid(row?.dataset.pid ?? null);
      }}
      onPointerLeave={() => setPid(null)}
      className="contents"
    >
      {pid && (
        <style>{`[data-pid="${CSS.escape(pid)}"]{background-color:var(--path-highlight)}`}</style>
      )}
      {children}
    </div>
  );
}
