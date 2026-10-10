"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { ParticipantFormDialog } from "@/components/admin/participant-form-dialog";
import { Button } from "@/components/ui/button";
import type { Participant, Room, Session } from "@/lib/types";

/** Tombol "Ubah" per baris tabel peserta, membuka dialog ubah. */
export function ParticipantEditButton({
  participant,
  sessions,
  rooms,
}: {
  participant: Participant;
  sessions: Session[];
  rooms: Room[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Ubah ${participant.name}`}>
        <PencilIcon /> Ubah
      </Button>
      {open && (
        <ParticipantFormDialog
          participant={participant}
          sessions={sessions}
          rooms={rooms}
          open={open}
          onOpenChange={setOpen}
          showTrigger={false}
        />
      )}
    </>
  );
}
