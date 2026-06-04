// ============================================================
// ADMIN.JS — SIMAWAR Lapas Bandanaira
// ============================================================

let currentAdmin = null;
let wbpPage = 1; const WBP_PER_PAGE = 15;
let riwayatPage = 1; const RIWAYAT_PER_PAGE = 20;
let allBlok = [];
let wbpFotoFile = null;
let logoFile = null;
let favFile = null;
let siteConfigId = null;

// ============================================================
// INIT — splash cepat, tidak tunggu data
// ============================================================
async function init() {
  // Tampilkan app dulu, splash hanya 800ms
  showSplash();

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { data: p } = await sb.from('pegawai').select('*').eq('user_id', session.user.id).maybeSingle();
  if (!p || p.role !== 'admin') { window.location.href = 'index.html'; return; }
  currentAdmin = p;

  document.getElementById('headerUname').textContent = p.nama;
  document.getElementById('headerAvatar').textContent = p.nama?.charAt(0)?.toUpperCase() || 'A';
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('riwayatDari').value = today;
  document.getElementById('riwayatSampai').value = today;

  // Load config dan dashboard secara paralel, tidak blocking splash
  loadSiteConfig().catch(() => {});
  loadDashboard().catch(() => {});
}

function showSplash() {
  const splash = document.getElementById('splashScreen');
  const shell  = document.getElementById('appShell');
  splash.style.display = 'flex';
  shell.style.display  = 'none';
  setTimeout(() => {
    splash.classList.add('hiding');
    setTimeout(() => {
      splash.style.display = 'none';
      shell.style.display  = 'block';
    }, 500);
  }, 800); // hanya 800ms
}

// ============================================================
// NAVIGASI — pakai onclick di HTML, active class by page name
// ============================================================
function goPage(page) {
  // Sembunyikan semua section
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  // Aktifkan section yang dipilih
  const section = document.getElementById('page-' + page);
  if (section) section.classList.add('active');

  // Update active nav — pakai onclick attribute, bukan data-page
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    const oc = n.getAttribute('onclick') || '';
    if (oc.includes(`'${page}'`)) n.classList.add('active');
  });

  const titles = {
    dashboard: 'Dashboard', wbp: 'Data WBP', pegawai: 'Data Pegawai',
    blok: 'Blok / Kamar', riwayat: 'Riwayat Absensi',
    siteconfig: 'Konfigurasi Website', akun: 'Akun Saya'
  };
  document.getElementById('headerTitle').textContent = titles[page] || page;

  if (page === 'wbp')      { wbpPage = 1; loadWbp(); }
  if (page === 'pegawai')  loadPegawai();
  if (page === 'blok')     loadBlok();
  if (page === 'riwayat')  { loadRiwayatFilters(); loadRiwayat(); }
  if (page === 'akun')     loadAkun();
  if (page === 'siteconfig') {
    loadSiteConfigForm();
    setTimeout(() => {
      ['cfgName','cfgDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.removeEventListener('input', updateConfigPreview); el.addEventListener('input', updateConfigPreview); }
      });
    }, 200);
  }

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
  showConfirm('Keluar', 'Yakin ingin keluar dari sistem?', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  });
}

// ============================================================
// SITE CONFIG
// ============================================================
async function loadSiteConfig() {
  try {
    const { data } = await sb.from('site_config').select('*').maybeSingle();
    if (!data) return;
    siteConfigId = data.id;
    if (data.site_name) {
      document.title = `Admin — ${data.site_name}`;
      const sn = document.getElementById('sidebarName');
      if (sn) sn.textContent = data.site_name;
      const st = document.getElementById('splashTitle');
      if (st) st.textContent = data.site_name;
    }
    if (data.logo_url) {
      const emojiEl = document.getElementById('sidebarLogoEmoji');
      if (emojiEl) emojiEl.style.display = 'none';
      const logoEl = document.getElementById('sidebarLogo');
      if (logoEl) {
        const existing = logoEl.querySelector('img');
        if (!existing) {
          const img = document.createElement('img');
          img.src = data.logo_url;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px';
          logoEl.appendChild(img);
        }
      }
    }
    if (data.favicon_url) {
      const fav = document.getElementById('faviconEl');
      if (fav) fav.href = data.favicon_url;
    }
    window.GAS_URL = data.gas_url || APPS_SCRIPT_URL;
  } catch(e) { console.warn('loadSiteConfig:', e.message); }
}

async function loadSiteConfigForm() {
  try {
    const { data } = await sb.from('site_config').select('*').maybeSingle();
    if (!data) return;
    siteConfigId = data.id;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('cfgName', data.site_name);
    set('cfgDesc', data.site_desc);
    set('cfgGas',  data.gas_url);
    set('cfgInstansi', data.instansi);
    set('cfgAlamat', data.alamat);

    if (data.logo_url) {
      const img = document.getElementById('logoPreview');
      if (img) { img.src = data.logo_url; img.style.display = 'block'; }
      const ph = document.getElementById('logoPlaceholder');
      if (ph) ph.style.display = 'none';
      const rb = document.getElementById('removeLogoBtn');
      if (rb) rb.style.display = 'inline-flex';
      updatePreviewLogo(data.logo_url);
    }
    if (data.favicon_url) {
      const img = document.getElementById('favPreview');
      if (img) { img.src = data.favicon_url; img.style.display = 'block'; }
      const ph = document.getElementById('favPlaceholder');
      if (ph) ph.style.display = 'none';
    }
    updateConfigPreview();
  } catch(e) { console.warn('loadSiteConfigForm:', e.message); }
}

function updateConfigPreview() {
  const name = document.getElementById('cfgName')?.value || 'SIMAWAR';
  const desc = document.getElementById('cfgDesc')?.value || '';
  const pn = document.getElementById('previewName');
  const pd = document.getElementById('previewDesc');
  if (pn) pn.textContent = name;
  if (pd) pd.textContent = desc.split('\n')[0];
}

function updatePreviewLogo(url) {
  const box   = document.getElementById('previewLogoBox');
  const emoji = document.getElementById('previewLogoEmoji');
  if (!box) return;
  if (url) {
    if (emoji) emoji.style.display = 'none';
    let img = box.querySelector('img');
    if (!img) { img = document.createElement('img'); box.appendChild(img); }
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:10px';
  } else {
    if (emoji) emoji.style.display = 'block';
    const img = box.querySelector('img');
    if (img) img.remove();
  }
}

function previewLogo(event) {
  logoFile = event.target.files[0];
  if (!logoFile) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('logoPreview');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    const ph = document.getElementById('logoPlaceholder');
    if (ph) ph.style.display = 'none';
    const rb = document.getElementById('removeLogoBtn');
    if (rb) rb.style.display = 'inline-flex';
    updatePreviewLogo(e.target.result);
  };
  reader.readAsDataURL(logoFile);
}

function previewFav(event) {
  favFile = event.target.files[0];
  if (!favFile) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('favPreview');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    const ph = document.getElementById('favPlaceholder');
    if (ph) ph.style.display = 'none';
  };
  reader.readAsDataURL(favFile);
}

function removeLogo() {
  showConfirm('Hapus Logo', 'Yakin ingin menghapus logo?', async () => {
    if (siteConfigId) await sb.from('site_config').update({ logo_url: null }).eq('id', siteConfigId);
    const img = document.getElementById('logoPreview');
    if (img) img.style.display = 'none';
    const ph = document.getElementById('logoPlaceholder');
    if (ph) ph.style.display = 'flex';
    const rb = document.getElementById('removeLogoBtn');
    if (rb) rb.style.display = 'none';
    logoFile = null;
    updatePreviewLogo(null);
    showAlert('success', 'Dihapus!', 'Logo berhasil dihapus');
    loadSiteConfig();
  }, 'danger');
}

async function testGasConnection() {
  const url = document.getElementById('cfgGas')?.value.trim();
  const resultEl = document.getElementById('gasTestResult');
  if (!url) { showAlert('warning', 'Perhatian', 'Isi URL GAS terlebih dahulu!'); return; }
  if (resultEl) { resultEl.style.display = 'block'; resultEl.className = 'p-3 rounded-xl text-xs mt-2 bg-blue-50 text-blue-700'; resultEl.textContent = '⏳ Menguji koneksi...'; }
  try {
    const r = await fetch(`${url}?action=ping`);
    if (resultEl) { resultEl.className = 'p-3 rounded-xl text-xs mt-2 bg-green-50 text-green-700'; resultEl.textContent = '✅ Koneksi berhasil! GAS dapat dijangkau.'; }
  } catch(e) {
    if (resultEl) { resultEl.className = 'p-3 rounded-xl text-xs mt-2 bg-red-50 text-red-700'; resultEl.textContent = '❌ Koneksi gagal. Pastikan URL benar dan GAS sudah di-deploy dengan akses Anyone.'; }
  }
}

async function resetSiteConfig() {
  showConfirm('Reset Konfigurasi', 'Yakin reset semua konfigurasi ke default?', async () => {
    await sb.from('site_config').update({
      site_name: 'SIMAWAR', site_desc: 'Sistem Informasi Monitoring Warga Binaan\nLapas Bandanaira',
      logo_url: null, favicon_url: null, gas_url: null, instansi: null, alamat: null
    }).eq('id', siteConfigId);
    showAlert('success', 'Reset!', 'Konfigurasi berhasil direset');
    loadSiteConfig();
    loadSiteConfigForm();
  }, 'danger');
}

async function uploadToSupabase(file, bucket, path) {
  const { data, error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

async function saveSiteConfig() {
  const name = document.getElementById('cfgName')?.value.trim() || '';
  const desc = document.getElementById('cfgDesc')?.value || '';
  const gas  = document.getElementById('cfgGas')?.value.trim() || '';
  const instansi = document.getElementById('cfgInstansi')?.value || '';
  const alamat   = document.getElementById('cfgAlamat')?.value || '';

  const payload = { site_name: name, site_desc: desc, gas_url: gas, instansi, alamat };

  try {
    if (logoFile) {
      showAlert('info', 'Upload', 'Mengupload logo...');
      payload.logo_url = await uploadToSupabase(logoFile, 'assets', `logo_${Date.now()}.${logoFile.name.split('.').pop()}`);
    }
    if (favFile) {
      payload.favicon_url = await uploadToSupabase(favFile, 'assets', `favicon_${Date.now()}.${favFile.name.split('.').pop()}`);
    }

    let result;
    if (siteConfigId) {
      result = await sb.from('site_config').update(payload).eq('id', siteConfigId);
    } else {
      result = await sb.from('site_config').insert(payload);
    }
    if (result.error) throw result.error;
    showAlert('success', 'Berhasil!', 'Konfigurasi website berhasil disimpan');
    logoFile = null; favFile = null;
    await loadSiteConfig();
  } catch(e) {
    showAlert('error', 'Gagal', e.message || 'Gagal menyimpan konfigurasi');
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const [wbpRes, pegRes, blokRes] = await Promise.all([
      sb.from('wbp').select('id', { count: 'exact', head: true }),
      sb.from('pegawai').select('id', { count: 'exact', head: true }).eq('role', 'user').eq('status','aktif'),
      sb.from('blok').select('id', { count: 'exact', head: true })
    ]);

    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card fade-in">
        <div class="stat-icon bg-blue-50 text-blue-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
        </div>
        <div class="stat-value">${wbpRes.count || 0}</div>
        <div class="stat-label">Total WBP</div>
        <div class="stat-bg bg-blue-500"></div>
      </div>
      <div class="stat-card fade-in">
        <div class="stat-icon bg-green-50 text-green-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"/></svg>
        </div>
        <div class="stat-value">${pegRes.count || 0}</div>
        <div class="stat-label">Petugas Aktif</div>
        <div class="stat-bg bg-green-500"></div>
      </div>
      <div class="stat-card fade-in">
        <div class="stat-icon bg-amber-50 text-amber-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>
        </div>
        <div class="stat-value">${blokRes.count || 0}</div>
        <div class="stat-label">Blok / Kamar</div>
        <div class="stat-bg bg-amber-500"></div>
      </div>
      <div class="stat-card fade-in">
        <div class="stat-icon bg-purple-50 text-purple-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div class="stat-value" id="dashAbsenCount">—</div>
        <div class="stat-label">Absensi Hari Ini</div>
        <div class="stat-bg bg-purple-500"></div>
      </div>
    `;

    // Load blok status
    const { data: bloks } = await sb.from('blok').select('*, wbp(count)');
    allBlok = bloks || [];
    const blokGrid = document.getElementById('dashBlokGrid');
    if (blokGrid) {
      if (!bloks?.length) {
        blokGrid.innerHTML = `<div class="col-span-full empty-state py-6"><div class="empty-title">Belum Ada Blok</div><div class="empty-desc">Tambahkan blok/kamar di menu Blok/Kamar</div></div>`;
      } else {
        blokGrid.innerHTML = bloks.map(b => `
          <div class="blok-card" onclick="goPage('blok')">
            <div class="blok-icon">🏠</div>
            <div class="blok-name">${b.nama}</div>
            <div class="blok-count">${b.wbp?.[0]?.count || 0} WBP</div>
            <div class="blok-user" style="color:#10b981">✓ Tersedia</div>
          </div>`).join('');
      }
    }

    document.getElementById('dashTodayDate').textContent = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Try load absen count from GAS (non-blocking)
    try {
      const today = new Date().toISOString().split('T')[0];
      const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
      const r = await fetch(`${gasUrl}?action=getRiwayat&dari=${today}&sampai=${today}`);
      const d = await r.json();
      const cnt = d.data?.length || 0;
      const el = document.getElementById('dashAbsenCount');
      if (el) el.textContent = cnt;
      const badge = document.getElementById('dashTodayCount');
      if (badge) badge.textContent = `${cnt} catatan`;
    } catch(e) {
      const el = document.getElementById('dashAbsenCount');
      if (el) el.textContent = '0';
    }

  } catch(e) {
    console.warn('loadDashboard:', e.message);
  }
}

// ============================================================
// WBP CRUD
// ============================================================
async function loadWbp() {
  const search = document.getElementById('wbpSearch')?.value.trim() || '';
  const blokFilter = document.getElementById('wbpBlokFilter')?.value || '';
  const jkFilter = document.getElementById('wbpJkFilter')?.value || '';

  // Load blok options jika belum
  const blokSel = document.getElementById('wbpBlokFilter');
  if (blokSel && blokSel.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id, nama').order('nama');
    bloks?.forEach(b => {
      const o = new Option(b.nama, b.id);
      blokSel.add(o);
    });
  }

  const tbody = document.getElementById('wbpTableBody');
  if (tbody) tbody.innerHTML = skeletonRow(8).repeat(4);

  let q = sb.from('wbp').select('*, blok(nama)', { count: 'exact' });
  if (search) q = q.or(`nama.ilike.%${search}%,no_registrasi.ilike.%${search}%`);
  if (blokFilter) q = q.eq('blok_id', blokFilter);
  if (jkFilter) q = q.eq('jk', jkFilter);
  q = q.order('nama').range((wbpPage - 1) * WBP_PER_PAGE, wbpPage * WBP_PER_PAGE - 1);

  const { data, count } = await q;
  const countEl = document.getElementById('wbpCount');
  if (countEl) countEl.textContent = `${count || 0} data`;

  if (!data?.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg></div><div class="empty-title">Belum Ada Data WBP</div><div class="empty-desc">Tambahkan WBP melalui tombol Tambah WBP</div></div></td></tr>`;
    const pag = document.getElementById('wbpPagination');
    if (pag) pag.innerHTML = '';
    return;
  }

  const no0 = (wbpPage - 1) * WBP_PER_PAGE;
  if (tbody) tbody.innerHTML = data.map((w, i) => `
    <tr class="fade-in">
      <td class="text-gray-400 text-xs">${no0 + i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="table-avatar">${w.foto_url ? `<img src="${w.foto_url}" alt="${w.nama}"/>` : (w.nama?.charAt(0) || '?')}</div>
          <div><div class="font-semibold text-sm">${w.nama}</div><div class="text-xs text-gray-400">${w.asal || '—'}</div></div>
        </div>
      </td>
      <td><span class="badge badge-blue">${w.no_registrasi || '—'}</span></td>
      <td><span class="badge ${w.jk === 'L' ? 'badge-blue' : 'badge-purple'}">${w.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</span></td>
      <td><span class="font-medium text-sm">${w.blok?.nama || '—'}</span></td>
      <td class="text-xs text-gray-500">${w.masa_pidana || '—'}</td>
      <td><span class="badge ${w.status !== 'bebas' ? 'badge-green' : 'badge-gray'}">${w.status || 'aktif'}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-warning btn-sm btn-icon" onclick="editWbp('${w.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteWbp('${w.id}','${w.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
        </div>
      </td>
    </tr>`).join('');

  const totalPages = Math.ceil(count / WBP_PER_PAGE);
  renderPagination('wbpPagination', wbpPage, totalPages, (pg) => { wbpPage = pg; loadWbp(); });
}

function renderPagination(containerId, current, total, callback) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= Math.min(total, 10); i++) {
    html += `<button onclick="(${callback.toString()})(${i})" class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-ghost'}" style="min-width:32px;padding:5px 10px">${i}</button>`;
  }
  el.innerHTML = html;
}

async function openWbpModal() {
  const fields = ['wbpId','wbpNama','wbpNoreg','wbpTglMasuk','wbpTglBebas','wbpMasa','wbpKasus','wbpAsal','wbpCatatan'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('wbpJk').value = 'L';
  const fp = document.getElementById('wbpFotoPreview'); if (fp) fp.style.display = 'none';
  const fph = document.getElementById('wbpFotoPlaceholder'); if (fph) fph.style.display = 'flex';
  wbpFotoFile = null;

  const blokSel = document.getElementById('wbpBlok');
  if (blokSel) {
    blokSel.innerHTML = '<option value="">— Pilih Blok —</option>';
    const { data: bloks } = await sb.from('blok').select('id, nama').order('nama');
    bloks?.forEach(b => blokSel.add(new Option(b.nama, b.id)));
  }
  document.getElementById('wbpModalTitle').textContent = 'Tambah WBP';
  openModal('wbpModal');
}

async function editWbp(id) {
  await openWbpModal();
  const { data: w } = await sb.from('wbp').select('*').eq('id', id).maybeSingle();
  if (!w) return;
  document.getElementById('wbpModalTitle').textContent = 'Edit Data WBP';
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('wbpId', w.id); set('wbpNama', w.nama); set('wbpNoreg', w.no_registrasi);
  set('wbpTglMasuk', w.tgl_masuk); set('wbpTglBebas', w.tgl_bebas);
  set('wbpMasa', w.masa_pidana); set('wbpKasus', w.kasus);
  set('wbpAsal', w.asal); set('wbpCatatan', w.catatan);
  document.getElementById('wbpJk').value = w.jk || 'L';
  document.getElementById('wbpBlok').value = w.blok_id || '';
  if (w.foto_url) {
    const img = document.getElementById('wbpFotoPreview');
    if (img) { img.src = w.foto_url; img.style.display = 'block'; }
    const ph = document.getElementById('wbpFotoPlaceholder');
    if (ph) ph.style.display = 'none';
  }
}

function previewWbpFoto(event) {
  wbpFotoFile = event.target.files[0];
  if (!wbpFotoFile) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('wbpFotoPreview');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    const ph = document.getElementById('wbpFotoPlaceholder');
    if (ph) ph.style.display = 'none';
  };
  reader.readAsDataURL(wbpFotoFile);
}

async function saveWbp() {
  const id   = document.getElementById('wbpId')?.value;
  const nama = document.getElementById('wbpNama')?.value.trim();
  const noreg= document.getElementById('wbpNoreg')?.value.trim();
  if (!nama || !noreg) { showAlert('warning', 'Perhatian', 'Nama dan No. Registrasi wajib diisi!'); return; }

  const btn = document.getElementById('wbpSaveBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Menyimpan...'; }

  try {
    let foto_url = document.getElementById('wbpFotoPreview')?.src || null;
    if (wbpFotoFile) foto_url = await uploadToSupabase(wbpFotoFile, 'wbp-photos', `wbp_${Date.now()}.${wbpFotoFile.name.split('.').pop()}`);

    const payload = {
      nama, no_registrasi: noreg,
      jk:          document.getElementById('wbpJk')?.value || 'L',
      blok_id:     document.getElementById('wbpBlok')?.value || null,
      tgl_masuk:   document.getElementById('wbpTglMasuk')?.value || null,
      tgl_bebas:   document.getElementById('wbpTglBebas')?.value || null,
      masa_pidana: document.getElementById('wbpMasa')?.value || '',
      kasus:       document.getElementById('wbpKasus')?.value || '',
      asal:        document.getElementById('wbpAsal')?.value || '',
      catatan:     document.getElementById('wbpCatatan')?.value || '',
      foto_url:    foto_url?.startsWith('http') ? foto_url : null
    };

    const result = id
      ? await sb.from('wbp').update(payload).eq('id', id)
      : await sb.from('wbp').insert(payload);
    if (result.error) throw result.error;

    showAlert('success', 'Berhasil!', id ? 'Data WBP diperbarui' : 'WBP baru ditambahkan');
    closeModal('wbpModal');
    loadWbp();
  } catch(e) {
    showAlert('error', 'Gagal', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan'; }
  }
}

async function deleteWbp(id, nama) {
  showConfirm('Hapus WBP', `Yakin hapus WBP <strong>${nama}</strong>?`, async () => {
    const { error } = await sb.from('wbp').delete().eq('id', id);
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    showAlert('success', 'Dihapus!', `WBP ${nama} dihapus`);
    loadWbp();
  });
}

// ============================================================
// PEGAWAI CRUD
// ============================================================
async function loadPegawai() {
  const search = document.getElementById('pegawaiSearch')?.value.trim() || '';
  const roleFilter = document.getElementById('pegawaiRoleFilter')?.value || '';
  const tbody = document.getElementById('pegawaiTableBody');
  if (tbody) tbody.innerHTML = skeletonRow(8).repeat(3);

  let q = sb.from('pegawai').select('*', { count: 'exact' });
  if (search) q = q.or(`nama.ilike.%${search}%,username.ilike.%${search}%`);
  if (roleFilter) q = q.eq('role', roleFilter);
  q = q.order('nama');

  const { data, count } = await q;
  const ce = document.getElementById('pegawaiCount');
  if (ce) ce.textContent = `${count || 0} data`;

  if (!data?.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-title">Belum Ada Data Pegawai</div></div></td></tr>`;
    return;
  }

  if (tbody) tbody.innerHTML = data.map((p, i) => `
    <tr class="fade-in">
      <td class="text-gray-400 text-xs">${i + 1}</td>
      <td><div style="display:flex;align-items:center;gap:10px"><div class="table-avatar">${p.nama?.charAt(0) || '?'}</div><div><div class="font-semibold text-sm">${p.nama}</div><div class="text-xs text-gray-400">${p.nip || '—'}</div></div></div></td>
      <td class="text-sm">${p.jabatan || '—'}</td>
      <td class="text-sm">${p.pangkat || '—'}</td>
      <td><code class="text-xs bg-gray-100 px-2 py-1 rounded">${p.username}</code></td>
      <td><span class="badge ${p.role === 'admin' ? 'badge-purple' : 'badge-blue'}">${p.role === 'admin' ? 'Admin' : 'Petugas'}</span></td>
      <td><span class="badge ${p.status === 'aktif' ? 'badge-green' : 'badge-red'}">${p.status || 'aktif'}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-warning btn-sm btn-icon" onclick="editPegawai('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
        ${p.id !== currentAdmin?.id ? `<button class="btn btn-danger btn-sm btn-icon" onclick="deletePegawai('${p.id}','${p.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>` : ''}
      </div></td>
    </tr>`).join('');
}

function openPegawaiModal() {
  ['pegawaiId','pegawaiUserId','pegawaiNama','pegawaiJabatan','pegawaiPangkat','pegawaiUsername','pegawaiEmail','pegawaiPassword','pegawaiNip']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('pegawaiRole').value = 'user';
  document.getElementById('pegawaiStatus').value = 'aktif';
  const pg = document.getElementById('pegawaiPwdGroup');
  if (pg) pg.style.display = 'block';
  document.getElementById('pegawaiModalTitle').textContent = 'Tambah Pegawai';
  openModal('pegawaiModal');
}

async function editPegawai(id) {
  openPegawaiModal();
  const { data: p } = await sb.from('pegawai').select('*').eq('id', id).maybeSingle();
  if (!p) return;
  document.getElementById('pegawaiModalTitle').textContent = 'Edit Data Pegawai';
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('pegawaiId', p.id); set('pegawaiUserId', p.user_id);
  set('pegawaiNama', p.nama); set('pegawaiJabatan', p.jabatan);
  set('pegawaiPangkat', p.pangkat); set('pegawaiUsername', p.username);
  set('pegawaiEmail', p.email); set('pegawaiNip', p.nip);
  document.getElementById('pegawaiRole').value = p.role || 'user';
  document.getElementById('pegawaiStatus').value = p.status || 'aktif';
  const pg = document.getElementById('pegawaiPwdGroup');
  if (pg) pg.style.display = 'none';
}

async function savePegawai() {
  const id       = document.getElementById('pegawaiId')?.value;
  const nama     = document.getElementById('pegawaiNama')?.value.trim();
  const username = document.getElementById('pegawaiUsername')?.value.trim();
  const email    = document.getElementById('pegawaiEmail')?.value.trim();
  const password = document.getElementById('pegawaiPassword')?.value;

  if (!nama || !username || !email) { showAlert('warning', 'Perhatian', 'Nama, username, dan email wajib diisi!'); return; }
  if (!id && !password) { showAlert('warning', 'Perhatian', 'Password wajib diisi!'); return; }
  if (!id && password.length < 8) { showAlert('warning', 'Perhatian', 'Password minimal 8 karakter!'); return; }

  const btn = document.getElementById('pegawaiSaveBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Menyimpan...'; }

  try {
    const payload = {
      nama, jabatan: document.getElementById('pegawaiJabatan')?.value || '',
      pangkat: document.getElementById('pegawaiPangkat')?.value || '',
      username, email,
      nip:    document.getElementById('pegawaiNip')?.value || '',
      role:   document.getElementById('pegawaiRole')?.value || 'user',
      status: document.getElementById('pegawaiStatus')?.value || 'aktif'
    };

    if (id) {
      const { error } = await sb.from('pegawai').update(payload).eq('id', id);
      if (error) throw error;
      showAlert('success', 'Berhasil!', 'Data pegawai diperbarui');
    } else {
      const { data: authData, error: authError } = await sb.auth.signUp({ email, password });
      if (authError) throw authError;
      payload.user_id = authData.user.id;
      const { error } = await sb.from('pegawai').insert(payload);
      if (error) throw error;
      showAlert('success', 'Berhasil!', `Pegawai ${nama} berhasil didaftarkan`);
    }
    closeModal('pegawaiModal');
    loadPegawai();
  } catch(e) {
    showAlert('error', 'Gagal', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan'; }
  }
}

async function deletePegawai(id, nama) {
  showConfirm('Hapus Pegawai', `Yakin hapus pegawai <strong>${nama}</strong>?`, async () => {
    const { error } = await sb.from('pegawai').delete().eq('id', id);
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    showAlert('success', 'Dihapus!', `Pegawai ${nama} dihapus`);
    loadPegawai();
  });
}

// ============================================================
// BLOK CRUD
// ============================================================
async function loadBlok() {
  const search = document.getElementById('blokSearch')?.value.trim() || '';
  const tbody = document.getElementById('blokTableBody');
  if (tbody) tbody.innerHTML = skeletonRow(7).repeat(3);

  let q = sb.from('blok').select('*, wbp(count)', { count: 'exact' });
  if (search) q = q.ilike('nama', `%${search}%`);
  q = q.order('nama');

  const { data, count } = await q;
  allBlok = data || [];
  const ce = document.getElementById('blokCount');
  if (ce) ce.textContent = `${count || 0} data`;

  if (!data?.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-title">Belum Ada Blok/Kamar</div></div></td></tr>`;
    return;
  }

  if (tbody) tbody.innerHTML = data.map((b, i) => `
    <tr class="fade-in">
      <td class="text-gray-400 text-xs">${i + 1}</td>
      <td class="font-semibold text-sm">${b.nama}</td>
      <td><span class="badge badge-blue">${b.kapasitas || '—'} orang</span></td>
      <td><span class="badge ${b.jk === 'L' ? 'badge-blue' : b.jk === 'P' ? 'badge-purple' : 'badge-gray'}">${b.jk === 'L' ? 'Laki-laki' : b.jk === 'P' ? 'Perempuan' : 'Campur'}</span></td>
      <td class="text-xs text-gray-500">${b.keterangan || '—'}</td>
      <td><span class="font-bold text-sm ${(b.wbp?.[0]?.count || 0) >= (b.kapasitas||999) ? 'text-red-500' : 'text-green-600'}">${b.wbp?.[0]?.count || 0}</span><span class="text-xs text-gray-400"> / ${b.kapasitas || '?'}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-warning btn-sm btn-icon" onclick="editBlok('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteBlok('${b.id}','${b.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
      </div></td>
    </tr>`).join('');
}

function openBlokModal() {
  ['blokId','blokNama','blokKapasitas','blokKet'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('blokJk').value = 'L';
  document.getElementById('blokModalTitle').textContent = 'Tambah Blok/Kamar';
  openModal('blokModal');
}

async function editBlok(id) {
  const { data: b } = await sb.from('blok').select('*').eq('id', id).maybeSingle();
  if (!b) return;
  document.getElementById('blokModalTitle').textContent = 'Edit Blok/Kamar';
  document.getElementById('blokId').value = b.id;
  document.getElementById('blokNama').value = b.nama;
  document.getElementById('blokKapasitas').value = b.kapasitas || '';
  document.getElementById('blokJk').value = b.jk || 'L';
  document.getElementById('blokKet').value = b.keterangan || '';
  openModal('blokModal');
}

async function saveBlok() {
  const id   = document.getElementById('blokId')?.value;
  const nama = document.getElementById('blokNama')?.value.trim();
  if (!nama) { showAlert('warning', 'Perhatian', 'Nama blok wajib diisi!'); return; }

  const payload = {
    nama,
    kapasitas:  parseInt(document.getElementById('blokKapasitas')?.value) || null,
    jk:         document.getElementById('blokJk')?.value || 'L',
    keterangan: document.getElementById('blokKet')?.value || ''
  };

  const result = id
    ? await sb.from('blok').update(payload).eq('id', id)
    : await sb.from('blok').insert(payload);

  if (result.error) { showAlert('error', 'Gagal', result.error.message); return; }
  showAlert('success', 'Berhasil!', id ? 'Blok diperbarui' : 'Blok baru ditambahkan');
  closeModal('blokModal');
  loadBlok();
}

async function deleteBlok(id, nama) {
  showConfirm('Hapus Blok', `Yakin hapus blok <strong>${nama}</strong>?`, async () => {
    const { error } = await sb.from('blok').delete().eq('id', id);
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    showAlert('success', 'Dihapus!', `Blok ${nama} dihapus`);
    loadBlok();
  });
}

// ============================================================
// RIWAYAT
// ============================================================
async function loadRiwayatFilters() {
  const blokSel = document.getElementById('riwayatBlokFilter');
  if (blokSel && blokSel.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id, nama').order('nama');
    bloks?.forEach(b => blokSel.add(new Option(b.nama, b.id)));
  }
  const pegSel = document.getElementById('riwayatPegawaiFilter');
  if (pegSel && pegSel.options.length <= 1) {
    const { data: pegs } = await sb.from('pegawai').select('id, nama').order('nama');
    pegs?.forEach(p => pegSel.add(new Option(p.nama, p.id)));
  }
}

async function loadRiwayat() {
  const search  = document.getElementById('riwayatSearch')?.value.trim() || '';
  const dari    = document.getElementById('riwayatDari')?.value || '';
  const sampai  = document.getElementById('riwayatSampai')?.value || '';
  const blok    = document.getElementById('riwayatBlokFilter')?.value || '';
  const pegawai = document.getElementById('riwayatPegawaiFilter')?.value || '';
  const tbody   = document.getElementById('riwayatTableBody');
  if (tbody) tbody.innerHTML = skeletonRow(7).repeat(4);

  try {
    const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
    const params = new URLSearchParams({ action: 'getRiwayat', isAdmin: 'true' });
    if (dari) params.append('dari', dari);
    if (sampai) params.append('sampai', sampai);
    if (blok) params.append('blok_id', blok);
    if (pegawai) params.append('pegawai_id', pegawai);
    if (search) params.append('search', search);

    const r = await fetch(`${gasUrl}?${params}`);
    const d = await r.json();
    const data = d.data || [];
    window._riwayatData = data;
    const ce = document.getElementById('riwayatCount');
    if (ce) ce.textContent = `${data.length} data`;

    if (!data.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-title">Tidak Ada Data Absensi</div><div class="empty-desc">Coba ubah filter atau pastikan GAS sudah dikonfigurasi</div></div></td></tr>`;
      const pag = document.getElementById('riwayatPagination');
      if (pag) pag.innerHTML = '';
      return;
    }

    const no0 = (riwayatPage - 1) * RIWAYAT_PER_PAGE;
    const pageData = data.slice(no0, no0 + RIWAYAT_PER_PAGE);
    if (tbody) tbody.innerHTML = pageData.map((row, i) => `
      <tr class="fade-in">
        <td class="text-gray-400 text-xs">${no0 + i + 1}</td>
        <td class="text-xs text-gray-600">${formatTglWaktu(row.waktu)}</td>
        <td><div class="font-semibold text-sm">${row.pegawai_nama || '—'}</div><div class="text-xs text-gray-400">${row.pegawai_jabatan || ''}</div></td>
        <td><span class="badge badge-blue">${row.blok_nama || '—'}</span></td>
        <td><div class="font-medium text-sm">${row.wbp_nama || '—'}</div><div class="text-xs text-gray-400">${row.no_registrasi || ''}</div></td>
        <td><span class="badge ${row.status === 'Hadir' ? 'badge-green' : 'badge-red'}">${row.status || '—'}</span></td>
        <td class="text-xs text-gray-500">${row.keterangan || '—'}</td>
      </tr>`).join('');

    const totalPages = Math.ceil(data.length / RIWAYAT_PER_PAGE);
    renderPagination('riwayatPagination', riwayatPage, totalPages, (pg) => { riwayatPage = pg; loadRiwayat(); });
  } catch(e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-title">GAS Belum Dikonfigurasi</div><div class="empty-desc">Atur URL Google Apps Script di menu Konfigurasi Website</div></div></td></tr>`;
  }
}

function resetRiwayatFilter() {
  const today = new Date().toISOString().split('T')[0];
  ['riwayatSearch'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('riwayatDari').value = today;
  document.getElementById('riwayatSampai').value = today;
  document.getElementById('riwayatBlokFilter').value = '';
  document.getElementById('riwayatPegawaiFilter').value = '';
  riwayatPage = 1;
  loadRiwayat();
}

async function exportRiwayat() {
  const data = window._riwayatData;
  if (!data?.length) { showAlert('warning', 'Perhatian', 'Tidak ada data untuk diekspor!'); return; }
  const dari   = document.getElementById('riwayatDari')?.value || '';
  const sampai = document.getElementById('riwayatSampai')?.value || '';
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const siteName = document.getElementById('sidebarName')?.textContent || 'SIMAWAR';
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN ABSENSI WBP', 148, 14, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(siteName, 148, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Periode: ${dari || '—'} s.d. ${sampai || '—'}  |  Dicetak: ${formatTglWaktu(new Date())}`, 148, 26, { align: 'center' });
    doc.line(14, 29, 283, 29);
    doc.autoTable({
      startY: 33,
      head: [['No', 'Waktu', 'Petugas', 'Blok', 'WBP', 'No. Reg', 'Status', 'Keterangan']],
      body: data.map((row, i) => [i+1, formatTglWaktu(row.waktu), row.pegawai_nama||'—', row.blok_nama||'—', row.wbp_nama||'—', row.no_registrasi||'—', row.status||'—', row.keterangan||'—']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    doc.save(`laporan_absensi_${dari}_${sampai}.pdf`);
    showAlert('success', 'Berhasil!', 'PDF berhasil diunduh');
  } catch(e) { showAlert('error', 'Gagal', 'Gagal generate PDF: ' + e.message); }
}

// ============================================================
// AKUN
// ============================================================
async function loadAkun() {
  if (!currentAdmin) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('akunNamaDisplay', currentAdmin.nama);
  set('akunJabatanDisplay', currentAdmin.jabatan);
  set('akunPangkatDisplay', currentAdmin.pangkat);
  set('akunUsernameDisplay', currentAdmin.username);
  set('akunRoleDisplay', currentAdmin.role === 'admin' ? 'Administrator' : 'Petugas');
  const av = document.getElementById('akunAvatarBig');
  if (av) av.textContent = currentAdmin.nama?.charAt(0)?.toUpperCase() || 'A';
  setVal('akunNama', currentAdmin.nama);
  setVal('akunJabatan', currentAdmin.jabatan);

  const { data: { user } } = await sb.auth.getUser();
  set('akunEmailDisplay', user?.email);
  setVal('akunEmail', user?.email);
}

async function saveAkun() {
  const nama    = document.getElementById('akunNama')?.value.trim();
  const jabatan = document.getElementById('akunJabatan')?.value.trim();
  const email   = document.getElementById('akunEmail')?.value.trim();
  if (!nama) { showAlert('warning', 'Perhatian', 'Nama tidak boleh kosong!'); return; }

  try {
    const { error } = await sb.from('pegawai').update({ nama, jabatan }).eq('id', currentAdmin.id);
    if (error) throw error;
    const { data: { user } } = await sb.auth.getUser();
    if (email && email !== user.email) {
      const { error: e2 } = await sb.auth.updateUser({ email });
      if (e2) throw e2;
    }
    currentAdmin.nama = nama; currentAdmin.jabatan = jabatan;
    document.getElementById('headerUname').textContent = nama;
    document.getElementById('headerAvatar').textContent = nama.charAt(0).toUpperCase();
    const av = document.getElementById('akunAvatarBig');
    if (av) av.textContent = nama.charAt(0).toUpperCase();
    document.getElementById('akunNamaDisplay').textContent = nama;
    document.getElementById('akunJabatanDisplay').textContent = jabatan || '—';
    showAlert('success', 'Berhasil!', 'Data akun diperbarui');
  } catch(e) { showAlert('error', 'Gagal', e.message); }
}

async function savePassword() {
  const pwd     = document.getElementById('akunPwdBaru')?.value;
  const konfirm = document.getElementById('akunPwdKonfirm')?.value;
  if (!pwd) { showAlert('warning', 'Perhatian', 'Password baru harus diisi!'); return; }
  if (pwd.length < 8) { showAlert('warning', 'Perhatian', 'Password minimal 8 karakter!'); return; }
  if (pwd !== konfirm) { showAlert('error', 'Tidak Cocok', 'Konfirmasi password tidak sesuai!'); return; }
  showConfirm('Ganti Password', 'Yakin ingin mengganti password?', async () => {
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    document.getElementById('akunPwdBaru').value = '';
    document.getElementById('akunPwdKonfirm').value = '';
    showAlert('success', 'Berhasil!', 'Password berhasil diganti');
  });
}

// ============================================================
// START
// ============================================================
init();
