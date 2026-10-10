import Link from "next/link";
import { Suspense } from "react";

import { TournamentSummaryCards } from "@/components/admin/tournament-summary-cards";
import { getBracket } from "@/lib/get-bracket";
import { summarizeTournament } from "@/lib/tournament-summary";
import { getTotalViolations } from "@/lib/violation-totals";
import { RoomMonitorGrid } from "@/components/admin/room-monitor-grid";
import { monitorRooms } from "@/lib/room-monitor";
import { getViolationCountsByRoom } from "@/lib/room-violation-counts";

export const metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan turnamen dan akses cepat pengelolaan.</p>
      </div>
      <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-muted" />}>
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
  const [data, violations, counts] = await Promise.all([getBracket(), getTotalViolations(), getViolationCountsByRoom()]);
  return (
    <>
      <TournamentSummaryCards summary={summarizeTournament(data)} violations={violations} />
      <section aria-label="Pantau ruangan" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Ruangan</h2>
          <Link href="/admin/pantau" className="text-sm text-muted-foreground hover:text-foreground">Lihat detail →</Link>
        </div>
        <RoomMonitorGrid rooms={monitorRooms(data, counts).rooms} compact />
      </section>
    </>
  );
}
