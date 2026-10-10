"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const MAX_SCORE = 99;

/** Input skor ramah sentuh: tombol −/+ besar dan kotak angka yang bisa diketik. */
export function ScoreStepper({
  id,
  label,
  value,
  onChange,
  disabled,
  max = MAX_SCORE,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Nilai maksimum (mis. 2 untuk game semifinal best of 3). */
  max?: number;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(0, next)));

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="size-11"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={`Kurangi skor ${label}`}
      >
        <MinusIcon />
      </Button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number.parseInt(e.target.value || "0", 10) || 0)}
        onFocus={(e) => e.target.select()}
        className="h-11 w-16 rounded-lg border bg-background text-center text-2xl font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={`Skor ${label}`}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="size-11"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Tambah skor ${label}`}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
