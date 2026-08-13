# Teman 360

Aplikasi komunitas internal untuk ASN — Home (nilai Harmonis + dashboard kegiatan),
Seru (daftar & join kegiatan sosial), dan Peduli (galang & bantu donasi).

**Stack:** Frontend statis (HTML/CSS/JS) di GitHub Pages · Backend Google Apps Script · Database Google Sheets.

```
teman360/
├── frontend/                    # yang di-deploy ke GitHub Pages
│   ├── index.html
│   ├── style.css
│   └── app.js                   # isi CONFIG.API_URL di sini
└── google-apps-script/
    ├── Code.gs                  # tempel ke script.google.com
    └── SHEET_STRUCTURE.md       # struktur sheet + langkah deploy backend
```

## Urutan Setup

1. **Backend dulu** — ikuti langkah lengkap di `google-apps-script/SHEET_STRUCTURE.md`
   untuk membuat Google Sheet, menempel `Code.gs`, dan deploy sebagai Web App.
   Kamu akan dapat sebuah URL seperti:
   `https://script.google.com/macros/s/AKfycb.../exec`

2. **Sambungkan frontend ke backend** — buka `frontend/app.js`, ganti:
   ```js
   API_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_DEPLOYMENT_ID/exec'
   ```
   dengan URL dari langkah 1.

3. **Push ke GitHub**
   ```bash
   git init
   git add .
   git commit -m "Teman 360 - initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/teman360.git
   git push -u origin main
   ```

4. **Aktifkan GitHub Pages**
   - Buka repo di GitHub → **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: pilih `/frontend` (atau pindahkan isi folder
     `frontend/` ke root repo bila GitHub Pages kamu tidak mendukung subfolder)
   - Simpan, tunggu 1–2 menit, buka URL yang muncul (mis. `https://username.github.io/teman360/`)

## Fitur yang sudah dibuatkan

- **Login & Daftar** — email + password (di-hash SHA-256), disimpan di sheet `Users`.
- **Home** — banner nilai "Harmonis" (BerAKHLAK) + dashboard kegiatan yang *sudah kamu
  daftarkan*, terpisah antara "Akan Berlangsung" dan "Sudah Selesai" (dihitung otomatis
  dari tanggal kegiatan).
- **Seru** — daftar semua kegiatan (badminton, tenis, jogging, karaoke, kajian, dll),
  klik kartu untuk lihat deskripsi, siapa yang membuat, dan siapa saja yang sudah join,
  tombol **Join**. Tombol **+ Tambah** untuk membuat kegiatan baru.
- **Peduli** — daftar donasi berjalan dengan progress bar, klik untuk lihat deskripsi,
  nomor rekening, dan daftar orang yang sudah membantu. Tombol **+ Ajukan** untuk
  mengajukan donasi baru (deskripsi, target biaya, rentang tanggal, nomor rekening).
  Tombol "Saya Sudah Transfer" mencatat kontribusi (transfer tetap dilakukan manual
  oleh user ke rekening yang tertera — aplikasi tidak memproses pembayaran).

## Yang perlu kamu sesuaikan lagi

- **Keamanan login**: implementasi saat ini menyimpan sesi login sederhana di
  `localStorage` browser tanpa token/expiry — cukup untuk pemakaian internal skala
  kecil, tapi bukan tingkat keamanan production penuh. Untuk enterprise, pertimbangkan
  Google Workspace SSO (`Session.getActiveUser()`) sebagai pengganti email/password.
- **Jumlah kontribusi donasi**: saat ini tombol "Saya Sudah Transfer" tidak meminta
  nominal (karena transfer terjadi di luar sistem). Bila mau menampilkan total
  akumulasi yang akurat, tambahkan input nominal opsional di modal detail donasi
  sebelum submit ke `contribute`.
- **Notifikasi**: belum ada notifikasi email/WA saat ada kegiatan baru atau donasi
  baru. Bisa ditambahkan di `Code.gs` dengan `MailApp.sendEmail()`.
- **Kuota Apps Script**: Web App gratis punya limit ~20.000 request/hari dan sedikit
  lambat (~1 detik per request) karena baca-tulis ke Sheets — cukup untuk komunitas
  kantor, tapi bukan untuk trafik besar.
