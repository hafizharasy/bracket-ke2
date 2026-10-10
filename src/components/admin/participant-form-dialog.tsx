"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ParticipantFormValues, saveParticipant, validateParticipant } from "@/lib/admin-client";
import type { Participant, Room, Session, SessionRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

const empty: ParticipantFormValues = { name: "", teamOrClub: "", sessionId: "", roomId: "" };

/**
 * Dialog tambah/ubah peserta. Mode ubah bila `participant` diisi.
 * `trigger` = elemen yang membuka dialog (default tombol "Tambah peserta").
 */
export function ParticipantFormDialog({
  participant,
  sessions,
  rooms,
  sessionRooms,
  open: controlledOpen,
  onOpenChange,
  showTrigger = !participant,
}: {
  participant?: Participant;
  sessions: Session[];
  rooms: Room[];
  /** Ruangan aktif per sesi; bila diisi, pilihan ruangan dibatasi ke sesi terpilih. */
  sessionRooms?: SessionRoom[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInternalOpen(v));

  const initial: ParticipantFormValues = participant
    ? {
        name: participant.name,
        teamOrClub: participant.teamOrClub ?? "",
        sessionId: participant.sessionId ?? "",
        roomId: participant.roomId ?? "",
      }
    : empty;
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const errors = validateParticipant(values);
  const hasErrors = Object.keys(errors).length > 0;

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValues(initial);
      setTouched(false);
      setMessage(null);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    const result = await saveParticipant(participant?.id ?? null, {
      ...values,
      name: values.name.trim(),
      teamOrClub: values.teamOrClub.trim(),
    });
    setSaving(false);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    setMessage({
      ok: true,
      text: `${participant ? "Perubahan" : "Peserta"} tersimpan${result.simulated ? " (mode simulasi)" : ""}.`,
    });
    router.refresh();
    if (!participant) {
      setValues(empty);
      setTouched(false);
    }
  }

  const field = (key: keyof ParticipantFormValues) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setMessage(null);
    },
    "aria-invalid": touched && !!errors[key],
  });
  const inputClass =
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive";

  return (
    <>
      {showTrigger && (
        <Button onClick={() => reset(true)}>
          <PlusIcon /> Tambah peserta
        </Button>
      )}
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{participant ? "Ubah peserta" : "Tambah peserta"}</DialogTitle>
              <DialogDescription>
                {participant ? `ID ${participant.id.toUpperCase()}` : "Sesi & ruangan bisa diatur sekarang atau nanti."}
              </DialogDescription>
            </DialogHeader>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nama peserta</span>
              <input {...field("name")} autoFocus maxLength={100} className={inputClass} placeholder="Nama lengkap" />
              {touched && errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Asal sekolah <span className="font-normal text-muted-foreground">(opsional)</span>
              </span>
              <input {...field("teamOrClub")} maxLength={100} className={inputClass} placeholder="mis. SMAN 3 Bandung" />
              {touched && errors.teamOrClub && <span className="text-xs text-destructive">{errors.teamOrClub}</span>}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Sesi</span>
                <select {...field("sessionId")} className={inputClass}>
                  <option value="">— Belum —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {touched && errors.sessionId && <span className="text-xs text-destructive">{errors.sessionId}</span>}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Ruangan</span>
                <select {...field("roomId")} className={inputClass}>
                  <option value="">— Belum —</option>
                  {rooms
                    .filter(
                      (r) =>
                        !sessionRooms ||
                        !values.sessionId ||
                        r.id === values.roomId ||
                        sessionRooms.some((c) => c.sessionId === values.sessionId && c.roomId === r.id),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
              </label>
            </div>

            {message && (
              <p aria-live="polite" className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                {message.text}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => reset(false)}>
                Tutup
              </Button>
              <Button type="submit" disabled={saving || (touched && hasErrors)}>
                {saving && <Loader2Icon className="animate-spin" />}
                {participant ? "Simpan perubahan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
