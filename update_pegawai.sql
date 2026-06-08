-- ============================================================
-- UPDATE TABEL PEGAWAI YANG SUDAH ADA DI SUPABASE
-- Jalankan query ini satu per satu di SQL Editor
-- ============================================================

-- STEP 1: Tambah kolom password_plain (jika belum ada)
alter table pegawai add column if not exists password_plain text;

-- STEP 2: Hapus kolom yang tidak dipakai lagi
alter table pegawai drop column if exists jabatan;
alter table pegawai drop column if exists pangkat;
alter table pegawai drop column if exists nip;

-- STEP 3: Hapus constraint NOT NULL & UNIQUE pada email (jika ada)
alter table pegawai alter column email drop not null;

-- STEP 4: Hapus kolom email (setelah langkah 3 berhasil)
alter table pegawai drop column if exists email;

-- STEP 5: Izinkan user_id = NULL (untuk Karupam baru)
alter table pegawai alter column user_id drop not null;

-- STEP 6: Update password_plain untuk admin yang sudah ada
-- (ganti 'PASSWORD_ADMIN_ANDA' dengan password asli admin)
-- update pegawai set password_plain = 'PASSWORD_ADMIN_ANDA' where username = 'admin';

-- STEP 7: Update rupam1 yang sudah ada - set password_plain
-- (ganti 'PASSWORD_RUPAM1' dengan password yang ingin dipakai)
-- update pegawai set password_plain = 'PASSWORD_RUPAM1' where username = 'rupam1';

-- STEP 8: Verifikasi hasil
select id, nama, username, password_plain, role, status, user_id from pegawai;

-- ============================================================
-- SETELAH UPDATE, COBA LOGIN:
-- username: rupam1
-- password: (sesuai password_plain yang di-set di step 7)
-- ============================================================
