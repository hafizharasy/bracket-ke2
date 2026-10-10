"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createRoomAction, createSessionAction, deleteRoomAction, saveSessionRoomsAction } from "@/app/admin/ruangan/actions";
import { Button } from "@/components/ui/button";
import { PLAYERS_PER_ROOM } from "@/lib/bracket";
import type { Room } from "@/lib/types";
import { cn } from "@/lib/utils";

type Feedback = { ok: boolean; text: string } | null;
type ActionResult = { ok: true; simulated: boolean; note?: string } | { ok: false; error: string };

const input = "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function feedbackOf(result: ActionResult, done: string): Feedback {
  if (!result.ok) return { ok: false, text: result.error };
  if (result.simulated) return { ok: true, text: "Mode simulasi: perubahan tidak disimpan." };
  return { ok: true, text: result.note ?? done };
}

function Message({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p aria-live="polite" className={cn("text-xs", feedback.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
      {feedback.text}
    </p>
  );
}

/**
 * Pilih ruangan yang dipakai satu sesi. Tiap ruangan aktif = satu bagan
 * {PLAYERS_PER_ROOM} peserta. `counts` = jumlah peserta sesi ini per ruangan.
 */
export function SessionRoomsEditor({
  sessionId,
  rooms,
  active,
  counts,
  locked,
}: {
  sessionId: string;
  rooms: Room[];
  active: string[];
  counts: Record<string, number>;
  locked: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(active));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const dirty = selected.size !== active.length || active.some((id) => !selected.has(id));

  function toggle(id: string) {
    setFeedback(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    const result = await saveSessionRoomsAction(sessionId, [...selected]);
    setBusy(false);
    setFeedback(feedbackOf(result, `Tersimpan: ${selected.size} ruangan dipakai.`));
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ruangan yang dipakai">
        {rooms.map((r) => {
          const on = selected.has(r.id);
          const n = counts[r.id] ?? 0;
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              disabled={locked || busy}
              onClick={() => toggle(r.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-60",
                on ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
              title={n ? `${n} peserta di sesi ini` : undefined}
            >
              {r.name}
              {on && (
                <span className={cn("ml-1 tabular-nums", n === PLAYERS_PER_ROOM ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                  {n}/{PLAYERS_PER_ROOM}
                </span>
              )}
            </button>
          );
        })}
        {rooms.length === 0 && <span className="text-xs text-muted-foreground">Tambahkan ruangan dulu di bawah.</span>}
      </div>
      {dirty && !locked && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy && <Loader2Icon className="animate-spin" />}
            Simpan ({selected.size} ruangan)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setSelected(new Set(active)); setFeedback(null); }} disabled={busy}>
            Batal
          </Button>
        </div>
      )}
      <Message feedback={feedback} />
    </div>
  );
}

/** Form tambah ruangan ke daftar ruangan bersama. */
export function AddRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createRoomAction({ name: name.trim(), location: location.trim() });
    setBusy(false);
    setFeedback(feedbackOf(result, `${name.trim()} ditambahkan. Centang di sesi yang memakainya.`));
    if (result.ok) {
      setName("");
      setLocation("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5 rounded-xl border border-dashed p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Nama ruangan baru</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="mis. Ruangan 11" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Lokasi <span className="font-normal text-muted-foreground">(opsional)</span></span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="mis. Gedung B · Lantai 2" className={input} />
        </label>
        <Button type="submit" size="sm" disabled={busy || name.trim().length < 2}>
          {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          Tambah ruangan
        </Button>
      </div>
      <Message feedback={feedback} />
    </form>
  );
}

/** Tombol hapus ruangan (ditolak server bila masih dipakai). */
export function DeleteRoomButton({ room, disabled }: { room: Room; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onClick() {
    if (!confirm(`Hapus ${room.name}? Ruangan juga dilepas dari semua sesi.`)) return;
    setBusy(true);
    const result = await deleteRoomAction(room.id);
    setBusy(false);
    setFeedback(feedbackOf(result, "Dihapus."));
    if (result.ok) router.refresh();
  }

  return (
    <span className="flex flex-col items-end">
      <Button variant="ghost" size="sm" onClick={onClick} disabled={busy || disabled} aria-label={`Hapus ${room.name}`}>
        {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
        Hapus
      </Button>
      <Message feedback={feedback} />
    </span>
  );
}

const fromWibLocal = (local: string) => (local ? new Date(`${local}:00+07:00`).toISOString() : "");

/** Form tambah sesi di akhir urutan. */
export function AddSessionForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createSessionAction({ name: name.trim(), startTime: fromWibLocal(start) });
    setBusy(false);
    setFeedback(feedbackOf(result, `${name.trim()} ditambahkan. Pilih ruangannya.`));
    if (result.ok) {
      setName("");
      setStart("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5 rounded-xl border border-dashed p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Nama sesi baru</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="mis. Sesi 5" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Jam mulai (WIB)</span>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </label>
        <Button type="submit" size="sm" disabled={busy || name.trim().length < 2 || !start}>
          {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          Tambah sesi
        </Button>
      </div>
      <Message feedback={feedback} />
    </form>
  );
}
