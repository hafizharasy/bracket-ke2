"use client";

import { ArrowRightIcon, CheckCircle2Icon, Loader2Icon, TrophyIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type ProofPhoto, ProofPhotoInput } from "@/components/ruangan/proof-photo-input";
import { SessionExpiredNotice } from "@/components/auth/session-expired-notice";
import { ScoreStepper } from "@/components/ruangan/score-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submitMatchResult } from "@/lib/results-client";
import type { Match, MatchStatus, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Ke mana pemenang laga ini maju (dihitung di server). */
export type NextPreview =
  | {
      kind: "match";
      label: string;
      roomName: string | null;
      time: string | null;
      status: MatchStatus;
      /** Lawan di laga berikutnya: nama peserta atau asal slotnya. */
      opponent: string;
      opponentKnown: boolean;
    }
  | { kind: "final-stage" }
  | { kind: "champion" };

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; simulated: boolean }
  | { kind: "error"; message: string; expired?: boolean };

/** Form input hasil laga oleh pengawas: skor, pemenang, foto bukti. */
export function ResultForm({
  match,
  participantA,
  participantB,
  next,
}: {
  match: Match;
  participantA: Participant;
  participantB: Participant;
  next: NextPreview;
}) {
  const [scoreA, setScoreA] = useState(match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.scoreB ?? 0);
  // Pemenang pilihan manual, hanya dipakai saat skor seri.
  const [tieWinnerId, setTieWinnerId] = useState<string | null>(
    match.scoreA !== null && match.scoreA === match.scoreB ? match.winnerId : null,
  );
  const [photo, setPhoto] = useState<ProofPhoto | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saving = status.kind === "saving";
  const router = useRouter();

  const isTie = scoreA === scoreB;
  const winnerId = isTie ? tieWinnerId : scoreA > scoreB ? participantA.id : participantB.id;
  const winner = winnerId === participantA.id ? participantA : winnerId === participantB.id ? participantB : null;

  // Koreksi yang mengganti pemenang ditolak server bila laga berikutnya sudah dimulai.
  const lockedWinner =
    match.status === "done" && next.kind === "match" && next.status !== "scheduled" ? match.winnerId : null;
  const winnerChangeBlocked = !!lockedWinner && !!winnerId && winnerId !== lockedWinner;

  const touch = () => status.kind !== "saving" && setStatus({ kind: "idle" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!winnerId) return setStatus({ kind: "error", message: "Skor seri: pilih pemenangnya." });
    if (!photo) return setStatus({ kind: "error", message: "Unggah foto bukti terlebih dahulu." });
    setStatus({ kind: "saving" });
    const result = await submitMatchResult(match.id, {
      scoreA,
      scoreB,
      winnerId: isTie ? winnerId : undefined,
      proofPhotoUrl: photo.url,
    });
    setStatus(
      result.ok
        ? { kind: "saved", simulated: result.simulated }
        : { kind: "error", message: result.error, expired: result.code === "SESSION_EXPIRED" },
    );
    // Muat ulang data halaman (status laga, babak lanjut) dari server.
    if (result.ok) router.refresh();
  }

  const sides = [
    { key: "a", participant: participantA, score: scoreA, setScore: setScoreA },
    { key: "b", participant: participantB, score: scoreB, setScore: setScoreB },
  ] as const;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-3" disabled={saving}>
        <legend className="mb-2 text-sm font-semibold">Skor akhir</legend>
        {sides.map(({ key, participant, score, setScore }) => {
          const isWinner = winnerId === participant.id;
          return (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors",
                isWinner && "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/40",
              )}
            >
              <label htmlFor={`score-${key}`} className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate font-medium">{participant.name}</span>
                  {isWinner && (
                    <Badge className="shrink-0 bg-emerald-600 text-white">
                      <TrophyIcon data-icon="inline-start" />
                      Menang
                    </Badge>
                  )}
                </span>
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
                  touch();
                }}
              />
            </div>
          );
        })}

        {isTie && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-500/50 bg-amber-500/5 p-3">
            <p className="text-sm font-medium">Skor seri — pilih pemenang (mis. dari aturan tambahan):</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pemenang">
              {[participantA, participantB].map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border bg-background p-2 text-sm",
                    tieWinnerId === p.id && "border-emerald-500 ring-1 ring-emerald-500/40",
                  )}
                >
                  <input
                    type="radio"
                    name="tie-winner"
                    value={p.id}
                    checked={tieWinnerId === p.id}
                    onChange={() => {
                      setTieWinnerId(p.id);
                      touch();
                    }}
                    className="accent-emerald-600"
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <AdvancePreview next={next} winner={winner} />

      {winnerChangeBlocked && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          Laga berikutnya sudah dimulai, jadi pemenang tidak bisa diganti. Koreksi hanya boleh
          mengubah skor dengan pemenang yang sama.
        </p>
      )}

      <ProofPhotoInput matchId={match.id} onChange={setPhoto} disabled={saving} />

      <Button
        type="submit"
        size="lg"
        className="h-12 text-base"
        disabled={saving || !photo || !winnerId || winnerChangeBlocked}
      >
        {saving && <Loader2Icon className="animate-spin" />}
        {match.status === "done" ? "Simpan koreksi hasil" : "Simpan hasil"}
      </Button>

      <div aria-live="polite" className="min-h-5 text-sm">
        {status.kind === "saved" && (
          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2Icon className="size-4" />
            Hasil {scoreA}–{scoreB} tersimpan, {winner?.name} menang
            {status.simulated ? " (mode simulasi)" : ""}.
          </p>
        )}
        {status.kind === "error" &&
          (status.expired ? <SessionExpiredNotice message={status.message} /> : <p className="text-destructive">{status.message}</p>)}
      </div>
    </form>
  );
}

/** Pratinjau: pemenang akan mengisi laga mana di babak berikutnya. */
function AdvancePreview({ next, winner }: { next: NextPreview; winner: Participant | null }) {
  const who = winner?.name ?? "Pemenang";
  return (
    <section aria-label="Pratinjau babak lanjut" className="flex flex-col gap-1.5 rounded-xl border bg-muted/40 p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Babak lanjut
      </span>
      {next.kind === "match" ? (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-medium">{who}</span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{next.label}</span>
            {(next.roomName || next.time) && (
              <span className="text-muted-foreground">
                · {[next.roomName, next.time && `${next.time} WIB`].filter(Boolean).join(" · ")}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Lawan:{" "}
            <span className={cn(next.opponentKnown ? "text-foreground" : "italic")}>{next.opponent}</span>
          </p>
        </>
      ) : next.kind === "final-stage" ? (
        <p className="text-sm">
          <span className="font-medium">{who}</span> menjadi juara ruangan dan maju ke Babak Final.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm">
          <TrophyIcon className="size-4 text-amber-500" />
          <span className="font-medium">{who}</span> menjadi juara Bracket LRP 2026.
        </p>
      )}
    </section>
  );
}
