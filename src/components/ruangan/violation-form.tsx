"use client";

import { CheckCircle2Icon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SessionExpiredNotice } from "@/components/auth/session-expired-notice";
import { Button } from "@/components/ui/button";
import { submitViolation } from "@/lib/results-client";
import { VIOLATION_TYPES } from "@/lib/violations";
import { cn } from "@/lib/utils";

export type ViolationParticipantOption = { id: string; name: string; club: string | null };
export type ViolationMatchOption = { id: string; label: string; participantIds: string[] };

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; simulated: boolean }
  | { kind: "error"; message: string; expired?: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
/** Jam sekarang (WIB) dalam format input time "HH:MM". */
function nowWib() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
}
/** Gabungkan tanggal hari ini (WIB) dengan jam "HH:MM" → ISO. */
function wibTimeToIso(time: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const [h, m] = time.split(":").map(Number);
  return new Date(`${today}T${pad(h)}:${pad(m)}:00+07:00`).toISOString();
}

/** Form catat pelanggaran peserta di ruangan pengawas. */
export function ViolationForm({
  participants,
  matches,
  initialParticipantId,
  initialMatchId,
}: {
  participants: ViolationParticipantOption[];
  matches: ViolationMatchOption[];
  initialParticipantId?: string;
  initialMatchId?: string;
}) {
  const [participantId, setParticipantId] = useState<string | null>(initialParticipantId ?? null);
  const [query, setQuery] = useState("");
  const [matchId, setMatchId] = useState<string>(initialMatchId ?? "");
  const [type, setType] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [time, setTime] = useState(nowWib);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saving = status.kind === "saving";

  const selected = participants.find((p) => p.id === participantId);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants.slice(0, 8);
    return participants
      .filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [participants, query]);
  const participantMatches = matches.filter((m) => participantId && m.participantIds.includes(participantId));

  const noteRequired = type === "Lainnya";
  const missing = !participantId ? "Pilih peserta." : !type ? "Pilih jenis pelanggaran." : noteRequired && !note.trim() ? "Isi catatan untuk jenis Lainnya." : null;

  function reset() {
    setParticipantId(null);
    setMatchId("");
    setType(null);
    setNote("");
    setTime(nowWib());
    setStatus({ kind: "idle" });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (missing) return setStatus({ kind: "error", message: missing });
    setStatus({ kind: "saving" });
    const result = await submitViolation({
      participantId: participantId!,
      matchId: matchId || null,
      type: type!,
      note: note.trim() || null,
      occurredAt: wibTimeToIso(time),
    });
    setStatus(
      result.ok
        ? { kind: "saved", simulated: result.simulated }
        : { kind: "error", message: result.error, expired: result.code === "SESSION_EXPIRED" },
    );
  }

  if (status.kind === "saved") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4" />
          Pelanggaran {selected?.name} tercatat{status.simulated ? " (mode simulasi)" : ""}.
        </p>
        <div className="flex gap-2">
          <Button type="button" onClick={reset}>Catat lagi</Button>
          <Link href="/ruangan/pelanggaran" className="flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">
            Lihat ringkasan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <fieldset className="flex min-w-0 flex-col gap-2" disabled={saving}>
        <legend className="mb-2 text-sm font-semibold">Peserta</legend>
        {selected ? (
          <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{selected.name}</div>
              <div className="text-xs text-muted-foreground">
                {selected.club ?? "Tanpa klub"} · {selected.id.toUpperCase()}
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setParticipantId(null); setMatchId(""); }}>
              <XIcon /> Ganti
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama atau ID peserta…"
                aria-label="Cari peserta"
                className="h-11 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <ul className="divide-y rounded-xl border bg-card" aria-label="Hasil pencarian peserta">
              {results.length === 0 && <li className="p-3 text-sm text-muted-foreground">Peserta tidak ditemukan di ruangan ini.</li>}
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setParticipantId(p.id); setMatchId(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.id.toUpperCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {selected && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Laga (opsional)</span>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="h-11 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Di luar laga —</option>
              {participantMatches.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2" disabled={saving}>
        <legend className="mb-2 text-sm font-semibold">Jenis pelanggaran</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis pelanggaran">
          {VIOLATION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm",
                type === t ? "border-amber-500 bg-amber-500/15 font-medium" : "bg-background hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3" disabled={saving}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">
            Catatan {noteRequired ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(opsional)</span>}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Kronologi singkat…"
            className="rounded-lg border bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Jam kejadian (WIB)</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="h-11 w-32 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </fieldset>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={saving || !!missing}>
        {saving && <Loader2Icon className="animate-spin" />}
        Simpan pelanggaran
      </Button>
      <div aria-live="polite" className="min-h-5 text-sm">
        {status.kind === "error" &&
          (status.expired ? <SessionExpiredNotice message={status.message} /> : <p className="text-destructive">{status.message}</p>)}
        {status.kind === "idle" && missing && <p className="text-muted-foreground">{missing}</p>}
      </div>
    </form>
  );
}
