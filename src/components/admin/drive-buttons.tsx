"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { disconnectDriveAction, type DriveActionResult, retryDriveAction, syncExistingDriveAction } from "@/app/admin/drive/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIONS = {
  retry: { label: "Kirim ulang yang gagal", run: retryDriveAction, variant: "default" as const },
  sync: { label: "Kirim foto yang belum terkirim", run: syncExistingDriveAction, variant: "outline" as const },
  disconnect: { label: "Putuskan koneksi", run: disconnectDriveAction, variant: "ghost" as const },
};

/** Tombol aksi Google Drive di halaman admin. */
export function DriveButtons({ show }: { show: (keyof typeof ACTIONS)[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<DriveActionResult | null>(null);

  async function run(key: keyof typeof ACTIONS) {
    if (key === "disconnect" && !confirm("Putuskan koneksi Google Drive? Foto yang sudah tersalin tetap ada di Drive Anda. Saat dihubungkan lagi, dibuat folder baru dan semua foto bukti dikirim ulang ke sana.")) return;
    setBusy(key);
    const r = await ACTIONS[key].run().catch(() => ({ ok: false as const, error: "Gagal menghubungi server." }));
    setBusy(null);
    setResult(r);
    router.refresh();
    // Muat ulang lagi sebentar kemudian untuk menampilkan progres antrean.
    setTimeout(() => router.refresh(), 4000);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {show.map((key) => (
          <Button key={key} variant={ACTIONS[key].variant} size="sm" onClick={() => run(key)} disabled={!!busy}>
            {busy === key && <Loader2Icon className="animate-spin" />}
            {ACTIONS[key].label}
          </Button>
        ))}
      </div>
      {result && (
        <p aria-live="polite" className={cn("text-sm", result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
