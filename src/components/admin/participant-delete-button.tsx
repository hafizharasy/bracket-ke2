"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteParticipantAction } from "@/app/admin/peserta/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Participant } from "@/lib/types";

/** Tombol "Hapus" per baris tabel peserta, dengan konfirmasi. */
export function ParticipantDeleteButton({ participant }: { participant: Participant }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await deleteParticipantAction(participant.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`Hapus ${participant.name}`}
      >
        <Trash2Icon /> Hapus
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus {participant.name}?</DialogTitle>
            <DialogDescription>
              {participant.id.toUpperCase()}
              {participant.teamOrClub && ` · ${participant.teamOrClub}`}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Nama peserta dihapus permanen, termasuk catatan pelanggarannya.</li>
            <li>
              Bila sudah ada di bagan, slotnya di laga babak 1 menjadi <b>kosong</b>. Isi dengan peserta pengganti di{" "}
              <b>Pasangan Tanding</b>; selama kosong, laga itu tidak bisa diinput.
            </li>
            <li>Peserta yang sudah bertanding tidak bisa dihapus — batalkan hasil laganya dulu.</li>
          </ul>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} Hapus peserta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
