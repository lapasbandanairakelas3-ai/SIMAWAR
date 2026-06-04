// ============================================================
// USER.JS — Logika halaman petugas/user
// ============================================================

let currentUser = null;
let selectedBlok = null;
let absenData = {}; // { wbpId: { status: 'Hadir'|'Tidak Hadir', keterangan: '' } }
let wbpList = [];
let activeSessionId = null;

// ============================================================
// INIT
// ============================================================
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { data: p } = await sb.from('pegawai').select('*').eq('user_id', session.user.id).maybeSingle();
  if (!p) { await sb.auth.signOut(); window.location.href = 'index.html'; return; }
  currentUser = p;

  document.getElementById('headerUname').textContent = p.nama;
  document.getElementById('headerRole').textContent = p.jabatan || 'Regu Pengamanan';
  document.getElementById('headerAvatar').textContent = p.nama?.charAt(0)?.toUpperCase() || 'P';

  const now = new Date();
  document.getElementById('headerDate').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  await loadSiteConfigUser();
  await loadBlokPicker();

  // Set today dates
  const today = now.toISOString().split('T')[0];
  document.getElementById('myRiwayatDari').value = today;
  document.getElementById('myRiwayatSampai').value = today;

  // Nav routing handled via onclick in HTML

  setTimeout(() => {
    document.getElementById('splashScreen').classList.add('hiding');
    setTimeout(() => {
      document.getElementById('splashScreen').style.display = 'none';
      document.getElementById('appShell').style.display = 'block';
    }, 600);
  }, 1800);
}

async function loadSiteConfigUser() {
  try {
    const { data } = await sb.from('site_config').select('*').maybeSingle();
    if (!data) return;
    if (data.site_name) {
      document.title = `Petugas — ${data.site_name}`;
      document.getElementById('sidebarName').textContent = data.site_name;
      document.getElementById('splashTitle').textContent = data.site_name;
    }
    if (data.logo_url) {
      document.getElementById('sidebarLogoEmoji').style.display = 'none';
      const img = document.createElement('img');
      img.src = data.logo_url; img.alt = 'Logo';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px';
      document.getElementById('sidebarLogo').appendChild(img);
    }
    if (data.favicon_url) document.getElementById('faviconEl').href = data.favicon_url;
    window.GAS_URL = data.gas_url || APPS_SCRIPT_URL;
  } catch(e) {}
}

function goPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

  const titles = { absen: 'Kelola Absensi', riwayat: 'Riwayat Saya', profil: 'Profil Saya' };
  document.getElementById('headerTitle').textContent = titles[page] || page;

  if (page === 'riwayat') { loadMyRiwayatFilters(); loadMyRiwayat(); }
  if (page === 'profil') loadProfil();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mobileOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('show');
}

function openModal(id) {
  const m = document.getElementById(id);
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('show'));
}
function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.remove('show');
  setTimeout(() => m.style.display = 'none', 300);
}

async function doLogout() {
  // Release active session jika ada
  if (activeSessionId) await releaseSession();
  showConfirm('Keluar', 'Yakin ingin keluar?', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  });
}

// ============================================================
// BLOK PICKER
// ============================================================
async function loadBlokPicker() {
  const grid = document.getElementById('blokPickerGrid');
  grid.innerHTML = [1,2,3,4,5,6].map(() => `<div class="animate-pulse bg-gray-100 rounded-2xl h-28"></div>`).join('');

  try {
    // Load bloks
    const { data: bloks } = await sb.from('blok').select('*, wbp(count)').order('nama');
    if (!bloks?.length) {
      grid.innerHTML = `<div class="col-span-full empty-state py-8"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg></div><div class="empty-title">Belum Ada Blok</div><div class="empty-desc">Admin belum menambahkan blok/kamar hunian</div></div>`;
      return;
    }

    // Get active sessions for today
    const today = new Date().toISOString().split('T')[0];
    let activeSessions = [];
    try {
      const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
      const r = await fetch(`${gasUrl}?action=getActiveSessions&tanggal=${today}`);
      const d = await r.json();
      activeSessions = d.sessions || [];
    } catch(e) {}

    grid.innerHTML = bloks.map(b => {
      const session = activeSessions.find(s => s.blok_id === b.id);
      const isMySession = session?.pegawai_id === currentUser.id;
      const inUseByOther = session && !isMySession;
      const wbpCount = b.wbp?.[0]?.count || 0;

      if (inUseByOther) {
        return `<div class="blok-card in-use disabled" title="Sedang dipakai oleh ${session.pegawai_nama}">
          <div class="blok-icon">🔒</div>
          <div class="blok-name">${b.nama}</div>
          <div class="blok-count">${wbpCount} WBP</div>
          <div class="blok-user">${session.pegawai_nama}</div>
        </div>`;
      }

      if (isMySession) {
        return `<div class="blok-card selected" onclick="selectBlok('${b.id}','${b.nama}','${session.session_id}')">
          <div class="blok-icon">📋</div>
          <div class="blok-name">${b.nama}</div>
          <div class="blok-count">${wbpCount} WBP</div>
          <div class="blok-user" style="color:#3b82f6">Sesi Anda</div>
        </div>`;
      }

      return `<div class="blok-card" onclick="selectBlok('${b.id}','${b.nama}',null)">
        <div class="blok-icon">🏠</div>
        <div class="blok-name">${b.nama}</div>
        <div class="blok-count">${wbpCount} WBP</div>
        <div class="blok-user" style="color:#10b981">✓ Tersedia</div>
      </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div class="col-span-full empty-state"><div class="empty-title">Gagal Memuat</div><div class="empty-desc">Periksa koneksi internet Anda</div></div>`;
  }
}

async function selectBlok(blokId, blokNama, existingSessionId) {
  selectedBlok = { id: blokId, nama: blokNama };
  activeSessionId = existingSessionId;

  // Claim session di GAS (lock blok)
  if (!existingSessionId) {
    try {
      const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startSession',
          blok_id: blokId,
          blok_nama: blokNama,
          pegawai_id: currentUser.id,
          pegawai_nama: currentUser.nama,
          pegawai_jabatan: currentUser.jabatan || '',
          tanggal: new Date().toISOString().split('T')[0]
        })
      });
      const d = await r.json();
      activeSessionId = d.session_id;
    } catch(e) {
      showAlert('warning', 'Perhatian', 'Tidak bisa terhubung ke server absensi. Melanjutkan secara offline.');
    }
  }

  // Tampilkan step 2
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  document.getElementById('selectedBlokName').textContent = `Blok: ${blokNama}`;
  absenData = {};

  await loadWbpForAbsen(blokId);
}

async function loadWbpForAbsen(blokId) {
  const grid = document.getElementById('wbpAbsenGrid');
  grid.innerHTML = [1,2,3,4,5,6,8].map(() => `${skeletonCard()}`).join('');

  const { data: wbps } = await sb.from('wbp').select('*').eq('blok_id', blokId).order('nama');
  wbpList = wbps || [];

  if (!wbpList.length) {
    grid.innerHTML = `<div class="col-span-full empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg></div><div class="empty-title">Tidak Ada WBP</div><div class="empty-desc">Belum ada WBP yang terdaftar di blok ini</div></div>`;
    document.getElementById('absenActionBar').style.display = 'none';
    return;
  }

  renderWbpCards();
  document.getElementById('absenActionBar').style.display = 'block';
  updateProgress();
}

function renderWbpCards() {
  const grid = document.getElementById('wbpAbsenGrid');
  grid.innerHTML = wbpList.map(w => {
    const d = absenData[w.id];
    const isHadir = d?.status === 'Hadir';
    const isTidak = d?.status === 'Tidak Hadir';
    return `<div class="wbp-card ${isHadir ? 'hadir' : isTidak ? 'tidak-hadir' : ''}" id="wcard-${w.id}">
      <div class="wbp-card-photo">
        ${w.foto_url
          ? `<img src="${w.foto_url}" alt="${w.nama}" loading="lazy"/>`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#dbeafe,#e0e7ff);font-size:36px;font-weight:800;color:#3b82f6">${w.nama?.charAt(0) || '?'}</div>`
        }
      </div>
      <div class="wbp-card-info">
        <div class="wbp-card-name">${w.nama}</div>
        <div class="wbp-card-noreg">${w.no_registrasi || '—'}</div>
        ${d?.keterangan ? `<div style="font-size:9px;color:#ef4444;margin-top:3px;font-style:italic">${d.keterangan}</div>` : ''}
        <div class="wbp-card-status">
          <button class="btn-hadir ${isHadir ? 'active' : ''}" onclick="setStatus('${w.id}','Hadir')">✓ Hadir</button>
          <button class="btn-tidak ${isTidak ? 'active' : ''}" onclick="setStatusTidak('${w.id}','${w.nama.replace(/'/g,"\\'")}')">✗ Tidak</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setStatus(wbpId, status) {
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = status;
  if (status === 'Hadir') delete absenData[wbpId].keterangan;
  renderWbpCards();
  updateProgress();
}

function setStatusTidak(wbpId, wbpNama) {
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = 'Tidak Hadir';
  // Open keterangan modal
  document.getElementById('ketWbpId').value = wbpId;
  document.getElementById('ketWbpName').textContent = wbpNama;
  document.getElementById('ketAlasan').value = absenData[wbpId]?.keterangan?.split(' - ')[0] || '';
  document.getElementById('ketDetail').value = '';
  openModal('ketModal');
  renderWbpCards();
  updateProgress();
}

function saveKeterangan() {
  const wbpId = document.getElementById('ketWbpId').value;
  const alasan = document.getElementById('ketAlasan').value;
  const detail = document.getElementById('ketDetail').value.trim();
  if (!alasan) { showAlert('warning', 'Perhatian', 'Pilih alasan terlebih dahulu!'); return; }
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = 'Tidak Hadir';
  absenData[wbpId].keterangan = detail ? `${alasan} - ${detail}` : alasan;
  closeModal('ketModal');
  renderWbpCards();
  updateProgress();
}

function updateProgress() {
  const total = wbpList.length;
  const done = Object.keys(absenData).length;
  const hadir = Object.values(absenData).filter(d => d.status === 'Hadir').length;
  const tidak = Object.values(absenData).filter(d => d.status === 'Tidak Hadir').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = `${done} / ${total}`;
  document.getElementById('hadirCount').textContent = `${hadir} Hadir`;
  document.getElementById('tidakHadirCount').textContent = `${tidak} Tidak Hadir`;
  document.getElementById('absenSummary').textContent = `${done}/${total} diabsen`;
}

async function backToStep1() {
  if (Object.keys(absenData).length > 0) {
    showConfirm('Kembali', 'Data absensi yang sudah diisi akan hilang. Yakin kembali?', async () => {
      if (activeSessionId) await releaseSession();
      resetStep();
    }, 'warning');
  } else {
    if (activeSessionId) await releaseSession();
    resetStep();
  }
}

async function releaseSession() {
  if (!activeSessionId) return;
  try {
    const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'endSession', session_id: activeSessionId })
    });
  } catch(e) {}
  activeSessionId = null;
}

function resetStep() {
  selectedBlok = null;
  absenData = {};
  wbpList = [];
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step1').style.display = 'block';
  loadBlokPicker();
}

async function submitAbsen() {
  const total = wbpList.length;
  const done = Object.keys(absenData).length;

  if (done === 0) {
    showAlert('warning', 'Belum Ada Absensi', 'Lakukan absensi minimal satu WBP terlebih dahulu!');
    return;
  }

  const unfinished = total - done;
  const msgConfirm = unfinished > 0
    ? `${done} WBP sudah diabsen, ${unfinished} WBP belum. WBP yang belum diabsen tidak akan tercatat. Lanjutkan?`
    : `Semua ${total} WBP telah diabsen. Simpan data absensi?`;

  showConfirm('Simpan Absensi', msgConfirm, async () => {
    const btn = document.getElementById('submitAbsenBtn');
    btn.disabled = true;
    btn.innerHTML = '<span>Menyimpan...</span>';

    try {
      const now = new Date();
      const tanggal = now.toISOString().split('T')[0];
      const waktu = now.toISOString();

      // Build rows for GAS
      const rows = wbpList
        .filter(w => absenData[w.id])
        .map(w => ({
          session_id: activeSessionId || `local_${Date.now()}`,
          waktu,
          tanggal,
          blok_id: selectedBlok.id,
          blok_nama: selectedBlok.nama,
          pegawai_id: currentUser.id,
          pegawai_nama: currentUser.nama,
          pegawai_jabatan: currentUser.jabatan || '',
          wbp_id: w.id,
          wbp_nama: w.nama,
          no_registrasi: w.no_registrasi || '',
          status: absenData[w.id].status,
          keterangan: absenData[w.id].keterangan || ''
        }));

      const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveAbsen', rows })
      });
      const d = await r.json();

      if (d.success === false) throw new Error(d.message || 'Gagal menyimpan');

      showAlert('success', 'Absensi Tersimpan!', `${rows.length} data absensi berhasil dicatat`);
      activeSessionId = null;
      resetStep();
    } catch(e) {
      showAlert('error', 'Gagal Menyimpan', e.message || 'Terjadi kesalahan. Coba lagi!');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Selesai & Simpan Absensi';
    }
  });
}

// ============================================================
// RIWAYAT USER
// ============================================================
async function loadMyRiwayatFilters() {
  const blokSel = document.getElementById('myRiwayatBlok');
  if (blokSel.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id, nama').order('nama');
    bloks?.forEach(b => {
      const o = document.createElement('option');
      o.value = b.id; o.textContent = b.nama;
      blokSel.appendChild(o);
    });
  }
}

async function loadMyRiwayat() {
  const search = document.getElementById('myRiwayatSearch').value.trim();
  const dari = document.getElementById('myRiwayatDari').value;
  const sampai = document.getElementById('myRiwayatSampai').value;
  const blok = document.getElementById('myRiwayatBlok').value;
  const tbody = document.getElementById('myRiwayatBody');
  tbody.innerHTML = skeletonRow(7).repeat(4);

  try {
    const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
    const params = new URLSearchParams({
      action: 'getRiwayat',
      pegawai_id: currentUser.id,
      isAdmin: 'false'
    });
    if (dari) params.append('dari', dari);
    if (sampai) params.append('sampai', sampai);
    if (blok) params.append('blok_id', blok);
    if (search) params.append('search', search);

    const r = await fetch(`${gasUrl}?${params}`);
    const d = await r.json();
    const data = d.data || [];
    window._myRiwayatData = data;
    document.getElementById('myRiwayatCount').textContent = `${data.length} data`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-title">Belum Ada Data</div><div class="empty-desc">Belum ada absensi yang Anda lakukan pada periode ini</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((row, i) => `
      <tr class="fade-in">
        <td class="text-gray-400 text-xs">${i + 1}</td>
        <td class="text-xs text-gray-600">${formatTglWaktu(row.waktu)}</td>
        <td><span class="badge badge-blue">${row.blok_nama || '—'}</span></td>
        <td>
          <div class="font-medium text-sm">${row.wbp_nama || '—'}</div>
        </td>
        <td class="text-xs text-gray-500">${row.no_registrasi || '—'}</td>
        <td><span class="badge ${row.status === 'Hadir' ? 'badge-green' : 'badge-red'}">${row.status || '—'}</span></td>
        <td class="text-xs text-gray-500">${row.keterangan || '—'}</td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-title">Gagal Memuat</div><div class="empty-desc">Periksa koneksi ke server absensi</div></div></td></tr>`;
  }
}

function resetMyRiwayat() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('myRiwayatSearch').value = '';
  document.getElementById('myRiwayatDari').value = today;
  document.getElementById('myRiwayatSampai').value = today;
  document.getElementById('myRiwayatBlok').value = '';
  loadMyRiwayat();
}

async function exportRiwayatUser() {
  const data = window._myRiwayatData;
  if (!data?.length) { showAlert('warning', 'Perhatian', 'Tidak ada data untuk diekspor!'); return; }

  const dari = document.getElementById('myRiwayatDari').value;
  const sampai = document.getElementById('myRiwayatSampai').value;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('RIWAYAT ABSENSI WBP', 105, 14, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Petugas: ${currentUser.nama}`, 105, 21, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Periode: ${dari || '—'} s.d. ${sampai || '—'}  |  Dicetak: ${formatTglWaktu(new Date())}`, 105, 27, { align: 'center' });
    doc.line(14, 30, 196, 30);

    doc.autoTable({
      startY: 34,
      head: [['No', 'Waktu', 'Blok/Kamar', 'WBP', 'No. Reg', 'Status', 'Keterangan']],
      body: data.map((row, i) => [
        i + 1, formatTglWaktu(row.waktu), row.blok_nama || '—',
        row.wbp_nama || '—', row.no_registrasi || '—',
        row.status || '—', row.keterangan || '—'
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`riwayat_absen_${currentUser.nama}_${dari}_${sampai}.pdf`);
    showAlert('success', 'Berhasil!', 'Laporan PDF berhasil diunduh');
  } catch(e) {
    showAlert('error', 'Gagal', 'Gagal generate PDF');
  }
}

// ============================================================
// PROFIL
// ============================================================
async function loadProfil() {
  if (!currentUser) return;
  document.getElementById('profilNama').textContent = currentUser.nama || '—';
  document.getElementById('profilJabatan').textContent = currentUser.jabatan || '—';
  document.getElementById('profilNip').textContent = currentUser.nip || '—';
  document.getElementById('profilPangkat').textContent = currentUser.pangkat || '—';
  document.getElementById('profilUsername').textContent = currentUser.username || '—';
  document.getElementById('profilAvatar').textContent = currentUser.nama?.charAt(0)?.toUpperCase() || 'P';

  const { data: { user } } = await sb.auth.getUser();
  document.getElementById('profilEmail').textContent = user?.email || '—';

  // Stats
  try {
    const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const r = await fetch(`${gasUrl}?action=getRiwayat&pegawai_id=${currentUser.id}&dari=${firstOfMonth}&sampai=${today}&isAdmin=false`);
    const d = await r.json();
    const data = d.data || [];
    const uniqueDays = new Set(data.map(row => row.waktu?.split('T')[0])).size;
    const hadirCount = data.filter(r => r.status === 'Hadir').length;
    const tidakCount = data.filter(r => r.status === 'Tidak Hadir').length;

    document.getElementById('userStats').innerHTML = `
      <div class="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
        <div class="text-2xl font-extrabold text-blue-600">${uniqueDays}</div>
        <div class="text-xs text-blue-500 mt-1 font-medium">Hari Bertugas</div>
        <div class="text-xs text-gray-400 mt-0.5">Bulan ini</div>
      </div>
      <div class="text-center p-4 bg-green-50 rounded-xl border border-green-100">
        <div class="text-2xl font-extrabold text-green-600">${hadirCount}</div>
        <div class="text-xs text-green-500 mt-1 font-medium">WBP Hadir</div>
        <div class="text-xs text-gray-400 mt-0.5">Bulan ini</div>
      </div>
      <div class="text-center p-4 bg-red-50 rounded-xl border border-red-100">
        <div class="text-2xl font-extrabold text-red-500">${tidakCount}</div>
        <div class="text-xs text-red-400 mt-1 font-medium">Tidak Hadir</div>
        <div class="text-xs text-gray-400 mt-0.5">Bulan ini</div>
      </div>
    `;
  } catch(e) {
    document.getElementById('userStats').innerHTML = `<div class="col-span-3 text-xs text-center text-gray-400 py-4">Gagal memuat statistik</div>`;
  }
}

async function userSavePassword() {
  const pwd = document.getElementById('userPwdBaru').value;
  const konfirm = document.getElementById('userPwdKonfirm').value;
  if (!pwd) { showAlert('warning', 'Perhatian', 'Password baru harus diisi!'); return; }
  if (pwd.length < 8) { showAlert('warning', 'Perhatian', 'Password minimal 8 karakter!'); return; }
  if (pwd !== konfirm) { showAlert('error', 'Tidak Cocok', 'Konfirmasi password tidak sesuai!'); return; }

  showConfirm('Ganti Password', 'Yakin ingin mengganti password?', async () => {
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    document.getElementById('userPwdBaru').value = '';
    document.getElementById('userPwdKonfirm').value = '';
    showAlert('success', 'Berhasil!', 'Password berhasil diganti');
  });
}

// ============================================================
// START
// ============================================================
init();
