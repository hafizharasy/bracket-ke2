"use client";

import { DicesIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { clearResultsAction, simulateAction, type SimulationActionResult } from "@/app/admin/simulasi/actions";
import { Button } from "@/components/ui/button";
import type { SimulationStage } from "@/server/simulation";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };
type Feedback = { ok: boolean; text: string } | null;

const select = "h-9 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Message({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p aria-live="polite" className={cn("text-sm", feedback.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
      {feedback.text}
    </p>
  );
}

const toFeedback = (r: SimulationActionResult): Feedback => (r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });

/** Form isi hasil acak per cakupan. */
export function SimulateForm({ sessions, roomsBySession }: { sessions: Option[]; roomsBySession: Record<string, Option[]> }) {
  const router = useRouter();
  const [stage, setStage] = useState<SimulationStage>("ruangan");
  const [sessionId, setSessionId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const rooms = sessionId ? (roomsBySession[sessionId] ?? []) : [];

  async function submit() {
    setBusy(true);
    setFeedback(null);
    const result = await simulateAction({
      stage,
      sessionId: stage === "ruangan" && sessionId ? sessionId : null,
      roomId: stage === "ruangan" && roomId ? roomId : null,
    }).catch(() => ({ ok: false as const, error: "Gagal menghubungi server." }));
    setBusy(false);
    setFeedback(toFeedback(result));
    if (result.ok) router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <DicesIcon className="size-5 text-primary" aria-hidden />
        <h2 className="font-semibold">Isi hasil acak</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Mengisi laga yang belum selesai dengan hasil acak sesuai aturan: skor acak di babak ruangan, best of 3 di semifinal,
        jenis kemenangan & poin di final. Pemenang otomatis maju. Laga yang pesertanya belum lengkap dilewati.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Tahap</span>
          <select value={stage} onChange={(e) => setStage(e.target.value as SimulationStage)} className={select} disabled={busy}>
            <option value="ruangan">Babak ruangan (64 → juara ruangan)</option>
            <option value="semifinal">Semifinal</option>
            <option value="final">Final round-robin</option>
            <option value="semua">Semua sampai juara</option>
          </select>
        </label>
        {stage === "ruangan" && (
          <>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Sesi</span>
              <select
                value={sessionId}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  setRoomId("");
                }}
                className={select}
                disabled={busy}
              >
                <option value="">Semua sesi</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Ruangan</span>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={select} disabled={busy || !sessionId}>
                <option value="">Semua ruangan</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <DicesIcon />}
          Isi hasil acak
        </Button>
      </div>
      <Message feedback={feedback} />
    </section>
  );
}

/** Hapus semua hasil dengan konfirmasi ketik "HAPUS". */
export function ClearResultsForm() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [withViolations, setWithViolations] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit() {
    setBusy(true);
    setFeedback(null);
    const result = await clearResultsAction({ violations: withViolations, confirm }).catch(() => ({
      ok: false as const,
      error: "Gagal menghubungi server.",
    }));
    setBusy(false);
    setFeedback(toFeedback(result));
    if (result.ok) {
      setConfirm("");
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-card p-4">
      <div className="flex items-center gap-2">
        <RotateCcwIcon className="size-5 text-destructive" aria-hidden />
        <h2 className="font-semibold">Hapus semua hasil</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Semua laga kembali ke <b>terjadwal</b> tanpa skor & pemenang; babak 2 ke atas dikosongkan lagi. Peserta, sesi, ruangan,
        struktur bagan, pasangan babak 1 & semifinal, akun, dan nama pengawas <b>tetap</b>. Database dicadangkan otomatis ke{" "}
        <code>/app/data/cadangan/</code> sebelum dihapus.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withViolations} onChange={(e) => setWithViolations(e.target.checked)} disabled={busy} />
        Hapus juga semua catatan pelanggaran
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Ketik HAPUS untuk konfirmasi</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={select} placeholder="HAPUS" disabled={busy} />
        </label>
        <Button variant="destructive" onClick={submit} disabled={busy || confirm.trim().toUpperCase() !== "HAPUS"}>
          {busy && <Loader2Icon className="animate-spin" />}
          Hapus semua hasil
        </Button>
      </div>
      <Message feedback={feedback} />
    </section>
  );
}
