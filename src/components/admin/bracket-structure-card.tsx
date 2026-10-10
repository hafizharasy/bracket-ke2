"use client";

import { Loader2Icon, LockIcon, NetworkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { generateBracketAction } from "@/app/admin/peserta/actions";
import { Button } from "@/components/ui/button";

/**
 * Status & tombol pembuatan struktur bagan (laga babak ruangan + final) dari
 * penempatan peserta. Susun ulang hanya selama belum ada laga dimulai.
 */
export function BracketStructureCard({ total, started, placementReady }: { total: number; started: boolean; placementReady: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; problems?: string[] } | null>(null);

  async function generate() {
    const replace = total > 0;
    if (replace && !confirm("Susun ulang struktur bagan? Pasangan babak 1 yang sudah diatur akan dibuat ulang.")) return;
    setBusy(true);
    const result = await generateBracketAction(replace);
    setBusy(false);
    setMessage(
      result.ok
        ? { ok: true, text: result.simulated ? "Selesai (mode simulasi)." : (result.summary ?? "Selesai.") }
        : { ok: false, text: result.error, problems: result.problems },
    );
    if (result.ok) router.refresh();
  }

  return (
    <section aria-label="Struktur bagan" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <NetworkIcon className="size-5 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Struktur bagan</h2>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${total} laga sudah dibuat. Atur pasangan babak 1 di tab Pasangan Tanding.`
              : "Belum ada laga. Buat setelah semua peserta ditempatkan (16 per ruangan per sesi) dan jam sesi terisi."}
          </p>
        </div>
        {started ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LockIcon className="size-4" /> Terkunci (laga sudah dimulai)
          </span>
        ) : (
          <Button variant={total > 0 ? "outline" : "default"} onClick={generate} disabled={busy || (total === 0 && !placementReady)}>
            {busy && <Loader2Icon className="animate-spin" />}
            {total > 0 ? "Susun ulang" : "Buat struktur bagan"}
          </Button>
        )}
      </div>
      {message && (
        <div aria-live="polite" className={message.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>
          {message.text}
          {message.problems && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {message.problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {message.problems.length > 8 && <li>… dan {message.problems.length - 8} lainnya</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
