# SiHadir — Sistem Kehadiran WBP
## Lapas Kelas III Bandanaira

Website pengecekan kehadiran Warga Binaan Pemasyarakatan (WBP) di blok/kamar hunian.

---

## 📁 Struktur File

```
lapas-bandanaira/
├── index.html          ← Halaman login
├── admin.html          ← Dashboard admin
├── user.html           ← Portal petugas
├── css/
│   └── style.css       ← Semua styling
├── js/
│   ├── config.js       ← Konfigurasi Supabase + utilitas
│   ├── admin.js        ← Logika halaman admin
│   └── user.js         ← Logika halaman petugas
├── gas/
│   └── Code.gs         ← Google Apps Script (absensi)
└── supabase.sql        ← Schema database Supabase
```

---

## ⚙️ Langkah Setup

### 1. Supabase
1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** → paste isi file `supabase.sql` → Run
3. Buka **Storage** → buat 2 bucket public:
   - `wbp-photos`
   - `assets`
4. Catat `Project URL` dan `Anon Key` dari Settings > API

### 2. Google Apps Script
1. Buat Google Sheets baru
2. Buka **Extensions → Apps Script**
3. Hapus kode default, paste isi file `gas/Code.gs`
4. Klik **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin URL deployment

### 3. Konfigurasi Kode
Edit file `js/config.js`, ganti:
```javascript
const SUPABASE_URL = 'https://XXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
```

### 4. Deploy ke Cloudflare Pages
1. Upload semua file ke GitHub repository
2. Buka [pages.cloudflare.com](https://pages.cloudflare.com)
3. **Create Project → Connect to Git**
4. Pilih repository Anda
5. Build settings:
   - **Framework preset:** None
   - **Build command:** (kosong)
   - **Build output directory:** `/` atau `.`
6. **Save and Deploy**

### 5. Buat Akun Admin Pertama
1. Buka Supabase Dashboard → **Authentication → Users**
2. Klik **Add User** → isi email dan password
3. Copy UUID user yang baru dibuat
4. Buka **SQL Editor** → jalankan query di bagian bawah `supabase.sql` dengan UUID tersebut

### 6. Setup Website dari Admin
1. Login dengan akun admin
2. Buka menu **Konfigurasi Website**
3. Isi nama website, deskripsi, upload logo, dan favicon
4. Masukkan URL Google Apps Script
5. Tambahkan blok/kamar di menu **Blok/Kamar**
6. Tambahkan data WBP di menu **Data WBP**
7. Tambahkan petugas di menu **Data Pegawai**

---

## 🔐 Akun Default
Tidak ada akun default. Buat sendiri melalui Supabase Auth + SQL query seperti langkah di atas.

---

## 📱 Fitur

### Admin
- ✅ Dashboard dengan statistik real-time
- ✅ CRUD Data WBP (nama, foto, JK, no registrasi, blok, masa pidana, dll)
- ✅ CRUD Data Pegawai (nama, jabatan, pangkat, username, password)
- ✅ CRUD Blok/Kamar hunian
- ✅ Riwayat absensi semua petugas (filter + ekspor PDF)
- ✅ Konfigurasi website (logo, nama, favicon, GAS URL)

### Petugas
- ✅ Pilih blok sebelum absen (blok dikunci jika sudah dipakai)
- ✅ Absen WBP per blok dengan foto
- ✅ Input keterangan jika WBP tidak hadir
- ✅ Riwayat absensi pribadi (filter + ekspor PDF)
- ✅ Profil & ubah password

---

## 👩‍💻 Kredit
Dibuat dengan ❤️ oleh **WA MIRANTI**
- Instagram: [@wa_miranti](https://instagram.com/wa_miranti)
- TikTok: [@wa_miranti](https://tiktok.com/@wa_miranti)
