import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import Link from "next/link";

import type { CompletenessCheck } from "@/lib/schedule-completeness";
import { cn } from "@/lib/utils";

/** Daftar periksa kelengkapan jadwal dengan tautan perbaikan. */
export function CompletenessPanel({ checks }: { checks: CompletenessCheck[] }) {
  const done = checks.filter((c) => c.ok).length;
  const allOk = done === checks.length;
  return (
    <section
      aria-label="Kelengkapan jadwal"
      className={cn("flex flex-col gap-3 rounded-xl border p-4", allOk ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Kelengkapan jadwal</h2>
        <span className={cn("text-sm font-medium", allOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
          {allOk ? "Siap bertanding" : `${done}/${checks.length} lengkap`}
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            {c.ok ? (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="lengkap" />
            ) : (
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="belum lengkap" />
            )}
            <span className="min-w-0">
              <span className="font-medium">{c.label}</span>
              <span className="block text-xs text-muted-foreground">
                {c.detail}
                {!c.ok && (
                  <>
                    {" · "}
                    <Link href={c.href} className="font-medium text-foreground underline underline-offset-2">
                      Perbaiki
                    </Link>
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
