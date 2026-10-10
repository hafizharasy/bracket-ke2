"use client";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveRoom, saveSession } from "@/lib/admin-client";
import type { Room, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DDTHH:mm" (WIB) untuk input datetime-local dari ISO. */
function toWibLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
}
const fromWibLocal = (local: string) => (local ? new Date(`${local}:00+07:00`).toISOString() : "");

type Props =
  | { kind: "room"; item: Room }
  | { kind: "session"; item: Session };

/** Tombol + dialog ubah ruangan (nama, lokasi) atau sesi (nama, jam mulai WIB). */
export function EntityEditButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.item.name);
  const [extra, setExtra] = useState(props.kind === "room" ? props.item.location ?? "" : toWibLocal(props.item.startTime));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const nameError = name.trim().length < 2 ? "Nama minimal 2 karakter." : name.trim().length > 50 ? "Maksimal 50 karakter." : null;
  const extraError = props.kind === "session" && !extra ? "Isi jam mulai sesi." : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nameError || extraError) return;
    setSaving(true);
    const result =
      props.kind === "room"
        ? await saveRoom(props.item.id, { name: name.trim(), location: extra.trim() })
        : await saveSession(props.item.id, { name: name.trim(), startTime: fromWibLocal(extra) });
    setSaving(false);
    setMessage(result.ok ? { ok: true, text: `Tersimpan${result.simulated ? " (mode simulasi)" : ""}.` } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
  }

  const input = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(true); setMessage(null); }} aria-label={`Ubah ${props.item.name}`}>
        <PencilIcon /> Ubah
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Ubah {props.kind === "room" ? "ruangan" : "sesi"}</DialogTitle>
              <DialogDescription>ID {props.item.id}</DialogDescription>
            </DialogHeader>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nama</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
              {nameError && <span className="text-xs text-destructive">{nameError}</span>}
            </label>
            {props.kind === "room" ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Lokasi <span className="font-normal text-muted-foreground">(opsional)</span></span>
                <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={100} placeholder="mis. Gedung A · Lantai 1" className={input} />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Jam mulai (WIB)</span>
                <input type="datetime-local" value={extra} onChange={(e) => setExtra(e.target.value)} className={input} />
                {extraError && <span className="text-xs text-destructive">{extraError}</span>}
              </label>
            )}
            {message && (
              <p aria-live="polite" className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>{message.text}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
              <Button type="submit" disabled={saving || !!nameError || !!extraError}>
                {saving && <Loader2Icon className="animate-spin" />} Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
