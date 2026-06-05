// SIMAWAR — admin.js
let currentAdmin = null;
let wbpPage = 1; const WBP_PER_PAGE = 15;
let riwayatPage = 1; const RIWAYAT_PER_PAGE = 20;
let wbpFotoFile = null, logoFile = null, favFile = null;
let siteConfigId = null;
let searchTimer = null; // debounce timer

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  setTimeout(() => {
    const s = document.getElementById('splashScreen');
    if (s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 500); }
  }, 900);

  // Cek session — TANPA redirect otomatis ke index jika tidak ada
  // Gunakan onAuthStateChange agar tidak redirect saat refresh tab baru
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'index.html'; return; }

  const { data: p } = await sb.from('pegawai').select('*').eq('user_id', session.user.id).maybeSingle();
  if (!p || p.role !== 'admin') { location.href = 'index.html'; return; }
  currentAdmin = p;

  document.getElementById('headerUname').textContent = p.nama;
  document.getElementById('headerAvatar').textContent = p.nama?.[0]?.toUpperCase() || 'A';
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('riwayatDari').value = today;
  document.getElementById('riwayatSampai').value = today;

  // Simpan halaman terakhir di sessionStorage — tidak redirect saat refresh
  const lastPage = sessionStorage.getItem('simawar_admin_page') || 'dashboard';
  goPage(lastPage, false); // false = jangan save ulang ke sessionStorage

  loadSiteConfig().catch(() => {});
}

// ── NAVIGASI ──────────────────────────────────────────────────
function goPage(page, save = true) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');

  ['dashboard','wbp','pegawai','blok','riwayat','siteconfig','akun'].forEach(id => {
    document.getElementById('nav-' + id)?.classList.toggle('active', id === page);
  });

  const titles = {
    dashboard: 'Dashboard', wbp: 'Data WBP', pegawai: 'Data Pegawai',
    blok: 'Blok / Kamar', riwayat: 'Riwayat Absensi',
    siteconfig: 'Konfigurasi Website', akun: 'Akun Saya'
  };
  document.getElementById('headerTitle').textContent = titles[page] || page;

  if (save) sessionStorage.setItem('simawar_admin_page', page);
  closeSidebar();

  if (page === 'dashboard') loadDashboard();
  if (page === 'wbp')       { wbpPage = 1; loadWbp(); }
  if (page === 'pegawai')   loadPegawai();
  if (page === 'blok')      loadBlok();
  if (page === 'riwayat')   { loadRiwayatFilters(); loadRiwayat(); }
  if (page === 'akun')      loadAkun();
  if (page === 'siteconfig') loadSiteConfigForm();
}

// Debounce untuk search input — cegah search otomatis saat buka halaman
function debounceSearch(fn, delay = 400) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(fn, delay);
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
  showConfirm('Keluar', 'Yakin ingin keluar?', async () => {
    sessionStorage.clear();
    await sb.auth.signOut();
    location.href = 'index.html';
  });
}

// ── SITE CONFIG ───────────────────────────────────────────────
async function loadSiteConfig() {
  const { data } = await sb.from('site_config').select('*').maybeSingle();
  if (!data) return;
  siteConfigId = data.id;
  if (data.site_name) {
    document.title = `Admin — ${data.site_name}`;
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
  window.GAS_URL = data.gas_url || APPS_SCRIPT_URL;
}

async function loadSiteConfigForm() {
  const { data } = await sb.from('site_config').select('*').maybeSingle();
  if (!data) return;
  siteConfigId = data.id;
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  v('cfgName', data.site_name);
  v('cfgDesc', data.site_desc);
  v('cfgGas', data.gas_url);
  v('cfgInstansi', data.instansi);
  v('cfgAlamat', data.alamat);

  if (data.logo_url) {
    const img = document.getElementById('logoPreview');
    if (img) { img.src = data.logo_url; img.style.display = 'block'; }
    const ph = document.getElementById('logoPlaceholder'); if (ph) ph.style.display = 'none';
    const rb = document.getElementById('removeLogoBtn'); if (rb) rb.style.display = 'inline-flex';
    updatePreviewLogo(data.logo_url);
  }
  if (data.favicon_url) {
    const img = document.getElementById('favPreview');
    if (img) { img.src = data.favicon_url; img.style.display = 'block'; }
    const ph = document.getElementById('favPlaceholder'); if (ph) ph.style.display = 'none';
  }

  ['cfgName','cfgDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => {
      const pn = document.getElementById('previewName');
      const pd = document.getElementById('previewDesc');
      if (pn) pn.textContent = document.getElementById('cfgName')?.value || 'SIMAWAR';
      if (pd) pd.textContent = document.getElementById('cfgDesc')?.value?.split('\n')[0] || '';
    };
  });
}

function updatePreviewLogo(url) {
  const box = document.getElementById('previewLogoBox');
  const emoji = document.getElementById('previewLogoEmoji');
  if (!box) return;
  if (url) {
    if (emoji) emoji.style.display = 'none';
    let img = box.querySelector('img');
    if (!img) { img = document.createElement('img'); box.appendChild(img); }
    img.src = url; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:10px';
  } else {
    if (emoji) emoji.style.display = 'block';
    box.querySelector('img')?.remove();
  }
}

function previewLogo(e) {
  logoFile = e.target.files[0]; if (!logoFile) return;
  const r = new FileReader();
  r.onload = ev => {
    const img = document.getElementById('logoPreview');
    if (img) { img.src = ev.target.result; img.style.display = 'block'; }
    const ph = document.getElementById('logoPlaceholder'); if (ph) ph.style.display = 'none';
    const rb = document.getElementById('removeLogoBtn'); if (rb) rb.style.display = 'inline-flex';
    updatePreviewLogo(ev.target.result);
  };
  r.readAsDataURL(logoFile);
}

function previewFav(e) {
  favFile = e.target.files[0]; if (!favFile) return;
  const r = new FileReader();
  r.onload = ev => {
    const img = document.getElementById('favPreview');
    if (img) { img.src = ev.target.result; img.style.display = 'block'; }
    const ph = document.getElementById('favPlaceholder'); if (ph) ph.style.display = 'none';
  };
  r.readAsDataURL(favFile);
}

function removeLogo() {
  showConfirm('Hapus Logo', 'Yakin hapus logo?', async () => {
    if (siteConfigId) await sb.from('site_config').update({ logo_url: null }).eq('id', siteConfigId);
    const img = document.getElementById('logoPreview'); if (img) img.style.display = 'none';
    const ph = document.getElementById('logoPlaceholder'); if (ph) ph.style.display = 'flex';
    const rb = document.getElementById('removeLogoBtn'); if (rb) rb.style.display = 'none';
    logoFile = null; updatePreviewLogo(null);
    showAlert('success', 'Dihapus!', 'Logo berhasil dihapus');
    loadSiteConfig();
  }, 'danger');
}

async function testGasConnection() {
  const url = document.getElementById('cfgGas')?.value.trim();
  const el = document.getElementById('gasTestResult');
  if (!url) { showAlert('warning', 'Perhatian', 'Isi URL GAS dulu!'); return; }
  if (el) { el.style.display = 'block'; el.className = 'p-3 rounded-xl text-xs mb-3 bg-blue-50 text-blue-700'; el.textContent = '⏳ Menguji...'; }
  try {
    await fetch(`${url}?action=ping`);
    if (el) { el.className = 'p-3 rounded-xl text-xs mb-3 bg-green-50 text-green-700'; el.textContent = '✅ Koneksi berhasil!'; }
  } catch {
    if (el) { el.className = 'p-3 rounded-xl text-xs mb-3 bg-red-50 text-red-700'; el.textContent = '❌ Gagal. Pastikan URL benar dan deploy sebagai Anyone.'; }
  }
}

async function resetSiteConfig() {
  showConfirm('Reset', 'Yakin reset konfigurasi?', async () => {
    await sb.from('site_config').update({ site_name: 'SIMAWAR', site_desc: 'Sistem Informasi Monitoring Warga Binaan', logo_url: null, favicon_url: null, gas_url: null }).eq('id', siteConfigId);
    showAlert('success', 'Reset!', 'Konfigurasi direset');
    loadSiteConfig(); loadSiteConfigForm();
  }, 'danger');
}

// Upload ke Supabase Storage — pastikan bucket sudah ada dan public
async function uploadToSupabase(file, bucket, path) {
  // Cek ukuran file (maks 2MB)
  if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran file melebihi 2MB!');

  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    // Pesan error lebih jelas
    if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
      throw new Error(`Bucket "${bucket}" belum dibuat di Supabase. Buka Storage → New Bucket → buat bucket "${bucket}" (centang Public).`);
    }
    throw error;
  }
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function saveSiteConfig() {
  const payload = {
    site_name:  document.getElementById('cfgName')?.value.trim(),
    site_desc:  document.getElementById('cfgDesc')?.value,
    gas_url:    document.getElementById('cfgGas')?.value.trim(),
    instansi:   document.getElementById('cfgInstansi')?.value,
    alamat:     document.getElementById('cfgAlamat')?.value
  };

  try {
    if (logoFile) {
      showAlert('info', 'Upload', 'Mengupload logo...');
      payload.logo_url = await uploadToSupabase(logoFile, 'assets', `logo_${Date.now()}.${logoFile.name.split('.').pop()}`);
    }
    if (favFile) {
      payload.favicon_url = await uploadToSupabase(favFile, 'assets', `fav_${Date.now()}.${favFile.name.split('.').pop()}`);
    }

    const res = siteConfigId
      ? await sb.from('site_config').update(payload).eq('id', siteConfigId)
      : await sb.from('site_config').insert(payload);
    if (res.error) throw res.error;

    showAlert('success', 'Berhasil!', 'Konfigurasi disimpan');
    logoFile = null; favFile = null;
    loadSiteConfig();
  } catch(e) {
    showAlert('error', 'Gagal Upload', e.message);
  }
}

// ── DASHBOARD ─────────────────────────────────────────────────
async function loadDashboard() {
  const [wR, pR, bR] = await Promise.all([
    sb.from('wbp').select('id', { count: 'exact', head: true }),
    sb.from('pegawai').select('id', { count: 'exact', head: true }).eq('role', 'user').eq('status', 'aktif'),
    sb.from('blok').select('id', { count: 'exact', head: true })
  ]);

  document.getElementById('dashStats').innerHTML = [
    { label: 'Total WBP', val: wR.count||0, bg: 'bg-blue-50', clr: 'text-blue-500', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Petugas Aktif', val: pR.count||0, bg: 'bg-green-50', clr: 'text-green-500', d: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6a4 4 0 11-8 0 4 4 0 018 0zm-4 9a9 9 0 00-9 9h18a9 9 0 00-9-9z' },
    { label: 'Blok / Kamar', val: bR.count||0, bg: 'bg-amber-50', clr: 'text-amber-500', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Absensi Hari Ini', val: '<span id="dashAbsenVal">—</span>', bg: 'bg-purple-50', clr: 'text-purple-500', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
  ].map(s => `
    <div class="stat-card fade-in">
      <div class="stat-icon ${s.bg} ${s.clr}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${s.d}"/></svg></div>
      <div class="stat-value">${s.val}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');

  document.getElementById('dashTodayDate').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const { data: bloks } = await sb.from('blok').select('*, wbp(count)');
  const bg = document.getElementById('dashBlokGrid');
  if (bg) bg.innerHTML = !bloks?.length
    ? `<div class="col-span-full empty-state py-6"><div class="empty-title">Belum Ada Blok</div><div class="empty-desc">Tambahkan di menu Blok/Kamar</div></div>`
    : bloks.map(b => `<div class="blok-card" onclick="goPage('blok')"><div class="blok-icon">🏠</div><div class="blok-name">${b.nama}</div><div class="blok-count">${b.wbp?.[0]?.count||0} WBP</div></div>`).join('');

  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await fetch(`${window.GAS_URL||APPS_SCRIPT_URL}?action=getRiwayat&dari=${today}&sampai=${today}`);
    const d = await r.json();
    const cnt = d.data?.length || 0;
    const el = document.getElementById('dashAbsenVal');
    if (el) el.textContent = cnt;
    const badge = document.getElementById('dashTodayCount');
    if (badge) badge.textContent = `${cnt} catatan`;
  } catch {
    const el = document.getElementById('dashAbsenVal');
    if (el) el.textContent = '0';
  }
}

// ── WBP ───────────────────────────────────────────────────────
async function loadWbp() {
  const search = document.getElementById('wbpSearch')?.value.trim() || '';
  const blokF  = document.getElementById('wbpBlokFilter')?.value || '';
  const jkF    = document.getElementById('wbpJkFilter')?.value || '';
  const tbody  = document.getElementById('wbpTableBody');

  const blokSel = document.getElementById('wbpBlokFilter');
  if (blokSel?.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id,nama').order('nama');
    bloks?.forEach(b => blokSel.add(new Option(b.nama, b.id)));
  }

  tbody.innerHTML = `<tr><td colspan="8" style="padding:16px"><div style="display:flex;flex-direction:column;gap:10px">
    ${[1,2,3,4].map(() => `<div style="height:44px;background:#f1f5f9;border-radius:10px;animation:pulse 1.5s infinite"></div>`).join('')}
  </div></td></tr>`;

  let q = sb.from('wbp').select('*, blok(nama)', { count: 'exact' });
  if (search) q = q.or(`nama.ilike.%${search}%,no_registrasi.ilike.%${search}%`);
  if (blokF) q = q.eq('blok_id', blokF);
  if (jkF)   q = q.eq('jk', jkF);
  q = q.order('nama').range((wbpPage-1)*WBP_PER_PAGE, wbpPage*WBP_PER_PAGE-1);

  const { data, count } = await q;
  document.getElementById('wbpCount').textContent = `${count||0} data`;

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div>
      <div class="empty-title">Belum Ada Data WBP</div>
      <div class="empty-desc">Tambahkan WBP melalui tombol Tambah WBP</div>
    </div></td></tr>`;
    document.getElementById('wbpPagination').innerHTML = '';
    return;
  }

  const no0 = (wbpPage-1)*WBP_PER_PAGE;
  tbody.innerHTML = data.map((w,i) => `
    <tr class="fade-in">
      <td class="text-gray-400 text-xs">${no0+i+1}</td>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="table-avatar">${w.foto_url?`<img src="${w.foto_url}"/>`:(w.nama?.[0]||'?')}</div>
        <div><div class="font-semibold text-sm">${w.nama}</div><div class="text-xs text-gray-400">${w.asal||'—'}</div></div>
      </div></td>
      <td><span class="badge badge-blue">${w.no_registrasi||'—'}</span></td>
      <td><span class="badge ${w.jk==='L'?'badge-blue':'badge-purple'}">${w.jk==='L'?'Laki-laki':'Perempuan'}</span></td>
      <td class="font-medium text-sm">${w.blok?.nama||'—'}</td>
      <td class="text-xs text-gray-500">${w.masa_pidana||'—'}</td>
      <td><span class="badge ${w.status!=='bebas'?'badge-green':'badge-gray'}">${w.status||'aktif'}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-warning btn-sm btn-icon" title="Edit" onclick="editWbp('${w.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-icon" title="Hapus" onclick="deleteWbp('${w.id}','${w.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
      </div></td>
    </tr>`).join('');

  const tot = Math.ceil(count/WBP_PER_PAGE);
  const pag = document.getElementById('wbpPagination');
  pag.innerHTML = tot > 1
    ? Array.from({length: Math.min(tot,10)}, (_,i) =>
        `<button onclick="wbpPage=${i+1};loadWbp()" class="btn btn-sm ${i+1===wbpPage?'btn-primary':'btn-ghost'}" style="min-width:32px">${i+1}</button>`
      ).join('')
    : '';
}

async function openWbpModal() {
  ['wbpId','wbpNama','wbpNoreg','wbpTglMasuk','wbpTglBebas','wbpMasa','wbpKasus','wbpAsal','wbpCatatan'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('wbpJk').value = 'L';
  document.getElementById('wbpStatus').value = 'aktif';
  const fp = document.getElementById('wbpFotoPreview');
  if (fp) { fp.style.display = 'none'; fp.src = ''; }
  document.getElementById('wbpFotoPlaceholder').style.display = 'flex';
  wbpFotoFile = null;
  const bs = document.getElementById('wbpBlok');
  bs.innerHTML = '<option value="">— Pilih Blok —</option>';
  const { data: bloks } = await sb.from('blok').select('id,nama').order('nama');
  bloks?.forEach(b => bs.add(new Option(b.nama, b.id)));
  document.getElementById('wbpModalTitle').textContent = 'Tambah WBP';
  openModal('wbpModal');
}

async function editWbp(id) {
  await openWbpModal();
  const { data: w } = await sb.from('wbp').select('*').eq('id', id).maybeSingle();
  if (!w) return;
  document.getElementById('wbpModalTitle').textContent = 'Edit Data WBP';
  const v = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
  v('wbpId', w.id); v('wbpNama', w.nama); v('wbpNoreg', w.no_registrasi);
  v('wbpTglMasuk', w.tgl_masuk); v('wbpTglBebas', w.tgl_bebas);
  v('wbpMasa', w.masa_pidana); v('wbpKasus', w.kasus);
  v('wbpAsal', w.asal); v('wbpCatatan', w.catatan);
  document.getElementById('wbpJk').value = w.jk || 'L';
  document.getElementById('wbpBlok').value = w.blok_id || '';
  document.getElementById('wbpStatus').value = w.status || 'aktif';
  if (w.foto_url) {
    const img = document.getElementById('wbpFotoPreview');
    img.src = w.foto_url; img.style.display = 'block';
    document.getElementById('wbpFotoPlaceholder').style.display = 'none';
  }
}

function previewWbpFoto(e) {
  wbpFotoFile = e.target.files[0]; if (!wbpFotoFile) return;
  const r = new FileReader();
  r.onload = ev => {
    const img = document.getElementById('wbpFotoPreview');
    img.src = ev.target.result; img.style.display = 'block';
    document.getElementById('wbpFotoPlaceholder').style.display = 'none';
  };
  r.readAsDataURL(wbpFotoFile);
}

async function saveWbp() {
  const id = document.getElementById('wbpId').value;
  const nama = document.getElementById('wbpNama').value.trim();
  const noreg = document.getElementById('wbpNoreg').value.trim();
  if (!nama || !noreg) { showAlert('warning', 'Perhatian', 'Nama dan No. Registrasi wajib diisi!'); return; }

  const btn = document.getElementById('wbpSaveBtn');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    let foto_url = document.getElementById('wbpFotoPreview')?.src || null;
    if (wbpFotoFile) foto_url = await uploadToSupabase(wbpFotoFile, 'wbp-photos', `wbp_${Date.now()}.${wbpFotoFile.name.split('.').pop()}`);

    const payload = {
      nama, no_registrasi: noreg,
      jk: document.getElementById('wbpJk').value,
      blok_id: document.getElementById('wbpBlok').value || null,
      tgl_masuk: document.getElementById('wbpTglMasuk').value || null,
      tgl_bebas: document.getElementById('wbpTglBebas').value || null,
      masa_pidana: document.getElementById('wbpMasa').value,
      kasus: document.getElementById('wbpKasus').value,
      asal: document.getElementById('wbpAsal').value,
      catatan: document.getElementById('wbpCatatan').value,
      status: document.getElementById('wbpStatus').value,
      foto_url: foto_url?.startsWith('http') ? foto_url : null
    };
    const res = id
      ? await sb.from('wbp').update(payload).eq('id', id)
      : await sb.from('wbp').insert(payload);
    if (res.error) throw res.error;
    showAlert('success', 'Berhasil!', id ? 'WBP diperbarui' : 'WBP baru ditambahkan');
    closeModal('wbpModal'); loadWbp();
  } catch(e) { showAlert('error', 'Gagal', e.message); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan';
  }
}

async function deleteWbp(id, nama) {
  showConfirm('Hapus WBP', `Hapus WBP <strong>${nama}</strong>?`, async () => {
    const { error } = await sb.from('wbp').delete().eq('id', id);
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    showAlert('success', 'Dihapus!', `${nama} dihapus`); loadWbp();
  });
}

// ── PEGAWAI ───────────────────────────────────────────────────
async function loadPegawai() {
  const search = document.getElementById('pegawaiSearch')?.value.trim() || '';
  const roleF  = document.getElementById('pegawaiRoleFilter')?.value || '';
  const tbody  = document.getElementById('pegawaiTableBody');

  tbody.innerHTML = `<tr><td colspan="8" style="padding:16px"><div style="display:flex;flex-direction:column;gap:10px">
    ${[1,2,3].map(() => `<div style="height:44px;background:#f1f5f9;border-radius:10px;animation:pulse 1.5s infinite"></div>`).join('')}
  </div></td></tr>`;

  let q = sb.from('pegawai').select('*', { count: 'exact' });
  if (search) q = q.or(`nama.ilike.%${search}%,username.ilike.%${search}%`);
  if (roleF)  q = q.eq('role', roleF);
  q = q.order('nama');

  const { data, count } = await q;
  document.getElementById('pegawaiCount').textContent = `${count||0} data`;

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-title">Belum Ada Pegawai</div>
      <div class="empty-desc">Tambahkan pegawai melalui tombol Tambah Pegawai</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((p, i) => `
    <tr class="fade-in">
      <td class="text-gray-400 text-xs">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="table-avatar" style="background:${p.role==='admin'?'linear-gradient(135deg,#7c3aed,#4f46e5)':'linear-gradient(135deg,#3b82f6,#1e40af)'}">${p.nama?.[0]||'?'}</div>
          <div class="font-semibold text-sm">${p.nama}</div>
        </div>
      </td>
      <td><code class="text-xs bg-gray-100 px-2 py-1 rounded">${p.username}</code></td>
      <td>
        ${p.password_plain
          ? `<div style="display:flex;align-items:center;gap:6px">
              <code class="text-xs bg-yellow-50 border border-yellow-200 px-2 py-1 rounded text-yellow-800" id="pwd_${p.id}" style="letter-spacing:2px">••••••••</code>
              <button onclick="togglePwd('${p.id}','${(p.password_plain||'').replace(/'/g,"\\'")}')" style="background:none;border:none;cursor:pointer;padding:2px;color:#94a3b8" title="Tampilkan/Sembunyikan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </button>
             </div>`
          : '<span class="text-xs text-gray-300">—</span>'}
      </td>
      <td><span class="badge ${p.role==='admin'?'badge-purple':'badge-blue'}">${p.role==='admin'?'Admin':'Rupam'}</span></td>
      <td><span class="badge ${p.status==='aktif'?'badge-green':'badge-red'}">${p.status||'aktif'}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-warning btn-sm btn-icon" title="Edit" onclick="editPegawai('${p.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
        </button>
        ${p.id !== currentAdmin?.id
          ? `<button class="btn btn-danger btn-sm btn-icon" title="Hapus" onclick="deletePegawai('${p.id}','${p.nama.replace(/'/g,"\\'")}')">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
             </button>`
          : ''}
      </div></td>
    </tr>`).join('');
}

function openPegawaiModal() {
  ['pegawaiId','pegawaiNama','pegawaiUsername','pegawaiPassword'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('pegawaiRole').value   = 'user';
  document.getElementById('pegawaiStatus').value = 'aktif';
  const pg = document.getElementById('pegawaiPwdGroup');
  if (pg) pg.style.display = 'block';
  document.getElementById('pegawaiModalTitle').textContent = 'Tambah Petugas (Karupam)';
  openModal('pegawaiModal');
}

async function editPegawai(id) {
  openPegawaiModal();
  const { data: p } = await sb.from('pegawai').select('*').eq('id', id).maybeSingle();
  if (!p) return;
  document.getElementById('pegawaiModalTitle').textContent = 'Edit Petugas';
  document.getElementById('pegawaiId').value        = p.id       || '';
  document.getElementById('pegawaiNama').value      = p.nama     || '';
  document.getElementById('pegawaiUsername').value  = p.username || '';
  document.getElementById('pegawaiPassword').value  = p.password_plain || '';
  document.getElementById('pegawaiRole').value      = p.role     || 'user';
  document.getElementById('pegawaiStatus').value    = p.status   || 'aktif';
  // Saat edit, password tetap bisa diubah
  const pg = document.getElementById('pegawaiPwdGroup');
  if (pg) pg.style.display = 'block';
}

async function savePegawai() {
  const id       = document.getElementById('pegawaiId').value;
  const nama     = document.getElementById('pegawaiNama').value.trim();
  const username = document.getElementById('pegawaiUsername').value.trim().toLowerCase();
  const password = document.getElementById('pegawaiPassword').value;

  if (!nama)     { showAlert('warning','Perhatian','Nama Rupam wajib diisi!'); return; }
  if (!username) { showAlert('warning','Perhatian','Username wajib diisi!'); return; }
  if (!password) { showAlert('warning','Perhatian','Password wajib diisi!'); return; }

  const btn = document.getElementById('pegawaiSaveBtn');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    if (!id) {
      // Cek duplikat username
      const { data: ex } = await sb.from('pegawai').select('id').eq('username', username).maybeSingle();
      if (ex) throw new Error(`Username "${username}" sudah dipakai!`);
    }

    const payload = {
      nama, username,
      password_plain: password,
      role:   document.getElementById('pegawaiRole').value   || 'user',
      status: document.getElementById('pegawaiStatus').value || 'aktif'
    };

    const res = id
      ? await sb.from('pegawai').update(payload).eq('id', id)
      : await sb.from('pegawai').insert(payload);

    if (res.error) throw res.error;

    showAlert('success','Berhasil!',
      id ? `Data ${nama} diperbarui`
         : `${nama} ditambahkan! Login: username="${username}" | password="${password}"`,
      id ? 3000 : 7000);
    closeModal('pegawaiModal');
    loadPegawai();
  } catch(e) {
    showAlert('error','Gagal',e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan';
  }
}

async function deletePegawai(id, nama) {
  showConfirm('Hapus Pegawai', `Hapus pegawai <strong>${nama}</strong>?`, async () => {
    const { error } = await sb.from('pegawai').delete().eq('id', id);
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    showAlert('success', 'Dihapus!', `${nama} dihapus`);
    loadPegawai();
  });
}

// ── BLOK ──────────────────────────────────────────────────────
async function loadBlok() {
  const search = document.getElementById('blokSearch')?.value.trim() || '';
  const tbody  = document.getElementById('blokTableBody');

  tbody.innerHTML = `<tr><td colspan="7" style="padding:16px"><div style="display:flex;flex-direction:column;gap:10px">
    ${[1,2].map(() => `<div style="height:44px;background:#f1f5f9;border-radius:10px;animation:pulse 1.5s infinite"></div>`).join('')}
  </div></td></tr>`;

  let q = sb.from('blok').select('*, wbp(count)', { count: 'exact' });
  if (search) q = q.ilike('nama', `%${search}%`);
  q = q.order('nama');

  const { data, count } = await q;
  document.getElementById('blokCount').textContent = `${count||0} data`;

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-title">Belum Ada Blok/Kamar</div>
      <div class="empty-desc">Tambahkan blok melalui tombol Tambah Blok</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((b, i) => `
    <tr class="fade-in">
      <td class="text-gray-400 text-xs">${i+1}</td>
      <td class="font-semibold text-sm">${b.nama}</td>
      <td><span class="badge badge-blue">${b.kapasitas||'—'} orang</span></td>
      <td><span class="badge ${b.jk==='L'?'badge-blue':b.jk==='P'?'badge-purple':'badge-gray'}">${b.jk==='L'?'Laki-laki':b.jk==='P'?'Perempuan':'Campur'}</span></td>
      <td class="text-xs text-gray-500">${b.keterangan||'—'}</td>
      <td>
        <span class="font-bold text-sm ${(b.wbp?.[0]?.count||0)>=(b.kapasitas||9999)?'text-red-500':'text-green-600'}">${b.wbp?.[0]?.count||0}</span>
        <span class="text-xs text-gray-400"> / ${b.kapasitas||'?'}</span>
      </td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-warning btn-sm btn-icon" title="Edit" onclick="editBlok('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-icon" title="Hapus" onclick="deleteBlok('${b.id}','${b.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
      </div></td>
    </tr>`).join('');
}

function openBlokModal() {
  ['blokId','blokNama','blokKapasitas','blokKet'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
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
  const id   = document.getElementById('blokId').value;
  const nama = document.getElementById('blokNama').value.trim();
  if (!nama) { showAlert('warning', 'Perhatian', 'Nama blok wajib diisi!'); return; }

  const payload = {
    nama,
    kapasitas:  parseInt(document.getElementById('blokKapasitas').value) || null,
    jk:         document.getElementById('blokJk').value,
    keterangan: document.getElementById('blokKet').value
  };
  const res = id
    ? await sb.from('blok').update(payload).eq('id', id)
    : await sb.from('blok').insert(payload);
  if (res.error) { showAlert('error', 'Gagal', res.error.message); return; }
  showAlert('success', 'Berhasil!', id ? 'Blok diperbarui' : 'Blok ditambahkan');
  closeModal('blokModal'); loadBlok();
}

async function deleteBlok(id, nama) {
  showConfirm('Hapus Blok', `Hapus blok <strong>${nama}</strong>?`, async () => {
    const { error } = await sb.from('blok').delete().eq('id', id);
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    showAlert('success', 'Dihapus!', `Blok ${nama} dihapus`); loadBlok();
  });
}

// ── RIWAYAT ───────────────────────────────────────────────────
async function loadRiwayatFilters() {
  const bs = document.getElementById('riwayatBlokFilter');
  if (bs?.options.length <= 1) {
    const { data: bloks } = await sb.from('blok').select('id,nama').order('nama');
    bloks?.forEach(b => bs.add(new Option(b.nama, b.id)));
  }
  const ps = document.getElementById('riwayatPegawaiFilter');
  if (ps?.options.length <= 1) {
    const { data: pegs } = await sb.from('pegawai').select('id,nama').order('nama');
    pegs?.forEach(p => ps.add(new Option(p.nama, p.id)));
  }
}

async function loadRiwayat() {
  const tbody = document.getElementById('riwayatTableBody');
  tbody.innerHTML = `<tr><td colspan="7" style="padding:16px"><div style="display:flex;flex-direction:column;gap:10px">
    ${[1,2,3,4].map(() => `<div style="height:44px;background:#f1f5f9;border-radius:10px;animation:pulse 1.5s infinite"></div>`).join('')}
  </div></td></tr>`;

  try {
    const gasUrl = window.GAS_URL || APPS_SCRIPT_URL;
    const params = new URLSearchParams({ action: 'getRiwayat', isAdmin: 'true' });
    const dari   = document.getElementById('riwayatDari')?.value;
    const sampai = document.getElementById('riwayatSampai')?.value;
    const blok   = document.getElementById('riwayatBlokFilter')?.value;
    const peg    = document.getElementById('riwayatPegawaiFilter')?.value;
    const search = document.getElementById('riwayatSearch')?.value.trim();
    if (dari)   params.append('dari', dari);
    if (sampai) params.append('sampai', sampai);
    if (blok)   params.append('blok_id', blok);
    if (peg)    params.append('pegawai_id', peg);
    if (search) params.append('search', search);

    const r = await fetch(`${gasUrl}?${params}`);
    const d = await r.json();
    const data = d.data || [];
    window._riwayatData = data;
    document.getElementById('riwayatCount').textContent = `${data.length} data`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <div class="empty-title">Tidak Ada Data</div>
        <div class="empty-desc">Coba ubah filter atau pastikan GAS sudah dikonfigurasi</div>
      </div></td></tr>`;
      document.getElementById('riwayatPagination').innerHTML = ''; return;
    }

    const no0 = (riwayatPage-1)*RIWAYAT_PER_PAGE;
    const pd  = data.slice(no0, no0+RIWAYAT_PER_PAGE);
    tbody.innerHTML = pd.map((row, i) => `
      <tr class="fade-in">
        <td class="text-gray-400 text-xs">${no0+i+1}</td>
        <td class="text-xs text-gray-600">${formatTglWaktu(row.waktu)}</td>
        <td><div class="font-semibold text-sm">${row.pegawai_nama||'—'}</div><div class="text-xs text-gray-400">${row.pegawai_jabatan||''}</div></td>
        <td><span class="badge badge-blue">${row.blok_nama||'—'}</span></td>
        <td><div class="font-medium text-sm">${row.wbp_nama||'—'}</div><div class="text-xs text-gray-400">${row.no_registrasi||''}</div></td>
        <td><span class="badge ${row.status==='Hadir'?'badge-green':'badge-red'}">${row.status||'—'}</span></td>
        <td class="text-xs text-gray-500">${row.keterangan||'—'}</td>
      </tr>`).join('');

    const tot = Math.ceil(data.length/RIWAYAT_PER_PAGE);
    const pag = document.getElementById('riwayatPagination');
    pag.innerHTML = tot > 1
      ? Array.from({length: Math.min(tot,10)}, (_,i) =>
          `<button onclick="riwayatPage=${i+1};loadRiwayat()" class="btn btn-sm ${i+1===riwayatPage?'btn-primary':'btn-ghost'}" style="min-width:32px">${i+1}</button>`
        ).join('')
      : '';
  } catch {
    document.getElementById('riwayatTableBody').innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-title">GAS Belum Dikonfigurasi</div>
      <div class="empty-desc">Atur URL Google Apps Script di Konfigurasi Website</div>
    </div></td></tr>`;
  }
}

function resetRiwayatFilter() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('riwayatSearch').value = '';
  document.getElementById('riwayatDari').value = today;
  document.getElementById('riwayatSampai').value = today;
  document.getElementById('riwayatBlokFilter').value = '';
  document.getElementById('riwayatPegawaiFilter').value = '';
  riwayatPage = 1; loadRiwayat();
}

async function exportRiwayat() {
  const data = window._riwayatData;
  if (!data?.length) { showAlert('warning', 'Perhatian', 'Tidak ada data!'); return; }
  const dari   = document.getElementById('riwayatDari')?.value || '';
  const sampai = document.getElementById('riwayatSampai')?.value || '';
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN ABSENSI WBP', 148, 14, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(document.getElementById('sidebarName')?.textContent || 'SIMAWAR', 148, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Periode: ${dari} s.d. ${sampai}  |  Dicetak: ${formatTglWaktu(new Date())}`, 148, 26, { align: 'center' });
    doc.line(14, 29, 283, 29);
    doc.autoTable({
      startY: 33,
      head: [['No','Waktu','Petugas','Blok','WBP','No. Reg','Status','Keterangan']],
      body: data.map((r,i) => [i+1, formatTglWaktu(r.waktu), r.pegawai_nama||'—', r.blok_nama||'—', r.wbp_nama||'—', r.no_registrasi||'—', r.status||'—', r.keterangan||'—']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30,64,175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] }
    });
    doc.save(`laporan_absensi_${dari}_${sampai}.pdf`);
    showAlert('success', 'Berhasil!', 'PDF diunduh');
  } catch(e) { showAlert('error', 'Gagal', 'Gagal generate PDF: ' + e.message); }
}

// ── AKUN ──────────────────────────────────────────────────────
async function loadAkun() {
  if (!currentAdmin) return;
  const t = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  t('akunNamaDisplay',     currentAdmin.nama);
  t('akunJabatanDisplay',  currentAdmin.role === 'admin' ? 'Administrator' : 'Rupam');
  t('akunPangkatDisplay',  '—');
  t('akunUsernameDisplay', currentAdmin.username);
  t('akunRoleDisplay',     currentAdmin.role === 'admin' ? 'Administrator' : 'Petugas');
  const av = document.getElementById('akunAvatarBig');
  if (av) av.textContent = currentAdmin.nama?.[0]?.toUpperCase() || 'A';
  v('akunNama',     currentAdmin.nama);
  v('akunUsername', currentAdmin.username);
  t('akunEmailDisplay', '—');
}

async function saveAkun() {
  const nama = document.getElementById('akunNama')?.value.trim();
  if (!nama) { showAlert('warning','Perhatian','Nama tidak boleh kosong!'); return; }
  try {
    const { error } = await sb.from('pegawai').update({ nama }).eq('id', currentAdmin.id);
    if (error) throw error;
    currentAdmin.nama = nama;
    document.getElementById('headerUname').textContent    = nama;
    document.getElementById('headerAvatar').textContent   = nama[0].toUpperCase();
    document.getElementById('akunAvatarBig').textContent  = nama[0].toUpperCase();
    document.getElementById('akunNamaDisplay').textContent = nama;
    showAlert('success','Berhasil!','Nama akun diperbarui');
  } catch(e) { showAlert('error','Gagal',e.message); }
}

async function savePassword() {
  const pwd     = document.getElementById('akunPwdBaru')?.value;
  const konfirm = document.getElementById('akunPwdKonfirm')?.value;
  if (!pwd || pwd.length < 8) { showAlert('warning', 'Perhatian', 'Password minimal 8 karakter!'); return; }
  if (pwd !== konfirm) { showAlert('error', 'Tidak Cocok', 'Konfirmasi password tidak sesuai!'); return; }
  showConfirm('Ganti Password', 'Yakin ganti password?', async () => {
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { showAlert('error', 'Gagal', error.message); return; }
    document.getElementById('akunPwdBaru').value = '';
    document.getElementById('akunPwdKonfirm').value = '';
    showAlert('success', 'Berhasil!', 'Password diganti');
  });
}


// Toggle tampilkan/sembunyikan password pegawai
function togglePwd(id, pwd) {
  const el = document.getElementById('pwd_' + id);
  if (!el) return;
  if (el.textContent === '••••••••') {
    el.textContent = pwd || '(kosong)';
    el.style.background = '#fef9c3';
    el.style.borderColor = '#fcd34d';
    el.style.color = '#92400e';
  } else {
    el.textContent = '••••••••';
    el.style.background = '';
    el.style.borderColor = '';
    el.style.color = '';
  }
}

// ── START ─────────────────────────────────────────────────────
init();
