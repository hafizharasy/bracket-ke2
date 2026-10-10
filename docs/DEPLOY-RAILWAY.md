# Deploy ke Railway

Aplikasi berjalan sebagai **satu layanan** dengan **volume** untuk database
SQLite dan foto bukti. Jangan menaikkan jumlah replika: live update dan
database berkas hanya benar di satu instance.

## 1. Buat layanan

1. Masuk ke [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** →
   pilih repo ini (branch yang akan dipakai, mis. `main`).
2. Railway membaca `railway.json` dan membangun dari `Dockerfile` secara otomatis.
   Deploy pertama akan **gagal sampai langkah 2 & 3 selesai** — itu wajar.

## 2. Pasang volume

Layanan → **Settings → Volumes → Add Volume**, *mount path*: **`/app/data`**.

Di sini tersimpan `bracket.db` dan folder `uploads/`. Tanpa volume, semua data
hilang setiap redeploy.

## 3. Isi Variables

Layanan → **Variables**:

| Nama | Isi |
| --- | --- |
| `BETTER_AUTH_SECRET` | Kunci acak panjang — buat dengan `openssl rand -hex 32`. **Wajib**; server menolak berjalan tanpanya. Jangan diganti setelah acara mulai (semua orang akan ter-logout). |
| `BETTER_AUTH_URL` | Opsional. Kosongkan bila memakai domain `*.up.railway.app`; isi `https://domain-anda` bila memakai domain sendiri. |

`DATABASE_PATH`, `UPLOAD_DIR`, `PORT`, dan `NODE_ENV` sudah diatur di Dockerfile.

## 4. Domain

**Settings → Networking → Generate Domain** (atau **Custom Domain** lalu arahkan
CNAME dari DNS domain Anda). HTTPS otomatis.

Setelah Variables & volume terisi, klik **Redeploy**. Setiap start, server
menjalankan migrasi database dulu, lalu cek `GET /api/health` harus `{"ok":true}`.

## 5. Isi data pertama (sekali)

Buka shell layanan: di dasbor **⋮ → SSH** / atau `railway ssh` (Railway CLI), lalu:

```bash
# Akun admin utama pertama (sandi lewat env supaya tidak tercatat di riwayat shell)
ADMIN_PASSWORD='sandi-yang-kuat' npm run db:create-admin -- --email admin@domain.id --name "Admin Utama"

# A) Uji coba dengan data contoh (640 peserta fiktif + bagan lengkap):
npm run db:seed

# B) Data asli:
npm run db:seed -- --dasar                              # sesi & ruangan contoh saja (atur di /admin/ruangan)
npm run db:import-peserta -- peserta.csv --dry-run      # cek CSV (format: data-templates/peserta.csv)
npm run db:import-peserta -- peserta.csv                # simpan
npm run db:buat-bagan -- --cek                          # cek kelengkapan penempatan
npm run db:buat-bagan                                   # buat semua laga (bisa juga lewat tombol di /admin/peserta)
```

> `db:seed` di production **tidak** membuat akun contoh — akun pengawas dibuat
> admin dari `/admin/pengawas` (tombol buat akun untuk ruangan yang belum punya
> pengawas; sandi ditampilkan sekali, bagikan ke tiap pengawas).

Lalu masuk ke `https://domain-anda/masuk/admin`. Di **Ruangan & Sesi**, tambah/hapus
ruangan dan centang ruangan yang dipakai tiap sesi (64 peserta per ruangan). Peserta yang belum punya
sesi/ruangan di CSV bisa dibagi dari **Peserta & Jadwal** (bagi rata otomatis),
lalu klik **Buat struktur bagan** di halaman yang sama. Atur jam sesi di
**Ruangan & Sesi**, pasangan babak 1 di tab **Pasangan Tanding**, dan pasangan
semifinal di tab **Pasangan Semifinal** sebelum hari-H. Nama pengawas tiap laga
diisi di **Pantau Ruangan → ruangan** (rahasia, hanya admin).

### Memperbarui dari versi format 16 peserta

Migrasi berjalan otomatis saat start. Data lama (bagan 16 peserta) tidak cocok
dengan format baru, jadi kosongkan dan isi ulang lewat shell: `npm run db:seed -- --reset`
(data contoh) atau `npm run db:seed -- --reset --dasar` lalu impor peserta asli.

Peserta bisa juga ditambah langsung dari website: **Peserta & Jadwal → Unggah CSV**
(pilih berkas, periksa daftar masalah, lalu Simpan) atau **Tambah peserta** satu per satu.

Untuk membawa CSV ke server lewat shell, buat berkasnya (`cat > peserta.csv`,
tempel isinya, lalu Ctrl+D). Jangan memakai `railway run` dari komputer lokal:
perintah itu berjalan di komputer Anda, bukan di volume server.

## 6. Backup

- Aktifkan **Volume Backups** di pengaturan volume (jadwal harian), dan buat
  backup manual sebelum hari-H.
- Unduh rekap CSV dari `/admin/rekap/unduh` secara berkala selama acara.

## Catatan

- Redeploy menghentikan layanan beberapa detik (volume tidak bisa dipakai dua
  instance sekaligus). Hindari redeploy saat pertandingan berlangsung.
- Log: tab **Deployments → View logs**. Status: `GET /api/health`.
- Uji di lokal dengan Docker:
  `docker build -t bracket-lrp . && docker run -p 3000:3000 -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) -e BETTER_AUTH_URL=http://localhost:3000 -v bracketdata:/app/data bracket-lrp`
