"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import { type ProofPhoto, ProofPhotoInput } from "@/components/ruangan/proof-photo-input";
import { ScoreStepper } from "@/components/ruangan/score-stepper";
import { Button } from "@/components/ui/button";
import { submitMatchResult } from "@/lib/results-client";
import type { Match, Participant } from "@/lib/types";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; simulated: boolean } | { kind: "error"; message: string };

/** Form input hasil laga oleh pengawas: skor kedua peserta. */
export function ResultForm({
  match,
  participantA,
  participantB,
}: {
  match: Match;
  participantA: Participant;
  participantB: Participant;
}) {
  const [scoreA, setScoreA] = useState(match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.scoreB ?? 0);
  const [photo, setPhoto] = useState<ProofPhoto | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saving = status.kind === "saving";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!photo) {
      setStatus({ kind: "error", message: "Unggah foto bukti terlebih dahulu." });
      return;
    }
    setStatus({ kind: "saving" });
    const result = await submitMatchResult(match.id, { scoreA, scoreB, proofPhotoUrl: photo.url });
    setStatus(result.ok ? { kind: "saved", simulated: result.simulated } : { kind: "error", message: result.error });
  }

  const sides = [
    { key: "a", participant: participantA, score: scoreA, setScore: setScoreA },
    { key: "b", participant: participantB, score: scoreB, setScore: setScoreB },
  ] as const;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3" disabled={saving}>
        <legend className="mb-2 text-sm font-semibold">Skor akhir</legend>
        {sides.map(({ key, participant, score, setScore }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
          >
            <label htmlFor={`score-${key}`} className="min-w-0 flex-1">
              <span className="block truncate font-medium">{participant.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {participant.teamOrClub ?? "Tanpa klub"} · {participant.id.toUpperCase()}
              </span>
            </label>
            <ScoreStepper
              id={`score-${key}`}
              label={participant.name}
              value={score}
              onChange={(v) => {
                setScore(v);
                if (status.kind !== "saving") setStatus({ kind: "idle" });
              }}
            />
          </div>
        ))}
      </fieldset>

      <ProofPhotoInput matchId={match.id} onChange={setPhoto} disabled={saving} />

      <Button type="submit" size="lg" className="h-12 text-base" disabled={saving || !photo}>
        {saving && <Loader2Icon className="animate-spin" />}
        {match.status === "done" ? "Simpan koreksi hasil" : "Simpan hasil"}
      </Button>

      <div aria-live="polite" className="min-h-5 text-sm">
        {status.kind === "saved" && (
          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2Icon className="size-4" />
            Hasil {scoreA}–{scoreB} tersimpan{status.simulated ? " (mode simulasi)" : ""}.
          </p>
        )}
        {status.kind === "error" && <p className="text-destructive">{status.message}</p>}
      </div>
    </form>
  );
}
