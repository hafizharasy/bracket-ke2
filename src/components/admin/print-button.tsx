"use client";

import { PrinterIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Cetak / simpan PDF lewat dialog cetak browser. Dengan `href`, buka
 * halaman itu dulu (?cetak=1) lalu cetak otomatis di sana.
 */
export function PrintButton({ label = "Cetak / PDF", href }: { label?: string; href?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => (href ? router.push(`${href}${href.includes("?") ? "&" : "?"}cetak=1`) : window.print())}
    >
      <PrinterIcon /> {label}
    </Button>
  );
}
