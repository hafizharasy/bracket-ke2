"use client";

import { AlertTriangleIcon, CheckCircle2Icon, DownloadIcon, FileUpIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type ImportPreview, importParticipantsAction } from "@/app/admin/peserta/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1_000_000;
const TEMPLATE = "nama,sekolah,sesi,ruangan\nBudi Santoso,SMAN 3 Bandung,Sesi 1,Ruangan 1\nAni Lestari,SMAN 1 Jakarta,Sesi 1,Ruangan 2\nCitra Dewi,,2,1\n";

/** Unduh templat CSV yang dibuat di browser. */
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "templat-peserta.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type State =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "checked"; preview: ImportPreview }
  | { kind: "saved"; preview: ImportPreview }
  | { kind: "simulated" }
  | { kind: "error"; message: string };

/**
 * Tombol + dialog unggah CSV peserta: pilih berkas → diperiksa server
 * (baris bermasalah, kapasitas 64 per ruangan-sesi) → simpan.
 */
export function CsvImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [replace, setReplace] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "busy";

  function reset() {
    setFile(null);
    setReplace(false);
    setState({ kind: "idle" });
  }

  async function run(text: string, dryRun: boolean, replaceAll = replace) {
    setState({ kind: "busy", label: dryRun ? "Memeriksa…" : "Menyimpan…" });
    const result = await importParticipantsAction(text, { replace: replaceAll, dryRun }).catch(() => null);
    if (!result) return setState({ kind: "error", message: "Gagal menghubungi server. Coba lagi." });
    if (!result.ok) return setState({ kind: "error", message: result.error });
    if (result.simulated) return setState({ kind: "simulated" });
    const preview = { saved: result.saved!, errors: result.errors!, summary: result.summary! } as ImportPreview;
    setState({ kind: preview.saved ? "saved" : "checked", preview });
    if (preview.saved) router.refresh();
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BYTES) return setState({ kind: "error", message: "Berkas terlalu besar (maks. 1 MB)." });
    const text = await f.text();
    setFile({ name: f.name, text });
    await run(text, true);
  }

  const preview = state.kind === "checked" || state.kind === "saved" ? state.preview : null;
  const canSave = state.kind === "checked" && preview!.errors.length === 0 && preview!.summary.valid > 0;

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true); }}>
        <FileUpIcon /> Unggah CSV
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Unggah peserta dari CSV</DialogTitle>
            <DialogDescription>
              Kolom: <code>nama</code> (wajib), <code>sekolah</code>, <code>sesi</code>, <code>ruangan</code>. Sesi/ruangan boleh
              ditulis &quot;Sesi 1&quot; / &quot;Ruangan 2&quot; atau angkanya saja, dan boleh kosong (dibagi otomatis nanti). Bisa
              disimpan dari Excel/Google Sheets sebagai CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-sm">
            <Button variant="ghost" size="sm" className="self-start" onClick={downloadTemplate}>
              <DownloadIcon /> Unduh templat CSV
            </Button>

            <label
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-5 text-center hover:bg-muted/50",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <UploadIcon className="size-5 text-muted-foreground" />
              <span className="font-medium">{file ? file.name : "Pilih berkas .csv"}</span>
              <span className="text-xs text-muted-foreground">{file ? "Klik untuk ganti berkas" : "Maks. 1 MB"}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={replace}
                disabled={busy || state.kind === "saved"}
                onChange={(e) => {
                  setReplace(e.target.checked);
                  if (file) void run(file.text, true, e.target.checked);
                }}
              />
              <span>
                Ganti semua peserta lama
                <span className="block text-xs text-muted-foreground">
                  Peserta lama dan struktur bagan dihapus dulu (hanya bila belum ada laga dimulai). Tanpa centang, peserta
                  ditambahkan ke data yang ada.
                </span>
              </span>
            </label>

            {state.kind === "busy" && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> {state.label}
              </p>
            )}
            {state.kind === "error" && <p className="text-destructive">{state.message}</p>}
            {state.kind === "simulated" && <p className="text-muted-foreground">Mode simulasi: data tidak disimpan.</p>}

            {preview && (
              <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
                {state.kind === "saved" ? (
                  <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-4" /> {preview.summary.valid} peserta tersimpan.
                  </p>
                ) : (
                  <p className="font-medium">
                    {preview.summary.valid} peserta siap diimpor
                    {preview.errors.length > 0 && `, ${preview.errors.length} masalah`}
                    {!replace && preview.summary.existing > 0 && ` (sudah ada ${preview.summary.existing} peserta)`}.
                  </p>
                )}
                {(preview.summary.withoutSession > 0 || preview.summary.withoutRoom > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {preview.summary.withoutSession} tanpa sesi, {preview.summary.withoutRoom} tanpa ruangan — bisa dibagi otomatis di
                    tab Pembagian Sesi / Penempatan Ruangan.
                  </p>
                )}
                {preview.errors.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    {preview.errors.slice(0, 100).map((e, i) => (
                      <li key={i} className="flex gap-1.5">
                        <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                        {e.line ? `Baris ${e.line}: ` : ""}
                        {e.message}
                      </li>
                    ))}
                    {preview.errors.length > 100 && <li>…dan {preview.errors.length - 100} lainnya.</li>}
                  </ul>
                )}
                {preview.summary.cells.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-xs">
                    {preview.summary.cells.map((c) => (
                      <span key={`${c.session}-${c.room}`} className={cn("rounded border px-1.5 py-0.5 tabular-nums", c.count > 64 && "border-destructive text-destructive")}>
                        {c.session} · {c.room}: {c.count}
                      </span>
                    ))}
                  </div>
                )}
                {state.kind === "checked" && preview.summary.preview.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 text-left font-medium">Baris</th>
                        <th className="text-left font-medium">Nama</th>
                        <th className="text-left font-medium">Sekolah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.summary.preview.map((r) => (
                        <tr key={r.line} className="border-t">
                          <td className="py-1 tabular-nums text-muted-foreground">{r.line}</td>
                          <td>{r.name}</td>
                          <td className="text-muted-foreground">{r.teamOrClub ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Tutup
            </Button>
            {state.kind !== "saved" && (
              <Button onClick={() => file && run(file.text, false)} disabled={!canSave || busy}>
                {busy && <Loader2Icon className="animate-spin" />}
                {replace ? "Ganti & simpan" : "Simpan"} {preview?.summary.valid ?? 0} peserta
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
