import Link from "next/link";
import { Suspense } from "react";

import { TournamentSummaryCards } from "@/components/admin/tournament-summary-cards";
import { RoomMonitorGrid } from "@/components/admin/room-monitor-grid";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { AttentionPanel } from "@/components/admin/attention-panel";
import { LiveUpdater } from "@/components/bracket/live-updater";
import { getAdminSession } from "@/lib/admin-session";
import { getDashboardSummary } from "@/server/dashboard";

export const metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Ringkasan turnamen dan akses cepat pengelolaan.</p>}>
          <Greeting />
        </Suspense>
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
  const { summary, violations, attention, activity, monitor, revision, generatedAt } = await getDashboardSummary();
  return (
    <>
      {/* Ringkasan dimuat ulang otomatis saat bagan, pelanggaran, atau akun berubah. */}
      <LiveUpdater version={revision} updatedAt={generatedAt} pollUrl="/api/admin/summary/revision" realtime={false} pollMs={15_000} />
      <TournamentSummaryCards summary={summary} violations={violations} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Perlu perhatian" className="flex flex-col gap-2">
          <h2 className="font-semibold">Perlu perhatian</h2>
          <AttentionPanel items={attention} />
        </section>
        <section aria-label="Aktivitas terbaru" className="flex flex-col gap-2">
          <h2 className="font-semibold">Aktivitas terbaru</h2>
          <ActivityFeed items={activity} />
        </section>
      </div>
      <section aria-label="Pantau ruangan" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Ruangan</h2>
          <Link href="/admin/pantau" className="text-sm text-muted-foreground hover:text-foreground">Lihat detail →</Link>
        </div>
        <RoomMonitorGrid rooms={monitor.rooms} compact />
      </section>
    </>
  );
}

async function Greeting() {
  const session = await getAdminSession();
  return (
    <p className="text-sm text-muted-foreground">
      {session ? `Selamat datang, ${session.name}. ` : ""}Ringkasan turnamen dan akses cepat pengelolaan.
    </p>
  );
}
