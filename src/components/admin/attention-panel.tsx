import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import Link from "next/link";

export type AttentionItem = { text: string; href: string };

/** Hal yang perlu ditindaklanjuti admin. */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
        <CircleCheckIcon className="size-4 text-emerald-600" /> Semua siap — tidak ada yang perlu ditindaklanjuti.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/5 p-3">
      {items.map((item) => (
        <li key={item.text} className="flex items-start gap-2 text-sm">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span className="flex-1">{item.text}</span>
          <Link href={item.href} className="shrink-0 font-medium underline underline-offset-2">Buka</Link>
        </li>
      ))}
    </ul>
  );
}
