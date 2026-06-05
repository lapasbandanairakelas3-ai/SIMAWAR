// ============================================================
// USER.JS — SIMAWAR (Supabase only, no GAS)
// ============================================================
let currentUser = null;
let selectedKamar = null;
let absenData = {}; // { wbpId: { status, keterangan } }
let wbpList = [];
let activeSessionId = null;

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  setTimeout(() => {
    const s = document.getElementById('splashScreen');
    if (s) { s.style.opacity='0'; setTimeout(()=>s.remove(),500); }
  }, 800);

  const swId = sessionStorage.getItem('sw_id');
  if (!swId) { location.href='index.html'; return; }

  const { data: p } = await sb.from('pegawai').select('*').eq('id', swId).maybeSingle();
  if (!p || p.status==='nonaktif') { sessionStorage.clear(); location.href='index.html'; return; }
  currentUser = p;

  document.getElementById('headerUname').textContent  = p.nama;
  document.getElementById('headerAvatar').textContent = p.nama?.[0]?.toUpperCase()||'P';
  document.getElementById('headerDate').textContent   = new Date().toLocaleDateString('id-ID',{
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('myRiwayatDari').value   = today;
  document.getElementById('myRiwayatSampai').value = today;

  loadSiteConfigUser().catch(()=>{});
  loadKamarPicker().catch(()=>{});
}

async function loadSiteConfigUser() {
  const { data } = await sb.from('site_config').select('*').maybeSingle();
  if (!data) return;
  if (data.site_name) {
    document.title = `Petugas — ${data.site_name}`;
    document.getElementById('sidebarName').textContent = data.site_name;
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
}

// ── NAVIGASI ──────────────────────────────────────────────────
function goPage(page) {
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  ['absen','riwayat','profil'].forEach(id=>{
    document.getElementById('nav-'+id)?.classList.toggle('active',id===page);
  });
  const titles = { absen:'Absensi WBP', riwayat:'Riwayat Saya', profil:'Profil Saya' };
  document.getElementById('headerTitle').textContent = titles[page]||page;
  closeSidebar();
  if (page==='riwayat') { loadMyRiwayatFilter(); loadMyRiwayat(); }
  if (page==='profil')  loadProfil();
}
function toggleSidebar()  { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('mobileOverlay').classList.toggle('show'); }
function closeSidebar()   { document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('show'); }
function openModal(id)    { const m=document.getElementById(id); m.style.display='flex'; requestAnimationFrame(()=>m.classList.add('show')); }
function closeModal(id)   { const m=document.getElementById(id); m.classList.remove('show'); setTimeout(()=>m.style.display='none',300); }
async function doLogout() {
  if (activeSessionId) await releaseSession();
  showConfirm('Keluar','Yakin ingin keluar?', async()=>{
    sessionStorage.clear();
    try { await sb.auth.signOut(); } catch(e){}
    location.href='index.html';
  });
}

// ── STEP 1: PILIH KAMAR ───────────────────────────────────────
async function loadKamarPicker() {
  const grid = document.getElementById('kamarPickerGrid');
  grid.innerHTML = [1,2,3,4].map(()=>`<div style="height:100px;background:#f1f5f9;border-radius:16px;animation:pulse 1.5s infinite"></div>`).join('');

  const { data: bloks } = await sb.from('blok').select('*, wbp(count)').order('nama');
  if (!bloks?.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8">
      <div style="font-size:32px;margin-bottom:8px">🏠</div>
      <div style="font-size:14px;font-weight:700;color:#374151">Belum Ada Kamar</div>
      <div style="font-size:12px;margin-top:4px">Admin belum menambahkan kamar hunian</div>
    </div>`;
    return;
  }

  // Cek sesi aktif hari ini dari Supabase
  const today = new Date().toISOString().split('T')[0];
  const { data: sessions } = await sb.from('absen_session')
    .select('id, blok_id, pegawai_id, pegawai:pegawai_id(nama)')
    .eq('tanggal', today)
    .eq('status', 'aktif');

  grid.innerHTML = bloks.map(b => {
    const sesi = sessions?.find(s => s.blok_id === b.id);
    const isMySession   = sesi?.pegawai_id === currentUser.id;
    const inUseByOther  = sesi && !isMySession;
    const cnt = b.wbp?.[0]?.count || 0;

    if (inUseByOther) {
      return `<div class="kamar-card in-use" title="Sedang dipakai ${sesi.pegawai?.nama}">
        <div class="kamar-icon">🔒</div>
        <div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user">👤 ${sesi.pegawai?.nama||'Petugas lain'}</div>
      </div>`;
    }
    if (isMySession) {
      return `<div class="kamar-card selected" onclick="pilihKamar('${b.id}','${b.nama}','${sesi.id}')">
        <div class="kamar-icon">📋</div>
        <div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user" style="color:#3b82f6">✓ Sesi Anda</div>
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

  // Buat sesi baru di Supabase jika belum ada
  if (!existingSessionId) {
    const { data: sesi, error } = await sb.from('absen_session').insert({
      pegawai_id: currentUser.id,
      blok_id:    blokId,
      tanggal:    new Date().toISOString().split('T')[0],
      status:     'aktif'
    }).select().single();
    if (!error && sesi) activeSessionId = sesi.id;
    else if (error) {
      // Unique constraint — sesi sudah ada, ambil yang existing
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await sb.from('absen_session')
        .select('id').eq('blok_id', blokId).eq('tanggal', today).eq('status','aktif').maybeSingle();
      if (existing) activeSessionId = existing.id;
    }
  }

  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display  = 'block';
  document.getElementById('step2KamarTitle').textContent = blokNama;
  document.getElementById('step2Tanggal').textContent    = new Date().toLocaleString('id-ID');

  await loadWbpUntukAbsen(blokId);
}

// ── STEP 2: ABSEN WBP ─────────────────────────────────────────
async function loadWbpUntukAbsen(blokId) {
  const grid = document.getElementById('wbpAbsenGrid');
  grid.innerHTML = [1,2,3,4].map(()=>
    `<div style="height:320px;background:#f1f5f9;border-radius:16px;animation:pulse 1.5s infinite"></div>`
  ).join('');

  const { data: wbps } = await sb.from('wbp').select('*').eq('blok_id', blokId).eq('status','aktif').order('nama');
  wbpList = wbps || [];

  if (!wbpList.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:48px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">👤</div>
      <div style="font-size:14px;font-weight:700;color:#374151">Tidak Ada WBP</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Belum ada WBP aktif di kamar ini</div>
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
    const d       = absenData[w.id] || {};
    const isHadir = d.status === 'Hadir';
    const isTidak = d.status === 'Tidak Hadir';

    // Format tanggal bebas
    let expStr = '', expColor = '#dc2626', expWarn = false;
    if (w.tgl_bebas) {
      const tgl  = new Date(w.tgl_bebas);
      const sisa = Math.ceil((tgl - new Date()) / (1000*60*60*24));
      const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      expStr  = `${String(tgl.getDate()).padStart(2,'0')} ${bln[tgl.getMonth()]} ${tgl.getFullYear()}`;
      expWarn = sisa <= 90;
      expColor = sisa <= 30 ? '#dc2626' : sisa <= 90 ? '#f59e0b' : '#64748b';
    }

    return `<div class="wbp-absen-card ${isHadir?'hadir':isTidak?'tidak':''}" id="wcard-${w.id}">
      <!-- FOTO -->
      <div class="foto-wrap">
        ${w.foto_url
          ? `<img src="${w.foto_url}" alt="${w.nama}" loading="lazy"/>`
          : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:900;color:rgba(59,130,246,0.25)">${w.nama?.[0]||'?'}</div>`
        }
        <!-- Status badge di pojok kanan atas -->
        ${isHadir ? `<div style="position:absolute;top:8px;right:8px;background:#10b981;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        </div>` : ''}
        ${isTidak ? `<div style="position:absolute;top:8px;right:8px;background:#ef4444;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>` : ''}
        <!-- Nama kamar -->
        <div class="blok-badge">${selectedKamar?.nama||''}</div>
      </div>

      <!-- INFO -->
      <div style="padding:10px 10px 0">
        <div style="font-size:12px;font-weight:800;color:#1e293b;line-height:1.3">${w.nama}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px">${w.no_registrasi||'—'}</div>
        ${w.kasus ? `<div style="font-size:10px;color:#64748b;margin-top:4px"><span style="color:#94a3b8">Perkara: </span>${w.kasus}</div>` : ''}
        ${w.masa_pidana ? `<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:2px">${w.masa_pidana}</div>` : ''}
      </div>

      <!-- EKSPIRASI (jika ada) -->
      ${w.tgl_bebas ? `<div style="margin:8px 8px 0;padding:6px 8px;border-radius:8px;background:${expWarn?'#fef2f2':'#f8fafc'};text-align:center;border:1px solid ${expWarn?'#fecaca':'#e2e8f0'}">
        <div style="font-size:9px;font-weight:700;color:${expColor};letter-spacing:0.5px;text-transform:uppercase">Bebas</div>
        <div style="font-size:12px;font-weight:900;color:${expColor}">${expStr}</div>
      </div>` : ''}

      <!-- KETERANGAN jika tidak hadir -->
      ${isTidak && d.keterangan ? `<div style="margin:6px 8px 0;padding:5px 8px;background:#fef3c7;border-radius:8px;font-size:10px;font-weight:600;color:#92400e">📌 ${d.keterangan}</div>` : ''}

      <!-- TOMBOL HADIR / TIDAK -->
      <div style="display:flex;gap:6px;padding:8px">
        <button onclick="setHadir('${w.id}')"
          style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;transition:all 0.15s;
          background:${isHadir?'#10b981':'#d1fae5'};color:${isHadir?'white':'#065f46'}">
          ✓ Hadir
        </button>
        <button onclick="setTidak('${w.id}','${w.nama.replace(/'/g,"\\'")}')"
          style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;transition:all 0.15s;
          background:${isTidak?'#ef4444':'#fee2e2'};color:${isTidak?'white':'#991b1b'}">
          ✗ Tidak
        </button>
      </div>
    </div>`;
  }).join('');
}

function setHadir(wbpId) {
  absenData[wbpId] = { status:'Hadir' };
  renderKartuWbp(); updateProgress();
}
function setTidak(wbpId, wbpNama) {
  if (!absenData[wbpId]) absenData[wbpId] = {};
  absenData[wbpId].status = 'Tidak Hadir';
  document.getElementById('ketWbpId').value       = wbpId;
  document.getElementById('ketWbpName').textContent = wbpNama;
  // Reset pilihan
  document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ketDetail').value = '';
  // Pre-select keterangan yang sudah ada
  const existing = absenData[wbpId]?.keterangan;
  if (existing) {
    const btn = document.querySelector(`.ket-opsi-btn[data-val="${existing.split(' - ')[0]}"]`);
    if (btn) btn.classList.add('active');
  }
  openModal('ketModal');
  renderKartuWbp(); updateProgress();
}

function pilihAlasan(btn) {
  document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function saveKeterangan() {
  const wbpId  = document.getElementById('ketWbpId').value;
  const aktif  = document.querySelector('.ket-opsi-btn.active');
  const detail = document.getElementById('ketDetail').value.trim();
  if (!aktif) { showAlert('warning','Perhatian','Pilih alasan terlebih dahulu!'); return; }
  const alasan = aktif.dataset.val;
  absenData[wbpId] = {
    status:     'Tidak Hadir',
    keterangan: detail ? `${alasan} - ${detail}` : alasan
  };
  closeModal('ketModal');
  renderKartuWbp(); updateProgress();
}

function updateProgress() {
  const total  = wbpList.length;
  const hadir  = Object.values(absenData).filter(d=>d.status==='Hadir').length;
  const tidak  = Object.values(absenData).filter(d=>d.status==='Tidak Hadir').length;
  const done   = hadir + tidak;
  const pct    = total ? Math.round(done/total*100) : 0;
  document.getElementById('progressBar').style.width   = pct+'%';
  document.getElementById('progressText').textContent  = `${done} / ${total}`;
  document.getElementById('cntHadir').textContent       = `${hadir} Hadir`;
  document.getElementById('cntTidak').textContent       = `${tidak} Tidak`;
  document.getElementById('cntBelum').textContent       = `${total-done} Belum`;
  document.getElementById('barSummary').textContent     = `${done} dari ${total} WBP sudah diabsen`;
}

async function backToStep1() {
  const done = Object.keys(absenData).length;
  if (done > 0) {
    showConfirm('Kembali','Data absensi yang sudah diisi akan hilang. Yakin?', async()=>{
      await releaseSession(); resetStep();
    },'warning');
  } else {
    await releaseSession(); resetStep();
  }
}

async function releaseSession() {
  if (!activeSessionId) return;
  await sb.from('absen_session').update({status:'selesai'}).eq('id', activeSessionId);
  activeSessionId = null;
}

function resetStep() {
  selectedKamar=null; absenData={}; wbpList=[];
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step1').style.display = 'block';
  loadKamarPicker();
}

async function submitAbsen() {
  const total = wbpList.length;
  const done  = Object.keys(absenData).length;
  if (done === 0) { showAlert('warning','Belum Ada','Tandai minimal satu WBP!'); return; }

  const unfinished = total - done;
  const msg = unfinished > 0
    ? `${done} WBP diabsen, ${unfinished} belum (tidak akan tercatat). Simpan sekarang?`
    : `Semua ${total} WBP sudah diabsen. Simpan?`;

  showConfirm('Simpan Absensi', msg, async () => {
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      const now     = new Date().toISOString();
      const tanggal = now.split('T')[0];

      // Buat baris absen_detail untuk setiap WBP yang sudah diabsen
      const rows = wbpList
        .filter(w => absenData[w.id])
        .map(w => ({
          session_id:  activeSessionId,
          pegawai_id:  currentUser.id,
          blok_id:     selectedKamar.id,
          wbp_id:      w.id,
          tanggal,
          waktu:       now,
          status:      absenData[w.id].status,
          keterangan:  absenData[w.id].keterangan || null
        }));

      const { error } = await sb.from('absen_detail').insert(rows);
      if (error) throw error;

      // Tutup sesi
      await sb.from('absen_session').update({status:'selesai'}).eq('id', activeSessionId);
      activeSessionId = null;

      showAlert('success','Tersimpan!',`${rows.length} data absensi berhasil dicatat`);
      resetStep();
    } catch(e) {
      showAlert('error','Gagal Menyimpan', e.message || 'Terjadi kesalahan');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan Absensi`;
    }
  });
}

// ── RIWAYAT ───────────────────────────────────────────────────
async function loadMyRiwayatFilter() {
  const bs = document.getElementById('myRiwayatBlok');
  if (bs?.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id,nama').order('nama');
    bloks?.forEach(b => bs.add(new Option(b.nama, b.id)));
  }
}

async function loadMyRiwayat() {
  const search  = document.getElementById('myRiwayatSearch')?.value.trim()||'';
  const dari    = document.getElementById('myRiwayatDari')?.value||'';
  const sampai  = document.getElementById('myRiwayatSampai')?.value||'';
  const blokId  = document.getElementById('myRiwayatBlok')?.value||'';
  const tbody   = document.getElementById('myRiwayatBody');

  tbody.innerHTML = `<tr><td colspan="6" style="padding:16px"><div style="display:flex;flex-direction:column;gap:8px">
    ${[1,2,3].map(()=>`<div style="height:40px;background:#f1f5f9;border-radius:8px;animation:pulse 1.5s infinite"></div>`).join('')}
  </div></td></tr>`;

  let q = sb.from('absen_detail')
    .select('*, wbp:wbp_id(nama,no_registrasi), blok:blok_id(nama)')
    .eq('pegawai_id', currentUser.id)
    .order('waktu', { ascending: false });

  if (dari)   q = q.gte('tanggal', dari);
  if (sampai) q = q.lte('tanggal', sampai);
  if (blokId) q = q.eq('blok_id', blokId);
  if (search) q = q.ilike('wbp.nama', `%${search}%`);

  const { data, error } = await q;
  const rows = data || [];
  window._myRiwayatData = rows;
  document.getElementById('myRiwayatCount').textContent = `${rows.length} data`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div style="padding:40px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">📋</div>
      <div style="font-size:14px;font-weight:700;color:#374151">Belum Ada Data</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Belum ada absensi pada periode ini</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((row, i) => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 14px;font-size:12px;color:#94a3b8">${i+1}</td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b">${formatTglWaktu(row.waktu)}</td>
      <td style="padding:10px 14px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${row.blok?.nama||'—'}</span></td>
      <td style="padding:10px 14px"><div style="font-size:13px;font-weight:700">${row.wbp?.nama||'—'}</div><div style="font-size:11px;color:#94a3b8">${row.wbp?.no_registrasi||''}</div></td>
      <td style="padding:10px 14px"><span style="background:${row.status==='Hadir'?'#d1fae5':'#fee2e2'};color:${row.status==='Hadir'?'#065f46':'#991b1b'};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700">${row.status}</span></td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b">${row.keterangan||'—'}</td>
    </tr>`).join('');
}

function resetMyRiwayat() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('myRiwayatSearch').value = '';
  document.getElementById('myRiwayatDari').value   = today;
  document.getElementById('myRiwayatSampai').value = today;
  document.getElementById('myRiwayatBlok').value   = '';
  loadMyRiwayat();
}

async function exportRiwayatUser() {
  const data = window._myRiwayatData;
  if (!data?.length) { showAlert('warning','Perhatian','Tidak ada data!'); return; }
  const dari   = document.getElementById('myRiwayatDari')?.value||'';
  const sampai = document.getElementById('myRiwayatSampai')?.value||'';
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('RIWAYAT ABSENSI WBP',105,14,{align:'center'});
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Petugas: ${currentUser.nama}`,105,21,{align:'center'});
    doc.setFontSize(9);
    doc.text(`Periode: ${dari} s.d. ${sampai}  |  Dicetak: ${formatTglWaktu(new Date())}`,105,27,{align:'center'});
    doc.line(14,30,196,30);
    doc.autoTable({
      startY:34,
      head:[['No','Waktu','Kamar','WBP','No. Reg','Status','Keterangan']],
      body:data.map((r,i)=>[i+1,formatTglWaktu(r.waktu),r.blok?.nama||'—',r.wbp?.nama||'—',r.wbp?.no_registrasi||'—',r.status||'—',r.keterangan||'—']),
      styles:{fontSize:8,cellPadding:3},
      headStyles:{fillColor:[30,64,175],textColor:255,fontStyle:'bold'},
      alternateRowStyles:{fillColor:[248,250,252]}
    });
    doc.save(`riwayat_${currentUser.nama}_${dari}_${sampai}.pdf`);
    showAlert('success','Berhasil!','PDF diunduh');
  } catch(e) { showAlert('error','Gagal',e.message); }
}

// ── PROFIL ────────────────────────────────────────────────────
async function loadProfil() {
  if (!currentUser) return;
  document.getElementById('profilNama').textContent     = currentUser.nama||'—';
  document.getElementById('profilUsername').textContent = currentUser.username||'—';
  const av = document.getElementById('profilAvatar');
  if (av) av.textContent = currentUser.nama?.[0]?.toUpperCase()||'P';
}

async function userSavePassword() {
  const pwd     = document.getElementById('userPwdBaru')?.value;
  const konfirm = document.getElementById('userPwdKonfirm')?.value;
  if (!pwd || pwd.length < 4) { showAlert('warning','Perhatian','Password minimal 4 karakter!'); return; }
  if (pwd !== konfirm) { showAlert('error','Tidak Cocok','Konfirmasi tidak sesuai!'); return; }
  showConfirm('Ganti Password','Yakin ganti password?', async () => {
    const { error } = await sb.from('pegawai').update({ password_plain: pwd }).eq('id', currentUser.id);
    if (error) { showAlert('error','Gagal',error.message); return; }
    currentUser.password_plain = pwd;
    document.getElementById('userPwdBaru').value   = '';
    document.getElementById('userPwdKonfirm').value = '';
    showAlert('success','Berhasil!','Password diganti');
  });
}

// ── START ─────────────────────────────────────────────────────
init();
