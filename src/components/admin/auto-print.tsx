"use client";

import { useEffect } from "react";

/** Buka dialog cetak sekali saat halaman dibuka dengan ?cetak=1. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
