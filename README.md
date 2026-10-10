# Bracket LRP 2026

Bagan turnamen 1 vs 1 LRP 2026: 640 peserta, 4 sesi, 10 ruangan.
Next.js (App Router) + Tailwind + shadcn/ui, SQLite + Drizzle ORM.

## Menjalankan

```bash
npm install
npm run db:setup   # migrasi + seed (4 sesi, 10 ruangan, 640 peserta)
npm run dev        # http://localhost:3000
```

## Pengecekan

```bash
npm run typecheck   # generate tipe rute + tsc
npm run lint
npm test            # vitest (SQLite di memori)
```

## Database

| Perintah | Fungsi |
| --- | --- |
| `npm run db:generate` | Buat file migrasi baru dari `src/db/schema.ts` |
| `npm run db:migrate` | Terapkan migrasi di `drizzle/` |
| `npm run db:seed` | Isi sesi, ruangan, peserta, dan struktur bagan yang belum ada (aman diulang) |
| `npm run db:seed -- --reset` | Kosongkan data turnamen lalu isi ulang (akun tidak dihapus) |
| `npm run db:create-admin -- --email <email> [--name <nama>] --password <sandi>` | Buat akun admin utama (atau setel ulang sandinya); sandi juga bisa lewat env `ADMIN_PASSWORD` |
| `npm run db:import-peserta -- peserta.csv [--dry-run] [--replace]` | Impor peserta dari CSV (format: `data-templates/peserta.csv`) |
| `npm run db:studio` | Buka Drizzle Studio |

Berkas database default ada di `data/bracket.db`; ubah lewat env `DATABASE_PATH`
(mis. ke volume persisten saat deploy). Foto bukti disimpan di `data/uploads`
(env `UPLOAD_DIR`) dan disajikan lewat `/api/bukti/:file`.

## Login & peran

Login memakai [Better Auth](https://www.better-auth.com) (email + sandi, sesi di
cookie httpOnly, tabel `auth_sessions` / `auth_accounts`). Pendaftaran publik
dimatikan: akun admin dibuat dengan `db:create-admin`, akun pengawas dibuat admin
di `/admin/pengawas`.

- **Admin utama** (`/masuk/admin`) — akses penuh ke `/admin` dan semua endpoint admin.
- **Pengawas ruangan** (`/masuk`) — hanya ruangannya sendiri (`/ruangan`, hasil,
  bukti, pelanggaran); aturan di `src/lib/policy.ts`.
- Akun nonaktif (`users.active = 0`) tidak bisa login dan sesinya tidak berlaku lagi.
- 5 kali gagal berturut-turut untuk satu email → login email itu dikunci 15 menit
  (tabel `login_attempts`). Rute HTTP bawaan Better Auth untuk sign-in, sign-up,
  dan ubah profil/sandi dimatikan; login hanya lewat halaman `/masuk` atau `/api/login/*`.

| Env | Fungsi |
| --- | --- |
| `BETTER_AUTH_SECRET` | Wajib di production: kunci acak panjang (mis. `openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | URL publik aplikasi, mis. `https://bracket.contoh.id` |

Akun contoh pengembangan dari `db:seed` (tidak dibuat di production):
`admin@lrp.local` / `admin12345` dan `ruangan1@lrp.local` … `ruangan10@lrp.local` / `pengawas123`.
Di luar production, endpoint API juga menerima header `x-dev-user-id: <id akun>` untuk pengujian.

## Sumber data & live update

- Default, halaman membaca database. Set `BRACKET_DATA_SOURCE=mock` untuk demo
  dengan simulasi turnamen berjalan (tanpa database).
- Live update: halaman berlangganan `GET /api/bracket/stream` (Server-Sent Events)
  dan hanya me-refresh saat versi bagan (`bracket_state.version`) berubah.
  Bila SSE tidak tersedia, klien polling `GET /api/bracket/version` (ETag/304).
- Dashboard admin polling `GET /api/admin/summary/revision` tiap 15 detik dan
  memuat ulang ringkasan hanya bila bagan, pelanggaran, atau akun berubah.

## API

| Endpoint | Fungsi |
| --- | --- |
| `POST /api/login/ruangan` · `POST /api/login/admin` | Login `{ email, password }` → cookie sesi + `{ user, room }`; 401 salah, 403 peran salah/nonaktif, 423 dikunci (Retry-After) |
| `GET /api/session` · `DELETE /api/session` | Sesi saat ini `{ user, room, expiresAt }` (401 bila tidak ada) / keluar |
| `GET /api/bracket?sesi=&ruangan=` | Bagan (opsional difilter), ETag/304 |
| `GET /api/bracket/version` | Versi data bagan (ringan) |
| `GET /api/bracket/stream` | SSE `event: version` setiap ada perubahan |
| `GET /api/schedule?sesi=&ruangan=` | Jadwal publik: jam mulai & rentang laga tiap sesi, laga terurut jam beserta nama peserta |
| `GET /api/sessions` · `GET /api/rooms` | Daftar sesi / ruangan beserta jumlah peserta, laga (dan akun pengawas) |
| `POST /api/sessions` · `PATCH/DELETE /api/sessions/:id` | Tambah / ubah `{ name?, startTime? }` (jadwal laga ikut bergeser) / hapus sesi yang belum dipakai — admin |
| `POST /api/rooms` · `PATCH/DELETE /api/rooms/:id` | Tambah / ubah `{ name?, location? }` / hapus ruangan yang belum dipakai — admin |
| `GET /api/matches/:id` | Detail satu pertandingan |
| `POST /api/matches/:id/proof` | Unggah foto bukti (multipart `photo`, JPEG/PNG/WebP ≤ 5 MB) |
| `DELETE /api/matches/:id/result` | Batalkan hasil (salah input) selama laga berikutnya belum dimulai |
| `PUT /api/matches/:id/result` | Simpan/koreksi hasil (pengawas ruangan / admin); `proofPhotoUrl` harus hasil unggah untuk laga itu |
| `GET /api/bukti/:file` | Foto bukti tersimpan |
| `GET /api/rooms/:id/violations?sesi=` | Pelanggaran ruangan + total per jenis/peserta |
| `GET /api/participants/:id/violations` | Riwayat pelanggaran peserta (pengawas: ruangannya; admin: semua) |
| `GET /api/rooms/:id/matches?sesi=` · `GET /api/rooms/:id/history?sesi=` | Laga & riwayat hasil ruangan |
| `POST /api/violations` | Catat pelanggaran (`participantId`, `matchId?`, `roomId?`, `type`, `note?`, `occurredAt?`) |
| `GET /api/participants?q=&sesi=&ruangan=&hal=&per=` | Cari peserta (nama/ID/klub), filter sesi/ruangan (`none` = belum ditempatkan), berhalaman — admin |
| `POST /api/participants` · `GET/PATCH/DELETE /api/participants/:id` | Tambah/lihat/ubah/hapus peserta (hapus ditolak 409 bila sudah masuk bagan) — admin |
| `POST /api/participants/assign` | Pindahkan peserta `{ ids, sessionId?, roomId? }` (null = kosongkan; ganti sesi mengosongkan ruangan; maks. 16 per ruangan per sesi) — admin |
| `POST /api/participants/auto-assign` | Bagi rata otomatis `{ kind: "sesi", mode }` / `{ kind: "ruangan", mode, sessionId }`, mode `unassigned`/`all`; klub disebar — admin |
| `GET /api/pairings?sesi=&ruangan=` · `PUT /api/pairings` | Baca/simpan pasangan babak 1 `{ sessionId, roomId, order }` (indeks 2k vs 2k+1; dikunci setelah laga ruangan dimulai) — admin |
| `GET /api/participants/summary` | Ringkasan kelengkapan: isi tiap sesi × ruangan, belum ditempatkan, status pasangan babak 1, `checks` & `ready` — admin |
| `GET /api/admin/summary?aktivitas=` | Ringkasan dashboard admin: progres laga per sesi, juara ruangan, laga berikutnya, total pelanggaran, perlu perhatian, aktivitas terbaru, status ruangan — admin |
| `GET /api/admin/summary/revision` | Penanda versi ringkasan dashboard `{ version }` (bagan, pelanggaran, akun) untuk polling berkala, ETag/304 — admin |
| `GET /api/admin/rooms?sesi=` | Pantau semua ruangan pada sesi (default sesi aktif): status, laga berjalan & berikutnya, juara, pelanggaran, pengawas aktif — admin |
| `GET /api/admin/matches/:id` | Detail laga untuk admin: hasil & foto bukti, asal slot, laga berikutnya, jejak audit hasil, pelanggaran di laga itu — admin |
| `GET/POST /api/admin/pengawas` · `GET/PATCH/DELETE /api/admin/pengawas/:id` | Akun pengawas `{ name, email, roomId, password, active? }`; pindah ruangan / ganti sandi / nonaktif mengakhiri sesi login; hapus ditolak 409 bila sudah punya jejak — admin |
