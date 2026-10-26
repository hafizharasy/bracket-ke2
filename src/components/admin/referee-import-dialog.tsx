"use client";

import { AlertTriangleIcon, CheckCircle2Icon, DownloadIcon, Loader2Icon, UploadIcon, UserCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { importRefereesAction, type RefereeImportResult } from "@/app/admin/laga/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isXlsx, xlsxToCsv } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2_000_000;
type Preview = Extract<RefereeImportResult, { simulated: false }>;
type State =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "checked" | "saved"; preview: Preview }
  | { kind: "simulated" }
  | { kind: "error"; message: string };

/**
 * Impor nama pengawas per laga (privat admin): unduh daftar laga → isi kolom
 * "Pengawas" di Excel → unggah (.xlsx/.csv) → periksa → simpan.
 */
export function RefereeImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "busy";

  async function run(text: string, dryRun: boolean) {
    setState({ kind: "busy", label: dryRun ? "Memeriksa…" : "Menyimpan…" });
    const result = await importRefereesAction(text, dryRun).catch(() => null);
    if (!result) return setState({ kind: "error", message: "Gagal menghubungi server. Coba lagi." });
    if (!result.ok) return setState({ kind: "error", message: result.error });
    if (result.simulated) return setState({ kind: "simulated" });
    setState({ kind: result.saved ? "saved" : "checked", preview: result });
    if (result.saved) router.refresh();
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BYTES) return setState({ kind: "error", message: "Berkas terlalu besar (maks. 2 MB)." });
    if (/\.xls$/i.test(f.name)) {
      return setState({ kind: "error", message: 'Format .xls (Excel lama) belum didukung. Simpan ulang sebagai "Excel Workbook (.xlsx)" atau CSV.' });
    }
    let text: string;
    if (isXlsx(f.name)) {
      setState({ kind: "busy", label: "Membaca Excel…" });
      try {
        text = await xlsxToCsv(f);
      } catch {
        return setState({ kind: "error", message: "Berkas Excel tidak bisa dibaca. Pastikan formatnya .xlsx dan tidak dikunci kata sandi." });
      }
    } else {
      text = await f.text();
    }
    setFile({ name: f.name, text });
    await run(text, true);
  }

  const preview = state.kind === "checked" || state.kind === "saved" ? state.preview : null;
  const canSave = state.kind === "checked" && preview!.errors.length === 0 && preview!.summary.filled > 0;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setFile(null);
          setState({ kind: "idle" });
          setOpen(true);
        }}
      >
        <UserCheckIcon /> Impor nama pengawas
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Impor nama pengawas per laga</DialogTitle>
            <DialogDescription>
              Unduh daftar laga, isi kolom <b>Pengawas</b> di Excel/Google Sheets, lalu unggah kembali (.xlsx atau .csv). Sel
              pengawas yang kosong dilewati — nama yang sudah ada tidak dihapus. Nama pengawas hanya terlihat oleh admin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-sm">
            <a href="/api/admin/referees/export" download className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}>
              <DownloadIcon /> Unduh daftar laga (semua sesi &amp; ruangan)
            </a>

            <label
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-5 text-center hover:bg-muted/50",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <UploadIcon className="size-5 text-muted-foreground" />
              <span className="font-medium">{file ? file.name : "Pilih berkas .xlsx atau .csv"}</span>
              <span className="text-xs text-muted-foreground">
                {file ? "Klik untuk ganti berkas" : "Kolom: ID laga (atau Sesi, Ruangan, Babak, Laga) dan Pengawas"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>

            {state.kind === "busy" && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> {state.label}
              </p>
            )}
            {state.kind === "error" && <p className="text-destructive">{state.message}</p>}
            {state.kind === "simulated" && <p className="text-muted-foreground">Mode simulasi: tidak ada yang disimpan.</p>}

            {preview && (
              <>
                <p className={cn("flex items-center gap-1.5 font-medium", state.kind === "saved" && "text-emerald-700 dark:text-emerald-400")}>
                  {state.kind === "saved" ? <CheckCircle2Icon className="size-4" /> : null}
                  {state.kind === "saved"
                    ? `${preview.summary.filled} nama pengawas tersimpan.`
                    : `${preview.summary.filled} laga siap diisi nama pengawas`}
                  {state.kind !== "saved" && preview.summary.errors > 0 && `, ${preview.summary.errors} baris bermasalah`}
                  {state.kind !== "saved" && preview.summary.skipped > 0 && ` · ${preview.summary.skipped} baris tanpa nama dilewati`}
                  {state.kind !== "saved" && "."}
                </p>
                {preview.errors.length > 0 && (
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs">
                    {preview.errors.slice(0, 50).map((e) => (
                      <li key={e.line} className="flex gap-1.5">
                        <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        Baris {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                {preview.entries.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 font-medium">Baris</th>
                          <th className="px-2 py-1 font-medium">Laga</th>
                          <th className="px-2 py-1 font-medium">Pengawas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.entries.slice(0, 100).map((e) => (
                          <tr key={e.line}>
                            <td className="px-2 py-1 tabular-nums text-muted-foreground">{e.line}</td>
                            <td className="px-2 py-1">{e.label}</td>
                            <td className="px-2 py-1 font-medium">{e.refereeName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {state.kind === "saved" ? "Tutup" : "Batal"}
            </Button>
            {state.kind !== "saved" && (
              <Button onClick={() => file && run(file.text, false)} disabled={!canSave || busy}>
                Simpan nama pengawas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
