# Panduan Instalasi RuangCohort v1.1

Ada 2 bagian: **A. Backend** (Google Apps Script) dan **B. Frontend** (GitHub Pages). Kerjakan A dulu.

## A. Backend (±10 menit)
1. Buka https://script.google.com → **Proyek baru**. Beri nama `RuangCohort`.
2. Ganti nama berkas `Code.gs` menjadi `Kode`, hapus isinya, lalu **tempel seluruh isi `Kode.gs`**. Klik **+ → Script**, beri nama `Modul`, lalu **tempel seluruh isi `Modul.gs`**. Klik **Simpan**.
   - Buka **Project Settings (⚙️) → Time zone** → pilih `Asia/Jakarta` agar pengingat H-1 tepat waktu.
3. Di dropdown fungsi pilih **`setupAppEnvironment`** → **▶ Jalankan** (HANYA SEKALI; aman bila terpaksa diulang, data tidak tertimpa).
   - Klik **Tinjau izin** → izinkan akses Drive, Sheets, Slides, Gmail, dan koneksi eksternal (untuk Fonnte).
   - Buka **Log eksekusi**. Catat **email dan sandi admin awal** — sandi hanya tampil sekali.
   - Hasilnya: folder 📁 RuangCohort di Drive, spreadsheet 🗃️ Database dengan 10 sheet, dan 3 trigger otomatis (pemroses antrean notifikasi tiap 1 menit, pengingat harian, pemanas cache).
4. **Deploy → Deployment baru → Aplikasi web**: *Jalankan sebagai* **Saya**, *Yang memiliki akses* **Siapa saja** → **Deploy** → salin **URL `/exec`**.
5. Tes: buka URL `/exec` di browser, harus muncul `{"success":true,"app":"RuangCohort"...}`.
6. Bila lupa sandi admin: jalankan fungsi `resetSandiAdmin`, sandi baru ada di Log eksekusi.

> **Sudah memasang v1.0?** Tempel `Kode.gs` baru, tambahkan berkas `Modul`, jalankan `setupAppEnvironment` lagi (aman: data dan rahasia tidak berubah; hanya menambah kolom/sheet baru), lalu deploy **Versi baru**.

> Setiap kali kode diubah: **Deploy → Kelola deployment → ✏️ → Versi baru** (jangan buat deployment baru agar URL tetap).

## B. Frontend (GitHub Pages)
Folder kerja = **folder hasil ekstraksi ZIP** (`ruangcohort`), yaitu folder yang berisi `index.html`. Folder inilah yang di-`git init`.
1. Ekstrak ZIP. Buka `js/config.js`, ganti `GANTI_DENGAN_ID_DEPLOYMENT` dengan URL `/exec` dari langkah A4 (satu baris `GAS_URL`).
2. Buat repository **Public** baru di github.com (jangan centang README/.gitignore).
3. Buka terminal **di dalam folder `ruangcohort`**, pastikan `dir` (Windows) / `ls` menampilkan `index.html`, lalu:
```
git init
git add .
git commit -m "RuangCohort v1.0"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
   Saat diminta password, tempel **Personal Access Token** (scope `repo`); layar memang tidak menampilkan karakter.
4. Di GitHub: **Settings → Pages → Deploy from a branch → main / (root) → Save**. Tunggu 1–2 menit, buka `https://USERNAME.github.io/NAMA-REPO/`.
5. Update berikutnya: `git add .` → `git commit -m "update"` → `git push`, lalu **Ctrl+Shift+R**.

## C. Pemakaian pertama
1. Masuk dengan admin awal → **Ganti sandi** (menu kiri bawah).
2. **Pengguna** → tambah instruktur dan peserta.
3. **Cohort** → Buat Cohort → **+ Modul** → **Anggota** (centang peserta & instruktur).
4. **Jadwal** → Tambah Sesi (Online/Offline/Pre-learning). Buka sesi → **+ YouTube** / **+ File**.
5. **Kehadiran** → pilih sesi → catat → Simpan.

## D. Keamanan & performa (ringkas)
- Rahasia (`SESSION_SECRET`, ID spreadsheet/folder) hanya di **Script Properties**; frontend hanya memegang URL `/exec`. Sandi pengguna disimpan sebagai hash + salt, token sesi HMAC 12 jam, dikirim di body POST, dan langsung dicabut bila pengguna dinonaktifkan/sandi diganti.
- Isolasi cohort dijaga **di server**: peserta/instruktur hanya menerima data cohort sendiri; file hanya bisa diunduh lewat aplikasi.
- Cepat: semua data dimuat sekali (`boot`) sehingga pindah menu instan; tampilan langsung dari cache lokal lalu disegarkan di latar; perubahan tampil seketika (optimistic) dan dibatalkan otomatis bila gagal; cache server berversi + pemanas tiap 10 menit (±15–20 menit/hari dari kuota trigger; matikan lewat fungsi `matikanKeepWarm`).
- Jangan menambah editor proyek Apps Script sembarangan (editor bisa melihat Script Properties) dan jangan membagikan spreadsheet database.

## E. Masalah umum
| Gejala | Solusi |
|---|---|
| “Konfigurasi belum lengkap” | `js/config.js` belum diisi URL `/exec` |
| Halaman putih/404 di GitHub Pages | `index.html` tidak di root repo — cek `ls` sebelum `git init` |
| “Sesi berakhir” terus | Deploy ulang sebagai **Versi baru**; pastikan akses “Siapa saja” |
| Perubahan kode tidak terlihat | Deploy → Kelola deployment → Versi baru |
| Edit langsung di Sheets belum tampil | Cache ±15 menit; muat ulang halaman setelahnya |
| Pesan WA menumpuk “Antri” | Pastikan trigger `prosesAntrian` ada (jalankan `setupAppEnvironment`), token benar, perangkat Fonnte `connect` |
| “Template tidak bisa dibuka” | Akun pemilik script harus punya akses ke Slides tersebut |
| Sertifikat gagal dibuat | Cek log eksekusi; pastikan izin Slides sudah disetujui (jalankan ulang `setupAppEnvironment`) |

## F. WhatsApp (Fonnte) & email
1. Daftar di https://fonnte.com → **Device** → scan QR dengan nomor WA lembaga → salin **token**.
2. Menu **Notifikasi** → isi token, *Alamat aplikasi* (URL GitHub Pages Anda), nama institusi → **Simpan** → **Cek perangkat** (harus `connect`) → **Tes WA**.
3. Centang **Aktifkan WhatsApp** / **Aktifkan email** → Simpan. Atur kejadian yang mengirim pesan di tabel *Pemicu* (WA dan/atau email per kejadian).
4. Pesan keluar lewat antrean dan dikirim bertahap oleh trigger tiap 1 menit, jadi tombol di aplikasi tetap instan dan tidak menggagalkan proses utama bila Fonnte sedang gangguan.
5. **Blast**: pilih cohort/semua, tulis pesan (`{nama}` otomatis terisi), masukkan ke antrean. Tips anti-blokir: pakai nomor yang sudah lama aktif, mulai batch 10, jeda 5 detik atau acak `3-8`, jangan kirim tautan yang sama ke ratusan orang dalam 1 jam.
6. Kontak **opt-out** tidak menerima blast (notifikasi sistem seperti pengingat sesi tetap terkirim). Menu **Kontak** → **Deteksi WA** menandai nomor yang terdaftar di WhatsApp (butuh paket Fonnte yang mendukung fitur validasi).
7. Kuota email Gmail biasa ±100/hari, Workspace ±1.500/hari (sisa kuota tampil di menu Notifikasi). Pesan yang gagal dicoba ulang hingga 3 kali.

## G. Sertifikat PDF otomatis
- Menu **Sertifikat** → pilih cohort → centang peserta → **Terbitkan**. Syarat default: progres ≥ 80% (ubah di menu Notifikasi → *Minimal progres*). Admin boleh menerbitkan di bawah syarat setelah konfirmasi.
- Template bawaan dibuat otomatis (Google Slides di folder RuangCohort). Untuk desain sendiri: buat Google Slides, tulis penanda `{{NAMA}} {{PROGRAM}} {{COHORT}} {{NOMOR}} {{TANGGAL}} {{KODE_VERIFIKASI}} {{URL_VERIFIKASI}}`, tempel link-nya di menu Notifikasi → *Template sertifikat*. Template asli tidak pernah diubah (selalu disalin dulu).
- Nomor, kode verifikasi, dan tanggal dibuat server. Peserta mengunduh PDF dari menu **Sertifikat**; bila WA/email aktif, pemberitahuan terkirim otomatis.
- **Verifikasi publik**: tautan `…/#/verifikasi/KODE` (juga ada di halaman login) menunjukkan nama, program, dan nomor tanpa data pribadi lain. **Tarik** sertifikat bila perlu: verifikasi langsung menyatakan tidak valid.
- Pembuatan PDF ±3–5 detik per peserta; aplikasi memprosesnya per 5 orang secara berurutan.

## H. Impor data lama / CSV
- Menu **Kontak → ⬆ Impor**. Kolom: `nama, email, wa, role, cohort` (judul kolom lain seperti `no hp`, `angkatan` juga dikenali). Bisa dari berkas CSV (pemisah koma, titik koma, atau tab), tempel teks, atau **link Google Sheets lama** (sheet pertama; Anda harus punya akses baca).
- Selalu klik **Pindai dulu**: hanya menghitung dan menampilkan peringatan, tanpa menulis apa pun. Setelah yakin, klik **Impor**.
- Aman diulang: email yang sudah ada tidak digandakan; **peran, status, dan sandi tidak pernah ditimpa**; nomor WA dinormalisasi (`81234…` → `081234…`). Peran `admin` tidak bisa diimpor. Maksimal 500 baris per impor.
- Pengguna baru mendapat **sandi acak yang tampil sekali** di hasil impor: salin dan bagikan langsung, lalu minta mereka mengganti sandinya. Sandi tidak tersimpan dalam bentuk terbaca.
