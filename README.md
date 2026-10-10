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
| `npm run db:studio` | Buka Drizzle Studio |

Berkas database default ada di `data/bracket.db`; ubah lewat env `DATABASE_PATH`
(mis. ke volume persisten saat deploy). Foto bukti disimpan di `data/uploads`
(env `UPLOAD_DIR`) dan disajikan lewat `/api/bukti/:file`.

## Sumber data & live update

- Default, halaman membaca database. Set `BRACKET_DATA_SOURCE=mock` untuk demo
  dengan simulasi turnamen berjalan (tanpa database).
- Live update: halaman berlangganan `GET /api/bracket/stream` (Server-Sent Events)
  dan hanya me-refresh saat versi bagan (`bracket_state.version`) berubah.
  Bila SSE tidak tersedia, klien polling `GET /api/bracket/version` (ETag/304).

## API

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/bracket?sesi=&ruangan=` | Bagan (opsional difilter), ETag/304 |
| `GET /api/bracket/version` | Versi data bagan (ringan) |
| `GET /api/bracket/stream` | SSE `event: version` setiap ada perubahan |
| `GET /api/matches/:id` | Detail satu pertandingan |
| `POST /api/matches/:id/proof` | Unggah foto bukti (multipart `photo`, JPEG/PNG/WebP ≤ 5 MB) |
| `DELETE /api/matches/:id/result` | Batalkan hasil (salah input) selama laga berikutnya belum dimulai |
| `PUT /api/matches/:id/result` | Simpan/koreksi hasil (pengawas ruangan / admin); `proofPhotoUrl` harus hasil unggah untuk laga itu |
| `GET /api/bukti/:file` | Foto bukti tersimpan |
| `GET /api/rooms/:id/violations?sesi=` | Pelanggaran ruangan + total per jenis/peserta |
| `GET /api/participants/:id/violations` | Riwayat pelanggaran peserta (pengawas: ruangannya; admin: semua) |
| `GET /api/rooms/:id/matches?sesi=` · `GET /api/rooms/:id/history?sesi=` | Laga & riwayat hasil ruangan |
| `POST /api/violations` | Catat pelanggaran (`participantId`, `matchId?`, `roomId?`, `type`, `note?`, `occurredAt?`) |
