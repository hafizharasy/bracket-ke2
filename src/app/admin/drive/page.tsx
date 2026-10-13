import { CheckCircle2Icon, ExternalLinkIcon, HardDriveUploadIcon, TriangleAlertIcon } from "lucide-react";
import { headers } from "next/headers";
import { Suspense } from "react";

import { DriveButtons } from "@/components/admin/drive-buttons";
import { requireAdmin } from "@/lib/admin-session";
import { publicBaseUrl } from "@/server/better-auth";
import { driveQueueStatus } from "@/server/drive-sync";
import { driveConnection } from "@/server/google-drive";

export const metadata = { title: "Google Drive" };

export default function DrivePage({ searchParams }: PageProps<"/admin/drive">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Google Drive</h1>
        <p className="text-sm text-muted-foreground">
          Foto bukti dari pengawas disimpan di server, lalu otomatis disalin ke Google Drive Anda di latar belakang — rapi per
          sesi & ruangan. Input hasil tidak pernah menunggu Drive.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Status searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Status({ searchParams }: Pick<PageProps<"/admin/drive">, "searchParams">) {
  await requireAdmin("/admin/drive");
  const params = await searchParams;
  const conn = driveConnection();
  const host = (await headers()).get("host");
  const base = publicBaseUrl() ?? (host ? `https://${host}` : "https://domain-anda");
  const redirectUri = `${base}/api/admin/drive/callback`;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex flex-col gap-4">
      {params.ok && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4" /> Google Drive terhubung. Foto bukti yang sudah ada sedang dikirim.
        </p>
      )}
      {(error || conn.lastError) && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {error === "belum-diatur" ? "GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET belum diatur di Railway." : (error ?? conn.lastError)}
            {!error && conn.lastError && " — hubungkan ulang Google Drive, lalu klik Kirim ulang yang gagal."}
          </span>
        </p>
      )}

      {!conn.configured ? (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">Langkah persiapan (sekali saja)</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Buka <b>console.cloud.google.com</b> → buat project baru → <b>APIs &amp; Services → Library</b> → aktifkan{" "}
              <b>Google Drive API</b>.
            </li>
            <li>
              <b>OAuth consent screen</b>: jenis <b>External</b>, isi nama aplikasi & email Anda, lalu ubah status publikasi ke{" "}
              <b>In production</b> (supaya izin tidak kedaluwarsa setelah 7 hari).
            </li>
            <li>
              <b>Credentials → Create credentials → OAuth client ID</b> → jenis <b>Web application</b> → isi{" "}
              <b>Authorized redirect URI</b> persis:
              <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs break-all">{redirectUri}</code>
            </li>
            <li>
              Salin <b>Client ID</b> & <b>Client secret</b> ke Railway → layanan → <b>Variables</b>:{" "}
              <code className="text-xs">GOOGLE_DRIVE_CLIENT_ID</code> dan <code className="text-xs">GOOGLE_DRIVE_CLIENT_SECRET</code>, lalu
              tunggu deploy selesai.
            </li>
            <li>Kembali ke halaman ini dan klik <b>Hubungkan Google Drive</b>.</li>
          </ol>
        </section>
      ) : !conn.connected ? (
        <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-sm">
          <p>
            Kredensial sudah diatur. Klik tombol di bawah, masuk dengan akun Google Anda, lalu izinkan aplikasi membuat berkas di
            Drive. Aplikasi hanya bisa mengakses berkas & folder yang dibuatnya sendiri.
          </p>
          <p className="text-xs text-muted-foreground">
            Bila muncul &quot;Google belum memverifikasi aplikasi ini&quot;, klik <b>Lanjutan → Buka (tidak aman)</b> — itu aplikasi milik
            Anda sendiri.
          </p>
          <a
            href="/api/admin/drive/connect"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            <HardDriveUploadIcon className="size-4" /> Hubungkan Google Drive
          </a>
          <p className="text-xs text-muted-foreground">
            Redirect URI yang dipakai: <code className="break-all">{redirectUri}</code>
          </p>
        </section>
      ) : (
        <Connected account={conn.account} folder={conn.rootFolderLink} />
      )}
    </div>
  );
}

function Connected({ account, folder }: { account: string | null; folder: string | null }) {
  const q = driveQueueStatus();
  const tiles = [
    { label: "Terkirim", value: q.done, tone: "text-emerald-700 dark:text-emerald-400" },
    { label: "Menunggu", value: q.pending, tone: "" },
    { label: "Gagal", value: q.failed, tone: q.failed ? "text-destructive" : "" },
    { label: "Belum diantrekan", value: q.notQueued, tone: "" },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2Icon className="size-5 text-emerald-600" />
        <span>
          Terhubung ke <b>{account}</b>
        </span>
        {folder && (
          <a href={folder} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
            Buka folder di Drive <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className={`text-2xl font-semibold tabular-nums ${t.tone}`}>{t.value}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Struktur folder: <code>Foto Bukti MCR &amp; LRP 2026 / Sesi 1 / Ruangan 2 / Laga 05 - 64 Besar Ruangan - A vs B (4-2) - 2026-10-13 14.05.32 WIB.jpg</code>;
        semifinal & final di folder <code>Semifinal</code> dan <code>Final</code>. Koreksi hasil membuat berkas baru (foto lama tetap ada).
      </p>
      {q.failures.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs">
          {q.failures.map((f) => (
            <li key={f.fileName} className="py-0.5">
              <b>{f.matchId}</b> — {f.error} ({f.attempts}× dicoba)
            </li>
          ))}
        </ul>
      )}
      <DriveButtons show={["retry", "sync", "disconnect"]} />
    </section>
  );
}
