# Bracket LRP 2026

Bagan turnamen 1 vs 1 LRP 2026. Next.js (App Router) + Tailwind + shadcn/ui, SQLite + Drizzle ORM.

## Menjalankan

```bash
npm install
npm run db:setup   # migrasi + seed (4 sesi, 3 ruangan, 10 ruangan-sesi, 640 peserta)
npm run dev        # http://localhost:3000
```

## Format turnamen

- **Ruangan per sesi** — daftar ruangan dipakai bersama; admin memilih ruangan
  yang dipakai tiap sesi di `/admin/ruangan` (tabel `session_rooms`). Tiap
  ruangan-sesi berisi **64 peserta → 63 laga** (babak 1–6, gugur), juaranya
  satu orang.
- **Semifinal** (babak 7) — juara ruangan-sesi dipasangkan (bisa diatur admin di
  `/admin/peserta/semifinal`), **best of 3**: skor = game dimenangkan, yang
  lebih dulu 2 menang. Jumlah ruangan-sesi harus genap dan minimal 4.
- **Final** (babak 8) — pemenang semifinal bertanding **double round-robin**
  (tiap pasangan dua kali, tuan rumah jalan pertama bergantian). Poin: +3 menang
  4 pion berjajar, +2 menang 3 pion, +1 menang 3 pion tercepat, +½ menang 2 pion
  terbanyak, 0 kalah. Klasemen: poin → head-to-head → jumlah menang.
- **Nama pengawas per laga** — diisi admin (`/admin/laga/:id` atau isi massal di
  `/admin/pantau/:ruangan`), disimpan di tabel terpisah `match_officials` dan
  tidak pernah ikut di data publik maupun data pengawas ruangan.
- Admin bisa menginput/mengoreksi hasil laga mana pun dari `/admin/laga/:id`.

## Deploy

Siap deploy ke Railway (Dockerfile + `railway.json`, volume `/app/data`).
Langkahnya di [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md). Variabel lingkungan:
lihat [.env.example](.env.example).

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
| `npm run db:seed -- --dasar` | Hanya sesi, ruangan, & ruangan per sesi contoh (awal untuk data peserta asli; atur lagi di `/admin/ruangan`) |
| `npm run db:buat-bagan [-- --cek] [-- --ganti] [-- --final <ISO>]` | Buat struktur bagan (63 laga per ruangan-sesi + semifinal + final round-robin) dari penempatan peserta; `--final` = jam mulai semifinal; juga tombol di `/admin/peserta` |
| `npm run db:seed -- --reset` | Kosongkan data turnamen lalu isi ulang (akun tidak dihapus) |
| `npm run db:create-admin -- --email <email> [--name <nama>] --password <sandi>` | Buat akun admin utama (atau setel ulang sandinya); sandi juga bisa lewat env `ADMIN_PASSWORD` |
| `npm run db:import-peserta -- peserta.csv [--dry-run] [--replace]` | Impor peserta dari CSV (format: `data-templates/peserta.csv`); sama dengan tombol **Unggah CSV** di `/admin/peserta` |
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
  Endpoint admin dibungkus `withAdmin` (`src/server/admin-api.ts`): 401 belum login /
  akun nonaktif, 403 bukan admin.
- **Pengawas ruangan** (`/masuk`) — hanya ruangannya sendiri (`/ruangan`, hasil,
  bukti, pelanggaran); aturan di `src/lib/policy.ts`. Endpoint yang terikat ruangan
  dibungkus `withRoomAccess` (`src/server/room-guard.ts`): 401 belum login,
  404 data tidak ada, 403 ruangan lain.
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
| `POST /api/login/ruangan` · `POST /api/login/admin` | Login `{ email, password }` → cookie sesi + `{ user, room, previousLoginAt }`; 401 salah, 403 peran salah/nonaktif, 423 dikunci (Retry-After). Login/logout admin dicatat di `audit_logs` |
| `GET /api/session` · `DELETE /api/session?semua=1` | Sesi saat ini `{ user, room, expiresAt }` (401 bila tidak ada) / keluar (hapus cookie; `semua=1` juga mengakhiri sesi di perangkat lain) |
| `GET /api/bracket?sesi=&ruangan=` | Bagan (opsional difilter), ETag/304 |
| `GET /api/bracket/version` | Versi data bagan (ringan) |
| `GET /api/bracket/stream` | SSE `event: version` setiap ada perubahan |
| `GET /api/health` | Cek server & database (healthcheck Railway) |
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
| `PUT /api/sessions/:id/rooms` | Atur ruangan yang dipakai sesi `{ roomIds }`; ruangan yang dilepas harus kosong dari peserta sesi itu — admin |
| `GET /api/participants?q=&sesi=&ruangan=&hal=&per=` | Cari peserta (nama/ID/sekolah), filter sesi/ruangan (`none` = belum ditempatkan), berhalaman — admin |
| `POST /api/participants` · `GET/PATCH/DELETE /api/participants/:id` | Tambah/lihat/ubah/hapus peserta (hapus ditolak 409 bila sudah masuk bagan) — admin |
| `POST /api/participants/assign` | Pindahkan peserta `{ ids, sessionId?, roomId? }` (null = kosongkan; ganti sesi mengosongkan ruangan; maks. 64 per ruangan per sesi; ruangan harus dipakai sesi itu) — admin |
| `POST /api/participants/auto-assign` | Bagi rata otomatis `{ kind: "sesi", mode }` / `{ kind: "ruangan", mode, sessionId }`, mode `unassigned`/`all`; sekolah disebar — admin |
| `GET /api/pairings?sesi=&ruangan=` · `PUT /api/pairings` | Baca/simpan pasangan babak 1 `{ sessionId, roomId, order }` (indeks 2k vs 2k+1; dikunci setelah laga ruangan dimulai) — admin |
| `GET /api/participants/summary` | Ringkasan kelengkapan: isi tiap sesi × ruangan, belum ditempatkan, status pasangan babak 1, `checks` & `ready` — admin |
| `GET /api/admin/summary?aktivitas=` | Ringkasan dashboard admin: progres laga per sesi, juara ruangan, laga berikutnya, total pelanggaran, perlu perhatian, aktivitas terbaru, status ruangan — admin |
| `GET /api/admin/summary/revision` | Penanda versi ringkasan dashboard `{ version }` (bagan, pelanggaran, akun) untuk polling berkala, ETag/304 — admin |
| `GET /api/admin/rooms?sesi=` | Pantau semua ruangan pada sesi (default sesi aktif): status, laga berjalan & berikutnya, juara, pelanggaran, pengawas aktif — admin |
| `GET /api/admin/matches/:id` | Detail laga untuk admin: hasil & foto bukti, asal slot, laga berikutnya, jejak audit hasil, pelanggaran di laga itu — admin |
| `GET/POST /api/admin/pengawas` · `GET/PATCH/DELETE /api/admin/pengawas/:id` | Akun pengawas `{ name, email, roomId, password, active? }`; pindah ruangan / ganti sandi / nonaktif mengakhiri sesi login; hapus ditolak 409 bila sudah punya jejak — admin |
| `POST /api/admin/pengawas/:id/logout` | Keluarkan akun pengawas dari semua perangkat → `{ revoked }` — admin |
| `POST /api/admin/pengawas/generate` | `{ domain? }` buat akun (sandi acak, ditampilkan sekali) untuk tiap ruangan tanpa pengawas aktif — admin |
| `GET /api/admin/audit?batas=` | Jejak aksi admin: login/logout, buat/ubah/nonaktif/hapus akun, keluarkan sesi — admin |
| `GET/POST /api/admin/bracket/structure` | Status struktur bagan / buat `{ finalStart?, replace?, dryRun? }` dari penempatan peserta (422 + `errors` bila belum lengkap) — admin |
| `GET /api/admin/recap/results?sesi=&ruangan=&status=&babak=&q=&koreksi=1&hal=&per=` | Rekap hasil per laga (skor, pemenang, pencatat, waktu catat, koreksi, bukti) berhalaman + ringkasan progres & juara — admin |
| `GET /api/admin/recap/violations?sesi=&ruangan=&jenis=&q=&tampilan=peserta&hal=&per=` | Rekap pelanggaran: ringkasan (jumlah, peserta, berulang, per jenis/ruangan) + daftar catatan atau per peserta, berhalaman — admin |
| `GET /api/admin/recap/export?laporan=hasil\|pelanggaran\|juara&sesi=&ruangan=&pemisah=koma` | Unduh laporan CSV (UTF-8 + BOM, default pemisah `;` untuk Excel Indonesia); tercatat di `audit_logs` — admin |
| `GET /api/admin/session` · `DELETE /api/admin/session[?semua=1 \| ?id=<sesi>]` | Perangkat tempat admin login / logout admin (semua perangkat, atau akhiri satu sesi lain); tercatat di `audit_logs` — admin |
