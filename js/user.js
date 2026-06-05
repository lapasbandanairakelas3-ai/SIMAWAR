// SIMAWAR — user.js
let currentUser = null;
let selectedKamar = null;
let absenData = {}; // { wbpId: { status, keterangan } }
let wbpList = [];
let activeSessionId = null;

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  // Splash 800ms lalu hapus dari DOM
  setTimeout(() => {
    const s = document.getElementById('splashScreen');
    if (s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 500); }
  }, 800);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'index.html'; return; }

  const { data: p } = await sb.from('pegawai').select('*').eq('user_id', session.user.id).maybeSingle();
  if (!p) { await sb.auth.signOut(); location.href = 'index.html'; return; }
  currentUser = p;

  document.getElementById('headerUname').textContent = p.nama;
  document.getElementById('headerRole').textContent  = p.jabatan || 'Regu Pengamanan';
  document.getElementById('headerAvatar').textContent = p.nama?.[0]?.toUpperCase() || 'P';
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('myRiwayatDari').value  = today;
  document.getElementById('myRiwayatSampai').value = today;

  loadSiteConfigUser().catch(() => {});
  // Langsung load kamar picker di step 1
  loadKamarPicker().catch(() => {});
}

async function loadSiteConfigUser() {
  const { data } = await sb.from('site_config').select('*').maybeSingle();
  if (!data) return;
  if (data.site_name) {
    document.title = `Petugas — ${data.site_name}`;
    document.getElementById('sidebarName').textContent = data.site_name;
    document.getElementById('splashTitle') && (document.getElementById('splashTitle').textContent = data.site_name);
  }
  if (data.logo_url) {
    document.getElementById('sidebarLogoEmoji').style.display = 'none';
    const sl = document.getElementById('sidebarLogo');
    if (!sl.querySelector('img')) {
      const img = document.createElement('img');
      img.src = data.logo_url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px';
      sl.appendChild(img);
    }
  }
  if (data.favicon_url) document.getElementById('faviconEl').href = data.favicon_url;
  window.GAS_URL = data.gas_url || APPS_SCRIPT_URL;
}

// ── NAVIGASI ──────────────────────────────────────────────────
function goPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  ['absen','riwayat','profil'].forEach(id => {
    document.getElementById('nav-' + id)?.classList.toggle('active', id === page);
  });
  const titles = { absen: 'Absensi WBP', riwayat: 'Riwayat Saya', profil: 'Profil Saya' };
  document.getElementById('headerTitle').textContent = titles[page] || page;
  closeSidebar();
  if (page === 'riwayat') { loadMyRiwayatFilters(); loadMyRiwayat(); }
  if (page === 'profil')  loadProfil();
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
  if (activeSessionId) await releaseSession();
  showConfirm('Keluar', 'Yakin ingin keluar?', async () => {
    await sb.auth.signOut(); location.href = 'index.html';
  });
}

// ── STEP 1: KAMAR PICKER ──────────────────────────────────────
async function loadKamarPicker() {
  const grid = document.getElementById('kamarPickerGrid');
  grid.innerHTML = [1,2,3,4,5,6].map(() =>
    `<div class="skel" style="height:100px;border-radius:16px"></div>`
  ).join('');

  const { data: bloks } = await sb.from('blok').select('*, wbp(count)').order('nama');
  if (!bloks?.length) {
    grid.innerHTML = `<div style="grid-column:1/-1" class="empty-state py-8">
      <div class="empty-title">Belum Ada Kamar/Blok</div>
      <div class="empty-desc">Admin belum menambahkan kamar hunian</div>
    </div>`;
    return;
  }

  // Ambil sesi aktif hari ini dari GAS
  let activeSessions = [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await fetch(`${window.GAS_URL||APPS_SCRIPT_URL}?action=getActiveSessions&tanggal=${today}`);
    const d = await r.json();
    activeSessions = d.sessions || [];
  } catch(e) {}

  grid.innerHTML = bloks.map(b => {
    const session = activeSessions.find(s => s.blok_id === b.id);
    const isMySession  = session?.pegawai_id === currentUser.id;
    const inUseByOther = session && !isMySession;
    const cnt = b.wbp?.[0]?.count || 0;

    if (inUseByOther) {
      return `<div class="kamar-card in-use" title="Dipakai oleh ${session.pegawai_nama}">
        <div class="kamar-icon">🔒</div>
        <div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user">${session.pegawai_nama}</div>
      </div>`;
    }
    if (isMySession) {
      return `<div class="kamar-card selected" onclick="pilihKamar('${b.id}','${b.nama}','${session.session_id}')">
        <div class="kamar-icon">📋</div>
        <div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user" style="color:#3b82f6">Sesi Anda</div>
      </div>`;
    }
    return `<div class="kamar-card" onclick="pilihKamar('${b.id}','${b.nama}',null)">
      <div class="kamar-icon">🏠</div>
      <div class="kamar-name">${b.nama}</div>
      <div class="kamar-count">${cnt} WBP</div>
      <div class="kamar-user" style="color:#10b981">✓ Tersedia</div>
    </div>`;
  }).join('');
}

async function pilihKamar(blokId, blokNama, existingSessionId) {
  selectedKamar = { id: blokId, nama: blokNama };
  activeSessionId = existingSessionId;
  absenData = {};

  // Start session di GAS (lock kamar)
  if (!existingSessionId) {
    try {
      const r = await fetch(window.GAS_URL || APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startSession',
          blok_id: blokId, blok_nama: blokNama,
          pegawai_id: currentUser.id, pegawai_nama: currentUser.nama,
          pegawai_jabatan: currentUser.jabatan || '',
          tanggal: new Date().toISOString().split('T')[0]
        })
      });
      const d = await r.json();
      activeSessionId = d.session_id;
    } catch(e) { /* offline — lanjutkan */ }
  }

  // Tampilkan step 2
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  document.getElementById('step2KamarTitle').textContent = blokNama;
  document.getElementById('step2Tanggal').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  await loadWbpUntukAbsen(blokId);
}

// ── STEP 2: ABSEN WBP ─────────────────────────────────────────
async function loadWbpUntukAbsen(blokId) {
  const grid = document.getElementById('wbpAbsenGrid');
  grid.innerHTML = [1,2,3,4,5,6].map(() =>
    `<div class="skel" style="height:320px;border-radius:16px"></div>`
  ).join('');

  const { data: wbps } = await sb.from('wbp').select('*').eq('blok_id', blokId).order('nama');
  wbpList = wbps || [];

  if (!wbpList.length) {
    grid.innerHTML = `<div style="grid-column:1/-1" class="empty-state py-10">
      <div class="empty-title">Tidak Ada WBP</div>
      <div class="empty-desc">Belum ada WBP di kamar ini</div>
    </div>`;
    document.getElementById('absenBar').style.display = 'none';
    return;
  }

  document.getElementById('absenBar').style.display = 'block';
  renderKartuWbp();
  updateProgress();
}

function renderKartuWbp() {
  const grid = document.getElementById('wbpAbsenGrid');
  grid.innerHTML = wbpList.map(w => {
    const d = absenData[w.id] || {};
    const isHadir = d.status === 'Hadir';
    const isTidak = d.status === 'Tidak Hadir';

    // Format tanggal bebas untuk expire bar
    let expireStr = '—';
    let expireColor = '#dc2626';
    if (w.tgl_bebas) {
      const tgl = new Date(w.tgl_bebas);
      const bulan = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
      expireStr = `${String(tgl.getDate()).padStart(2,'0')}-${bulan[tgl.getMonth()]}-${tgl.getFullYear()}`;
      // Hitung sisa hari
      const sisa = Math.ceil((tgl - new Date()) / (1000*60*60*24));
      if (sisa < 30) expireColor = '#dc2626';
      else if (sisa < 90) expireColor = '#f59e0b';
      else expireColor = '#6b7280';
    }

    return `<div class="wbp-absen-card ${isHadir?'hadir':isTidak?'tidak':''}" id="wcard-${w.id}">
      <div class="foto-wrap">
        ${w.foto_url
          ? `<img src="${w.foto_url}" alt="${w.nama}" loading="lazy"/>`
          : `<div class="foto-initials">${w.nama?.[0]||'?'}</div>`
        }
        <div class="blok-badge">${selectedKamar?.nama||''}</div>
        ${isHadir ? '<div style="position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>' : ''}
        ${isTidak ? '<div style="position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>' : ''}
      </div>
      <div class="card-info">
        <div class="card-nama">${w.nama}</div>
        <div class="card-reg">${w.no_registrasi||'—'}</div>
        ${w.kasus ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px">Perkara:</div><div class="card-perkara">${w.kasus}</div>` : ''}
        ${w.masa_pidana ? `<div style="font-size:9px;color:#94a3b8;margin-top:3px">Putusan:</div><div class="card-putusan">${w.masa_pidana}</div>` : ''}
      </div>
      ${w.tgl_bebas ? `
      <div class="expire-bar" style="margin:0 8px 8px;padding:5px 8px;border-radius:8px;background:#fee2e2;text-align:center">
        <div style="font-size:9px;color:${expireColor};font-weight:700;letter-spacing:0.5px">EKSPIRASI</div>
        <div style="font-size:13px;color:${expireColor};font-weight:900;letter-spacing:0.5px">${expireStr}</div>
      </div>` : ''}
      ${isTidak && d.keterangan ? `<div class="ket-badge">${d.keterangan}</div>` : ''}
      <div class="status-row">
        <button class="btn-hadir2 ${isHadir?'active':''}" onclick="setStatusHadir('${w.id}')">✓ Hadir</button>
        <button class="btn-tidak2 ${isTidak?'active':''}" onclick="setStatusTidak('${w.id}','${w.nama.replace(/'/g,"\\'")}')">✗ Tidak</button>
      </div>
    </div>`;
  }).join('');
}

function setStatusHadir(wbpId) {
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = 'Hadir';
  delete absenData[wbpId].keterangan;
  renderKartuWbp();
  updateProgress();
}

function setStatusTidak(wbpId, wbpNama) {
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = 'Tidak Hadir';
  // Buka modal keterangan
  document.getElementById('ketWbpId').value = wbpId;
  document.getElementById('ketWbpName').textContent = wbpNama;
  document.getElementById('ketAlasan').value = '';
  document.getElementById('ketDetail').value = '';
  // Reset tombol opsi
  document.querySelectorAll('.ket-opsi-btn').forEach(b => b.classList.remove('active'));
  openModal('ketModal');
  renderKartuWbp();
  updateProgress();
}

function pilihAlasan(btn) {
  document.querySelectorAll('.ket-opsi-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ketAlasan').value = btn.dataset.val;
}

function syncAlasanSelect() {
  const val = document.getElementById('ketAlasan').value;
  document.querySelectorAll('.ket-opsi-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

function saveKeterangan() {
  const wbpId  = document.getElementById('ketWbpId').value;
  const alasan = document.getElementById('ketAlasan').value;
  const detail = document.getElementById('ketDetail').value.trim();
  if (!alasan) { showAlert('warning', 'Perhatian', 'Pilih alasan terlebih dahulu!'); return; }
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = 'Tidak Hadir';
  absenData[wbpId].keterangan = detail ? `${alasan} - ${detail}` : alasan;
  closeModal('ketModal');
  renderKartuWbp();
  updateProgress();
}

function updateProgress() {
  const total  = wbpList.length;
  const hadir  = Object.values(absenData).filter(d => d.status === 'Hadir').length;
  const tidak  = Object.values(absenData).filter(d => d.status === 'Tidak Hadir').length;
  const done   = hadir + tidak;
  const belum  = total - done;
  const pct    = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = `${done} / ${total}`;
  document.getElementById('cntHadir').textContent = `${hadir} Hadir`;
  document.getElementById('cntTidak').textContent = `${tidak} Tidak`;
  document.getElementById('cntBelum').textContent = `${belum} Belum`;
  document.getElementById('barSummary').textContent = `${done} dari ${total} WBP sudah diabsen`;
}

async function backToStep1() {
  const done = Object.keys(absenData).length;
  if (done > 0) {
    showConfirm('Kembali', 'Data absensi yang sudah diisi akan hilang. Yakin kembali?', async () => {
      await releaseSession();
      resetStep();
    }, 'warning');
  } else {
    await releaseSession();
    resetStep();
  }
}

async function releaseSession() {
  if (!activeSessionId) return;
  try {
    await fetch(window.GAS_URL || APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'endSession', session_id: activeSessionId })
    });
  } catch(e) {}
  activeSessionId = null;
}

function resetStep() {
  selectedKamar = null; absenData = {}; wbpList = [];
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step1').style.display = 'block';
  loadKamarPicker();
}

async function submitAbsen() {
  const total = wbpList.length;
  const done  = Object.keys(absenData).length;

  if (done === 0) {
    showAlert('warning', 'Belum Ada Absensi', 'Tandai setidaknya satu WBP terlebih dahulu!');
    return;
  }

  const unfinished = total - done;
  const msg = unfinished > 0
    ? `${done} WBP sudah diabsen, ${unfinished} WBP belum ditandai (tidak akan tercatat). Lanjutkan simpan?`
    : `Semua ${total} WBP sudah diabsen. Simpan data absensi sekarang?`;

  showConfirm('Simpan Absensi', msg, async () => {
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    try {
      const now    = new Date();
      const waktu  = now.toISOString();
      const tanggal = waktu.split('T')[0];

      const rows = wbpList
        .filter(w => absenData[w.id])
        .map(w => ({
          session_id:      activeSessionId || `local_${Date.now()}`,
          waktu, tanggal,
          blok_id:         selectedKamar.id,
          blok_nama:       selectedKamar.nama,
          pegawai_id:      currentUser.id,
          pegawai_nama:    currentUser.nama,
          pegawai_jabatan: currentUser.jabatan || '',
          wbp_id:          w.id,
          wbp_nama:        w.nama,
          no_registrasi:   w.no_registrasi || '',
          status:          absenData[w.id].status,
          keterangan:      absenData[w.id].keterangan || ''
        }));

      const r = await fetch(window.GAS_URL || APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveAbsen', rows })
      });
      const d = await r.json();
      if (d.success === false) throw new Error(d.message || 'Gagal menyimpan');

      showAlert('success', 'Absensi Tersimpan!', `${rows.length} data berhasil dicatat`);
      activeSessionId = null;
      resetStep();
    } catch(e) {
      showAlert('error', 'Gagal Menyimpan', e.message || 'Terjadi kesalahan. Coba lagi!');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan Absensi';
    }
  });
}

// ── RIWAYAT ───────────────────────────────────────────────────
async function loadMyRiwayatFilters() {
  const bs = document.getElementById('myRiwayatBlok');
  if (bs?.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id,nama').order('nama');
    bloks?.forEach(b => bs.add(new Option(b.nama, b.id)));
  }
}

async function loadMyRiwayat() {
  const search  = document.getElementById('myRiwayatSearch')?.value.trim() || '';
  const dari    = document.getElementById('myRiwayatDari')?.value || '';
  const sampai  = document.getElementById('myRiwayatSampai')?.value || '';
  const blok    = document.getElementById('myRiwayatBlok')?.value || '';
  const tbody   = document.getElementById('myRiwayatBody');

  tbody.innerHTML = `<tr><td colspan="7" style="padding:16px"><div style="display:flex;flex-direction:column;gap:10px">
    ${[1,2,3].map(() => `<div class="skel" style="height:40px"></div>`).join('')}
  </div></td></tr>`;

  try {
    const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
    const params = new URLSearchParams({ action: 'getRiwayat', isAdmin: 'false', pegawai_id: currentUser.id });
    if (dari)   params.append('dari', dari);
    if (sampai) params.append('sampai', sampai);
    if (blok)   params.append('blok_id', blok);
    if (search) params.append('search', search);

    const r = await fetch(`${gasUrl}?${params}`);
    const d = await r.json();
    const data = d.data || [];
    window._myRiwayatData = data;
    document.getElementById('myRiwayatCount').textContent = `${data.length} data`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <div class="empty-title">Belum Ada Data</div>
        <div class="empty-desc">Belum ada absensi pada periode ini</div>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((row, i) => `
      <tr class="fade-in">
        <td class="text-gray-400 text-xs">${i+1}</td>
        <td class="text-xs text-gray-600">${formatTglWaktu(row.waktu)}</td>
        <td><span class="badge badge-blue">${row.blok_nama||'—'}</span></td>
        <td class="font-medium text-sm">${row.wbp_nama||'—'}</td>
        <td class="text-xs text-gray-400">${row.no_registrasi||'—'}</td>
        <td><span class="badge ${row.status==='Hadir'?'badge-green':'badge-red'}">${row.status||'—'}</span></td>
        <td class="text-xs text-gray-500">${row.keterangan||'—'}</td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-title">GAS Belum Dikonfigurasi</div>
      <div class="empty-desc">Minta admin mengatur URL Google Apps Script</div>
    </div></td></tr>`;
  }
}

function resetMyRiwayat() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('myRiwayatSearch').value  = '';
  document.getElementById('myRiwayatDari').value    = today;
  document.getElementById('myRiwayatSampai').value  = today;
  document.getElementById('myRiwayatBlok').value    = '';
  loadMyRiwayat();
}

async function exportRiwayatUser() {
  const data = window._myRiwayatData;
  if (!data?.length) { showAlert('warning', 'Perhatian', 'Tidak ada data!'); return; }
  const dari   = document.getElementById('myRiwayatDari')?.value || '';
  const sampai = document.getElementById('myRiwayatSampai')?.value || '';
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('RIWAYAT ABSENSI WBP', 105, 14, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Petugas: ${currentUser.nama}`, 105, 21, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Periode: ${dari} s.d. ${sampai}  |  Dicetak: ${formatTglWaktu(new Date())}`, 105, 27, { align: 'center' });
    doc.line(14, 30, 196, 30);
    doc.autoTable({
      startY: 34,
      head: [['No','Waktu','Kamar','WBP','No. Reg','Status','Keterangan']],
      body: data.map((row,i) => [i+1,formatTglWaktu(row.waktu),row.blok_nama||'—',row.wbp_nama||'—',row.no_registrasi||'—',row.status||'—',row.keterangan||'—']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30,64,175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] }
    });
    doc.save(`riwayat_${currentUser.nama}_${dari}_${sampai}.pdf`);
    showAlert('success', 'Berhasil!', 'PDF diunduh');
  } catch(e) { showAlert('error', 'Gagal', e.message); }
}

// ── PROFIL ────────────────────────────────────────────────────
async function loadProfil() {
  if (!currentUser) return;
  const t = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  t('profilNama', currentUser.nama);
  t('profilJabatan', currentUser.jabatan);
  t('profilNip', currentUser.nip);
  t('profilPangkat', currentUser.pangkat);
  t('profilUsername', currentUser.username);
  const av = document.getElementById('profilAvatar');
  if (av) av.textContent = currentUser.nama?.[0]?.toUpperCase() || 'P';
}

async function userSavePassword() {
  const pwd     = document.getElementById('userPwdBaru')?.value;
  const konfirm = document.getElementById('userPwdKonfirm')?.value;
  if (!pwd || pwd.length < 8) { showAlert('warning', 'Perhatian', 'Password minimal 8 karakter!'); return; }
  if (pwd !== konfirm) { showAlert('error', 'Tidak Cocok', 'Konfirmasi password tidak sesuai!'); return; }
  showConfirm('Ganti Password', 'Yakin ingin mengganti password?', async () => {
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    document.getElementById('userPwdBaru').value  = '';
    document.getElementById('userPwdKonfirm').value = '';
    showAlert('success', 'Berhasil!', 'Password diganti');
  });
}

// ── START ─────────────────────────────────────────────────────
init();
