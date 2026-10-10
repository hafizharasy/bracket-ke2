"use client";

import { CameraIcon, ImageUpIcon, Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { compressPhoto, MAX_PHOTO_BYTES, uploadProofPhoto } from "@/lib/results-client";
import { cn } from "@/lib/utils";

export type ProofPhoto = { url: string; previewUrl: string; size: number };

type State =
  | { kind: "empty" }
  | { kind: "uploading"; previewUrl: string }
  | { kind: "ready"; photo: ProofPhoto }
  | { kind: "error"; message: string; previewUrl?: string };

const formatKb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/**
 * Unggah foto bukti hasil laga. Di ponsel langsung membuka kamera belakang;
 * foto diperkecil di browser lalu diunggah. Memanggil `onChange` dengan foto
 * yang sudah terunggah (atau null saat dihapus / gagal).
 */
export function ProofPhotoInput({
  matchId,
  onChange,
  disabled,
}: {
  matchId: string;
  onChange: (photo: ProofPhoto | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "empty" });

  const previewUrl =
    state.kind === "ready" ? state.photo.previewUrl : state.kind === "empty" ? undefined : state.previewUrl;

  // Lepas object URL preview lama agar tidak bocor memori.
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ kind: "error", message: "Berkas harus berupa foto." });
      return onChange(null);
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setState({ kind: "error", message: "Foto terlalu besar (maks. 15 MB)." });
      return onChange(null);
    }
    const preview = URL.createObjectURL(file);
    setState({ kind: "uploading", previewUrl: preview });
    onChange(null);
    try {
      const compressed = await compressPhoto(file);
      const { url } = await uploadProofPhoto(matchId, compressed);
      const photo = { url, previewUrl: preview, size: compressed.size };
      setState({ kind: "ready", photo });
      onChange(photo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah foto. Coba lagi.";
      setState({ kind: "error", message, previewUrl: preview });
    }
  }

  function clear() {
    setState({ kind: "empty" });
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = state.kind === "uploading";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Foto bukti</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={`proof-${matchId}`}
        disabled={disabled || busy}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview lokal (blob:) */}
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti"
            className={cn("max-h-72 w-full object-contain", busy && "opacity-60")}
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium">
              <Loader2Icon className="size-4 animate-spin" />
              Mengunggah…
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={`proof-${matchId}`}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <CameraIcon className="size-6" aria-hidden />
          <span className="font-medium text-foreground">Ambil atau pilih foto</span>
          <span className="text-xs">Foto papan skor / layar hasil sebagai bukti</span>
        </label>
      )}

      {state.kind === "ready" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageUpIcon className="size-3.5 text-emerald-600" />
          Terunggah ({formatKb(state.photo.size)})
          <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <RefreshCwIcon /> Ganti
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={clear} disabled={disabled}>
            <Trash2Icon /> Hapus
          </Button>
        </div>
      )}
      {state.kind === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
          {state.message}
          <Button type="button" variant="outline" size="xs" className="ml-auto" onClick={() => inputRef.current?.click()}>
            Pilih ulang
          </Button>
        </div>
      )}
    </div>
  );
}
