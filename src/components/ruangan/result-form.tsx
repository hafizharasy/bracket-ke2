"use client";

import { ArrowRightIcon, CheckCircle2Icon, Loader2Icon, TrophyIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type ProofPhoto, ProofPhotoInput } from "@/components/ruangan/proof-photo-input";
import { SessionExpiredNotice } from "@/components/auth/session-expired-notice";
import { ScoreStepper } from "@/components/ruangan/score-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FINAL_ROUND, SEMIFINAL_ROUND, SEMIFINAL_WINS, WIN_TYPE_KEYS, WIN_TYPES, type WinType } from "@/lib/bracket";
import { formatPoints } from "@/lib/final-standings";
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
  /** Pemenang semifinal lolos ke final (kompetisi penuh). */
  | { kind: "final-stage" }
  /** Laga final round-robin: poin masuk klasemen. */
  | { kind: "points" };

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; simulated: boolean }
  | { kind: "error"; message: string; expired?: boolean };

/**
 * Form input hasil laga (pengawas ruangan & admin), sesuai babak:
 * - Babak ruangan (best of one): cukup pilih pemenang, tanpa skor.
 * - Semifinal: game dimenangkan, best of 3 (2-0 atau 2-1).
 * - Final round-robin: pemenang + jenis kemenangan (poin).
 * Foto bukti opsional.
 */
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
  const [photo, setPhoto] = useState<ProofPhoto | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saving = status.kind === "saving";
  const router = useRouter();

  const mode = match.round === FINAL_ROUND ? "final" : match.round === SEMIFINAL_ROUND ? "semifinal" : "room";
  // Pemenang yang dipilih langsung (babak ruangan & final).
  const [pickedWinnerId, setPickedWinnerId] = useState<string | null>(mode === "semifinal" ? null : match.winnerId);
  const [winType, setWinType] = useState<WinType | null>((match.winType as WinType | null) ?? null);

  const semifinalValid = Math.max(scoreA, scoreB) === SEMIFINAL_WINS && Math.min(scoreA, scoreB) < SEMIFINAL_WINS;
  const winnerId =
    mode !== "semifinal" ? pickedWinnerId : !semifinalValid ? null : scoreA > scoreB ? participantA.id : participantB.id;
  const winner = winnerId === participantA.id ? participantA : winnerId === participantB.id ? participantB : null;

  // Koreksi yang mengganti pemenang ditolak server bila laga berikutnya sudah dimulai.
  const lockedWinner =
    match.status === "done" && next.kind === "match" && next.status !== "scheduled" ? match.winnerId : null;
  const winnerChangeBlocked = !!lockedWinner && !!winnerId && winnerId !== lockedWinner;

  const touch = () => status.kind !== "saving" && setStatus({ kind: "idle" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "semifinal" && !semifinalValid) {
      return setStatus({ kind: "error", message: "Best of 3: pemenang 2 game, lawan 0 atau 1." });
    }
    if (mode === "final" && (!winnerId || !winType)) {
      return setStatus({ kind: "error", message: "Pilih pemenang dan jenis kemenangannya." });
    }
    if (!winnerId) return setStatus({ kind: "error", message: "Pilih pemenang laga ini." });
    setStatus({ kind: "saving" });
    const proof = photo ? { proofPhotoUrl: photo.url } : {};
    const result = await submitMatchResult(
      match.id,
      mode === "final"
        ? { winnerId, winType: winType!, ...proof }
        : mode === "room"
          ? { winnerId, ...proof }
          : { scoreA, scoreB, ...proof },
    );
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
      {mode !== "semifinal" ? (
        <WinnerFields
          participants={[participantA, participantB]}
          final={mode === "final"}
          winnerId={pickedWinnerId}
          winType={winType}
          disabled={saving}
          onWinner={(id) => {
            setPickedWinnerId(id);
            touch();
          }}
          onWinType={(type) => {
            setWinType(type);
            touch();
          }}
        />
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-3" disabled={saving}>
          <legend className="mb-2 text-sm font-semibold">Game dimenangkan (best of 3)</legend>
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
                    {participant.teamOrClub ?? "Tanpa sekolah"} · {participant.id.toUpperCase()}
                  </span>
                </label>
                <ScoreStepper
                  id={`score-${key}`}
                  label={participant.name}
                  max={SEMIFINAL_WINS}
                  value={score}
                  onChange={(v) => {
                    setScore(v);
                    touch();
                  }}
                />
              </div>
            );
          })}

          {mode === "semifinal" && !semifinalValid && (
            <p className="text-sm text-muted-foreground">Isi game yang dimenangkan: pemenang 2, lawan 0 atau 1.</p>
          )}
        </fieldset>
      )}

      <AdvancePreview next={next} winner={winner} />

      {winnerChangeBlocked && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          Laga berikutnya sudah dimulai, jadi pemenang tidak bisa diganti.{" "}
          {mode === "semifinal" ? "Koreksi hanya boleh mengubah skor dengan pemenang yang sama." : "Koreksi hanya boleh mengganti foto bukti."}
        </p>
      )}

      <ProofPhotoInput matchId={match.id} onChange={setPhoto} onUploadingChange={setPhotoUploading} disabled={saving} />

      <Button
        type="submit"
        size="lg"
        className="h-12 text-base"
        // Tunggu unggahan foto yang sedang berjalan selesai, supaya fotonya ikut tersimpan.
        disabled={saving || photoUploading || !winnerId || (mode === "final" && !winType) || winnerChangeBlocked}
      >
        {saving && <Loader2Icon className="animate-spin" />}
        {match.status === "done" ? "Simpan koreksi hasil" : "Simpan hasil"}
      </Button>

      <div aria-live="polite" className="min-h-5 text-sm">
        {status.kind === "saved" && (
          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2Icon className="size-4" />
            {mode === "final"
              ? `Hasil tersimpan: ${winner?.name} menang (+${winType ? formatPoints(WIN_TYPES[winType].points) : 0} poin)`
              : mode === "semifinal"
                ? `Hasil ${scoreA}–${scoreB} tersimpan, ${winner?.name} menang`
                : `Hasil tersimpan: ${winner?.name} menang`}
            {status.simulated ? " (mode simulasi)" : ""}.
          </p>
        )}
        {status.kind === "error" &&
          (status.expired ? (
            <SessionExpiredNotice message={status.message} />
          ) : (
            <p className="text-destructive">{status.message}</p>
          ))}
      </div>
    </form>
  );
}

/** Pratinjau: pemenang akan mengisi laga mana di babak berikutnya. */
function AdvancePreview({ next, winner }: { next: NextPreview; winner: Participant | null }) {
  const who = winner?.name ?? "Pemenang";
  return (
    <section aria-label="Pratinjau babak lanjut" className="flex flex-col gap-1.5 rounded-xl border bg-muted/40 p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Babak lanjut</span>
      {next.kind === "match" ? (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-medium">{who}</span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{next.label}</span>
            {next.roomName && <span className="text-muted-foreground">· {next.roomName}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            Lawan: <span className={cn(next.opponentKnown ? "text-foreground" : "italic")}>{next.opponent}</span>
          </p>
        </>
      ) : next.kind === "final-stage" ? (
        <p className="text-sm">
          <span className="font-medium">{who}</span> lolos ke Final (kompetisi penuh antar finalis).
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm">
          <TrophyIcon className="size-4 text-amber-500" />
          Poin <span className="font-medium">{who}</span> masuk klasemen final; juara ditentukan setelah semua laga
          final selesai.
        </p>
      )}
    </section>
  );
}

/**
 * Pilih pemenang: babak ruangan (best of one, cukup pemenang) dan final
 * round-robin (pemenang + jenis kemenangan yang menentukan poin).
 */
function WinnerFields({
  participants,
  final,
  winnerId,
  winType,
  disabled,
  onWinner,
  onWinType,
}: {
  participants: [Participant, Participant];
  final: boolean;
  winnerId: string | null;
  winType: WinType | null;
  disabled: boolean;
  onWinner: (id: string) => void;
  onWinType: (type: WinType) => void;
}) {
  const option = (active: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-2 rounded-xl border bg-card p-3 text-sm",
      active && "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/40",
    );
  return (
    <fieldset className="flex min-w-0 flex-col gap-4" disabled={disabled}>
      <legend className="sr-only">{final ? "Hasil final" : "Hasil laga"}</legend>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Pemenang">
        <span className="text-sm font-semibold">{final ? "Pemenang" : "Siapa yang menang? (best of one)"}</span>
        {participants.map((p, i) => (
          <label key={p.id} className={option(winnerId === p.id)}>
            <input
              type="radio"
              name="winner"
              checked={winnerId === p.id}
              onChange={() => onWinner(p.id)}
              className="accent-emerald-600"
            />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate font-medium">{p.name}</span>
                {winnerId === p.id && (
                  <Badge className="shrink-0 bg-emerald-600 text-white">
                    <TrophyIcon data-icon="inline-start" />
                    Menang
                  </Badge>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {final ? `${i === 0 ? "Tuan rumah (jalan pertama)" : "Tamu"} · ` : ""}
                {p.teamOrClub ?? "Tanpa sekolah"} · {p.id.toUpperCase()}
              </span>
            </span>
          </label>
        ))}
      </div>
      {final && (
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Jenis kemenangan">
        <span className="text-sm font-semibold">Jenis kemenangan</span>
        {WIN_TYPE_KEYS.map((key) => (
          <label key={key} className={option(winType === key)}>
            <input
              type="radio"
              name="final-win-type"
              checked={winType === key}
              onChange={() => onWinType(key)}
              className="accent-emerald-600"
            />
            <span className="flex-1">{WIN_TYPES[key].label}</span>
            <span className="font-semibold tabular-nums">+{formatPoints(WIN_TYPES[key].points)}</span>
          </label>
        ))}
      </div>
      )}
    </fieldset>
  );
}
