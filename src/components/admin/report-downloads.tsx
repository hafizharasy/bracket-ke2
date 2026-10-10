"use client";

import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { RecapData } from "@/lib/recap";
import { type CsvSeparator, REPORT_INFO, REPORTS, type ReportKind, reportCsv, reportFilename } from "@/lib/recap-export";
import { cn } from "@/lib/utils";

/** Simpan teks sebagai berkas di perangkat (tanpa server). */
function saveFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tombol unduh CSV satu laporan dari data rekap yang sedang tampil. */
export function DownloadCsvButton({
  recap,
  kind,
  separator = ";",
  label = "Unduh CSV",
  variant = "outline",
}: {
  recap: RecapData;
  kind: ReportKind;
  separator?: CsvSeparator;
  label?: string;
  variant?: "outline" | "default";
}) {
  return (
    <Button variant={variant} size="sm" onClick={() => saveFile(reportFilename(kind, recap), reportCsv(recap, kind, separator))}>
      <DownloadIcon /> {label}
    </Button>
  );
}

/** Kartu unduhan semua laporan + pilihan pemisah kolom (Excel Indonesia: titik koma). */
export function ReportDownloads({ recap }: { recap: RecapData }) {
  const [separator, setSeparator] = useState<CsvSeparator>(";");
  const counts: Record<ReportKind, string> = {
    hasil: `${recap.results.length} laga`,
    pelanggaran: `${recap.violations.length} catatan`,
    juara: `${recap.summary.roomChampions.length} ruangan-sesi`,
  };
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
              <DownloadCsvButton recap={recap} kind={kind} separator={separator} variant="default" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
