# Bracket LRP 2026

Bagan turnamen 1 vs 1 LRP 2026: 640 peserta, 4 sesi, 10 ruangan.
Next.js (App Router) + Tailwind + shadcn/ui, SQLite + Drizzle ORM.

## Menjalankan

```bash
npm install
npm run db:setup   # migrasi + seed (4 sesi, 10 ruangan, 640 peserta)
npm run dev        # http://localhost:3000
```

## Database

| Perintah | Fungsi |
| --- | --- |
| `npm run db:generate` | Buat file migrasi baru dari `src/db/schema.ts` |
| `npm run db:migrate` | Terapkan migrasi di `drizzle/` |
| `npm run db:seed` | Isi sesi, ruangan, peserta yang belum ada (aman diulang) |
| `npm run db:seed -- --reset` | Kosongkan data turnamen lalu isi ulang (akun tidak dihapus) |
| `npm run db:studio` | Buka Drizzle Studio |

Berkas database default ada di `data/bracket.db`; ubah lewat env `DATABASE_PATH`
(mis. ke volume persisten saat deploy).
