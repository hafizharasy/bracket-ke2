import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ArenaFooter, ArenaLogo, EVENT_NAME } from "@/components/arena/arena-chrome";
import { ARENA_BOOT_SCRIPT } from "@/components/arena/arena-client";

export const metadata = {
  title: `Kebijakan Privasi · ${EVENT_NAME}`,
  description: `Data apa yang disimpan sistem turnamen ${EVENT_NAME} dan bagaimana data itu dipakai.`,
};

const UPDATED = "13 Oktober 2026";

export default function PrivacyPage() {
  return (
    <div className="arena flex min-h-full flex-1 flex-col" suppressHydrationWarning>
      {/* Tema malam tersimpan diterapkan sebelum halaman tampil. */}
      <script dangerouslySetInnerHTML={{ __html: ARENA_BOOT_SCRIPT }} />
      <header className="bg-cream">
        <div className="arena-checker h-1.5" aria-hidden />
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label={`${EVENT_NAME} — beranda`} className="mr-auto">
            <ArenaLogo />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-ink/75 hover:text-crimson">
            <ArrowLeftIcon className="size-4" aria-hidden /> Bracket
          </Link>
        </div>
        <div className="h-[3px] bg-crimson" aria-hidden />
        <div className="h-[3px] bg-gold" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-ink sm:px-6">
        <h1 className="font-display text-3xl tracking-wide sm:text-4xl">Kebijakan Privasi</h1>
        <p className="mt-2 text-sm text-ink/60">Terakhir diperbarui {UPDATED}</p>

        <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed text-ink/85">
          <p>
            Situs ini adalah sistem turnamen resmi {EVENT_NAME} yang dikelola panitia penyelenggara. Halaman ini
            menjelaskan data apa yang kami simpan, untuk apa, dan siapa yang dapat melihatnya.
          </p>

          <Section title="Data yang kami simpan">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <b>Peserta:</b> nama, asal sekolah, serta sesi dan ruangan bertanding — diisi panitia dari data
                pendaftaran.
              </li>
              <li>
                <b>Hasil pertandingan:</b> skor, pemenang, jadwal, dan catatan pelanggaran.
              </li>
              <li>
                <b>Foto bukti hasil:</b> foto papan/lembar skor yang diunggah pengawas ruangan setiap laga.
              </li>
              <li>
                <b>Akun panitia &amp; pengawas:</b> nama, email, dan kata sandi (disimpan dalam bentuk hash, tidak bisa
                dibaca siapa pun), serta catatan aktivitas untuk keperluan audit.
              </li>
            </ul>
          </Section>

          <Section title="Yang tampil untuk publik">
            Halaman bracket publik hanya menampilkan nama peserta, asal sekolah, jadwal, skor, dan pemenang. Foto bukti,
            nama pengawas/wasit, catatan pelanggaran, dan data akun hanya dapat dilihat panitia yang masuk sebagai admin
            atau pengawas ruangan yang bersangkutan.
          </Section>

          <Section title="Google Drive">
            <p>
              Panitia dapat menghubungkan akun Google Drive milik panitia agar foto bukti otomatis disalin sebagai
              cadangan. Untuk itu aplikasi hanya meminta izin <code className="text-sm">drive.file</code>: aplikasi
              hanya dapat membuat dan mengelola berkas serta folder yang dibuatnya sendiri, dan tidak dapat melihat
              atau mengubah isi Drive lainnya. Alamat email akun Google tersebut disimpan agar panitia tahu akun mana
              yang terhubung.
            </p>
            <p className="mt-3">
              Penggunaan dan pemindahan informasi yang diterima dari Google API mematuhi{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-crimson underline underline-offset-2"
              >
                Google API Services User Data Policy
              </a>
              , termasuk ketentuan Limited Use. Data dari Google tidak dipakai untuk iklan, tidak dijual, dan tidak
              dibagikan kepada pihak lain. Koneksi dapat diputus kapan saja dari halaman admin atau melalui{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-crimson underline underline-offset-2"
              >
                pengaturan akun Google
              </a>
              .
            </p>
          </Section>

          <Section title="Cookie & penyimpanan di perangkat">
            Kami memakai cookie hanya untuk menjaga sesi masuk panitia dan pengawas. Pilihan tema siang/malam disimpan
            di browser Anda. Tidak ada cookie iklan atau pelacak pihak ketiga.
          </Section>

          <Section title="Penyimpanan & penghapusan">
            Data disimpan di server penyelenggara (dan salinan foto di Google Drive panitia bila dihubungkan) selama
            diperlukan untuk pelaksanaan dan dokumentasi turnamen. Data tidak dijual atau dibagikan kepada pihak lain.
            Peserta atau pendamping yang ingin datanya diperbaiki atau dihapus dapat menghubungi panitia penyelenggara{" "}
            {EVENT_NAME}.
          </Section>
        </div>
      </main>

      <ArenaFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg tracking-wide text-crimson">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
