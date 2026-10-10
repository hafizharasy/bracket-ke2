import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";

export default function RuanganLayout({ children }: LayoutProps<"/ruangan">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center gap-2 px-4">
          <ShieldCheckIcon className="size-4 text-emerald-600" aria-hidden />
          <span className="text-sm font-semibold">Area Pengawas</span>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" />
            Bracket publik
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
