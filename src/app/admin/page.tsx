import { CalendarClockIcon, CheckCircle2Icon, RadioIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { getBracket } from "@/lib/get-bracket";

export const metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan turnamen dan akses cepat pengelolaan.</p>
      </div>
      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-muted" />}>
        <QuickStats />
      </Suspense>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Akses cepat">
        {[
          { href: "/admin/pantau", title: "Pantau Ruangan", text: "Status 10 ruangan secara langsung" },
          { href: "/admin/peserta", title: "Peserta & Jadwal", text: "Daftar, sesi, ruangan, pasangan" },
          { href: "/admin/ruangan", title: "Ruangan & Sesi", text: "Nama, lokasi, jam sesi" },
          { href: "/admin/pengawas", title: "Akun Pengawas", text: "Akun login per ruangan" },
        ].map((link) => (
          <Link key={link.href} href={link.href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
            <div className="font-medium">{link.title}</div>
            <div className="text-sm text-muted-foreground">{link.text}</div>
          </Link>
        ))}
      </section>
    </main>
  );
}

async function QuickStats() {
  const { participants, matches } = await getBracket();
  const stats = [
    { label: "Peserta", value: participants.length, icon: UsersIcon },
    { label: "Laga selesai", value: matches.filter((m) => m.status === "done").length, icon: CheckCircle2Icon },
    { label: "Sedang berjalan", value: matches.filter((m) => m.status === "ongoing").length, icon: RadioIcon },
    { label: "Terjadwal", value: matches.filter((m) => m.status === "scheduled").length, icon: CalendarClockIcon },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
