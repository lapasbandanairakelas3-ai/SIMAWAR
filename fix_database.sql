-- ============================================================
-- FIX DATABASE v8 — Jalankan SATU PER SATU di SQL Editor
-- ============================================================

-- ── STEP 1: Tambah kolom is_admin ───────────────────────────
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- ── STEP 2: Migrasi role → is_admin (jika kolom role masih ada) ──
-- Cek dulu apakah kolom role masih ada:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='pegawai' AND column_name='role'
  ) THEN
    UPDATE pegawai SET is_admin = (role = 'admin');
    ALTER TABLE pegawai DROP COLUMN role;
    RAISE NOTICE 'Kolom role berhasil dihapus dan dimigrasikan ke is_admin';
  ELSE
    RAISE NOTICE 'Kolom role tidak ada (sudah dihapus sebelumnya)';
  END IF;
END $$;

-- ── STEP 3: Set admin berdasarkan username ───────────────────
-- Ganti 'admin' jika username admin Anda berbeda
UPDATE pegawai SET is_admin = true WHERE username = 'admin';

-- Verifikasi:
SELECT id, nama, username, is_admin FROM pegawai ORDER BY is_admin DESC;

-- ── STEP 4: Tambah kolom shift ke absen_detail ──────────────
ALTER TABLE absen_detail ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi';
UPDATE absen_detail SET shift = 'Pagi' WHERE shift IS NULL;

-- Hapus constraint lama (jika error "already exists") lalu buat baru:
DO $$
BEGIN
  ALTER TABLE absen_detail 
    ADD CONSTRAINT absen_detail_shift_check 
    CHECK (shift IN ('Pagi','Siang','Sore'));
  RAISE NOTICE 'Constraint shift berhasil dibuat';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint shift sudah ada, tidak perlu dibuat ulang';
END $$;

-- ── STEP 5: Tambah kolom shift ke absen_session ─────────────
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi';
UPDATE absen_session SET shift = 'Pagi' WHERE shift IS NULL;

-- ── STEP 6: Rebuild unique indexes ──────────────────────────
DROP INDEX IF EXISTS idx_absen_wbp_hari;
DROP INDEX IF EXISTS idx_absen_wbp_hari_shift;
DROP INDEX IF EXISTS idx_sesi_aktif;
DROP INDEX IF EXISTS idx_sesi_aktif_shift;

CREATE UNIQUE INDEX IF NOT EXISTS idx_absen_wbp_hari_shift 
  ON absen_detail(wbp_id, tanggal, shift);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sesi_aktif_shift 
  ON absen_session(blok_id, tanggal, shift) WHERE selesai = false;

-- ── STEP 7: Tutup sesi lama ─────────────────────────────────
UPDATE absen_session SET selesai = true WHERE tanggal < CURRENT_DATE;

-- ── STEP 8: Verifikasi final ─────────────────────────────────
SELECT 
  'pegawai' as tabel,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'pegawai'
  AND column_name IN ('is_admin','role','status')
UNION ALL
SELECT 
  'absen_detail',
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'absen_detail'
  AND column_name IN ('shift','status');

-- ── STEP 9: Hapus tabel absen_session (tidak dipakai lagi) ──
-- Karena tidak pakai sesi rupam, hapus juga index-nya:
-- DROP INDEX IF EXISTS idx_sesi_aktif_shift;
-- DROP TABLE IF EXISTS absen_session;

-- Atau cukup kosongkan saja (aman):
-- TRUNCATE absen_session;

-- ── STEP 10: Update status absen yang masih Di Kamar/Lainnya menjadi Hadir ──
-- Karena sekarang hanya 1 status: Hadir
-- Update constraint dulu:
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_status_check;
-- Ganti semua status ke Hadir karena sistem baru hanya pakai Hadir
UPDATE absen_detail SET status = 'Hadir' WHERE status IN ('Di Kamar','Lainnya','Di Bengkel','Di Kebun','Di Rumah Sakit');
-- Tambah constraint baru
ALTER TABLE absen_detail ADD CONSTRAINT absen_detail_status_check CHECK (status = 'Hadir');

-- ── STEP 11: Tabel status_absen (admin bisa kelola opsi status) ──
CREATE TABLE IF NOT EXISTS status_absen (
  id         uuid default gen_random_uuid() primary key,
  nama       text not null unique,
  urutan     int default 0,
  aktif      boolean default true,
  created_at timestamptz default now()
);

-- Insert default status
INSERT INTO status_absen (nama, urutan) VALUES
  ('Ada',           1),
  ('Di Bengkel',    2),
  ('Di Kebun',      3),
  ('Di Rumah Sakit',4)
ON CONFLICT (nama) DO NOTHING;

-- RLS
ALTER TABLE status_absen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_sa" ON status_absen;
CREATE POLICY "p_sa" ON status_absen FOR ALL USING (true) WITH CHECK (true);

-- Update constraint absen_detail - hapus dulu, biarkan bebas (status diambil dari tabel)
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_status_check;

-- Update data lama: Hadir -> Ada
UPDATE absen_detail SET status = 'Ada' WHERE status = 'Hadir';
