"use client";

import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { RecapFilters } from "@/lib/recap";
import { type CsvSeparator, REPORT_INFO, REPORTS, type ReportKind } from "@/lib/recap-export";
import { cn } from "@/lib/utils";

/** URL ekspor CSV di server (/api/admin/recap/export) sesuai filter. */
export function exportUrl(kind: ReportKind, filters: RecapFilters, separator: CsvSeparator = ";") {
  const params = new URLSearchParams({ laporan: kind });
  if (filters.sesi) params.set("sesi", filters.sesi);
  if (filters.ruangan) params.set("ruangan", filters.ruangan);
  if (separator === ",") params.set("pemisah", "koma");
  return `/api/admin/recap/export?${params}`;
}

/** Tautan unduh CSV satu laporan (berkas dibuat server). */
export function DownloadCsvButton({
  filters,
  kind,
  separator = ";",
  label = "Unduh CSV",
  variant = "outline",
}: {
  filters: RecapFilters;
  kind: ReportKind;
  separator?: CsvSeparator;
  label?: string;
  variant?: "outline" | "default";
}) {
  return (
    <a href={exportUrl(kind, filters, separator)} download className={cn(buttonVariants({ variant, size: "sm" }))}>
      <DownloadIcon /> {label}
    </a>
  );
}

/** Kartu unduhan semua laporan + pilihan pemisah kolom (Excel Indonesia: titik koma). */
export function ReportDownloads({ filters, counts }: { filters: RecapFilters; counts: Record<ReportKind, string> }) {
  const [separator, setSeparator] = useState<CsvSeparator>(";");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Pemisah kolom:</span>
        <div role="group" aria-label="Pemisah kolom CSV" className="flex rounded-lg border p-0.5">
          {([
            [";", "Titik koma (Excel Indonesia)"],
            [",", "Koma"],
          ] as const).map(([value, text]) => (
            <button key={value} type="button" aria-pressed={separator === value} onClick={() => setSeparator(value)}
              className={cn("rounded-md px-3 py-1", separator === value ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {text}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {REPORTS.map((kind) => (
          <li key={kind} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheetIcon className="size-6 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <div className="font-medium">{REPORT_INFO[kind].title}</div>
                <p className="text-sm text-muted-foreground">{REPORT_INFO[kind].description}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{counts[kind]}</span>
              <DownloadCsvButton filters={filters} kind={kind} separator={separator} variant="default" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
