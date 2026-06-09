
const SUPABASE_URL = 'https://ulxghrhnovtkodqpubbr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseGdocmhub3Z0a29kcXB1YmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDAwMTUsImV4cCI6MjA5NjE3NjAxNX0.GdjCCY5RN3nLeAlYqibMWV_AyNw14zZIkMCZqMtzYIc';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── SHIFT ─────────────────────────────────────────────────────
// PAGI: 00–07:59, SIANG: 08–13:59, MALAM: 14–23:59 (WIT)
function getShiftNow() {
  // WIT = Asia/Jayapura
  const timeStr = new Date().toLocaleString('id-ID', { timeZone:'Asia/Jayapura', hour:'2-digit', minute:'2-digit', hour12:false });
  const h = parseInt(timeStr.split('.')[0] || timeStr.split(':')[0]);
  if (h < 8)  return 'Pagi';
  if (h < 14) return 'Siang';
  return 'Malam';
}
const SHIFT_LIST  = ['Pagi','Siang','Malam'];
const SHIFT_ICON  = { Pagi:'🌅', Siang:'☀️', Malam:'🌙' };
const SHIFT_COLOR = { Pagi:'#f59e0b', Siang:'#3b82f6', Malam:'#6366f1' };
const SHIFT_BG    = { Pagi:'#fef3c7', Siang:'#dbeafe', Malam:'#ede9fe' };
const SHIFT_TC    = { Pagi:'#92400e', Siang:'#1e40af', Malam:'#4338ca' };
const SHIFT_LABEL = { Pagi:'PAGI SEBELUM JAM 08.00', Siang:'SIANG SEBELUM JAM 14.00', Malam:'MALAM SEBELUM JAM 20.00' };

function shiftBadge(shift) {
  const s = shift || 'Pagi';
  return `<span style="background:${SHIFT_BG[s]||'#f1f5f9'};color:${SHIFT_TC[s]||'#374151'};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap">${SHIFT_ICON[s]||''} ${s}</span>`;
}

// ── STATUS ────────────────────────────────────────────────────
// Diambil dari DB, default fallback
let _statusList = ['Ada','Di Bengkel','Di Kebun','Di Rumah Sakit'];
async function loadStatusList() {
  try {
    const { data, error } = await sb.from('status_absen').select('nama').eq('aktif',true).order('urutan');
    if (!error && data?.length) _statusList = data.map(d => d.nama);
  } catch(e) { /* keep default fallback */ }
  return _statusList;
}
function getStatusList() { return _statusList; }

function statusBadge(status) {
  const s = status || '—';
  const colors = {
    'Ada':            ['#d1fae5','#065f46'],
    'Di Bengkel':     ['#fef3c7','#92400e'],
    'Di Kebun':       ['#dcfce7','#14532d'],
    'Di Rumah Sakit': ['#dbeafe','#1e40af'],
  };
  const [bg, tc] = colors[s] || ['#f1f5f9','#475569'];
  return `<span style="background:${bg};color:${tc};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap">${s}</span>`;
}

// ── TIMEZONE WIT ──────────────────────────────────────────────
function todayWIT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone:'Asia/Jayapura' });
}
function formatWIT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    timeZone:'Asia/Jayapura', day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}
function formatTanggalWIT(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${hari[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}

// ── ALERT ─────────────────────────────────────────────────────
function showAlert(type, title, msg, dur=4000) {
  document.querySelector('.sw-alert')?.remove();
  const C = { success:['#10b981','#059669'], error:['#ef4444','#dc2626'], warning:['#f59e0b','#d97706'], info:['#3b82f6','#1d4ed8'] };
  const IC = { success:'M4.5 12.75l6 6 9-13.5', error:'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', warning:'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z', info:'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' };
  const [c1,c2] = C[type]||C.info;
  const el = document.createElement('div'); el.className='sw-alert';
  el.style.cssText='position:fixed;top:20px;right:20px;z-index:99999;max-width:360px;width:calc(100vw - 40px);opacity:0;transform:translateX(30px);transition:all .35s cubic-bezier(.34,1.56,.64,1)';
  el.innerHTML=`<div style="background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.12);border:1px solid #f1f5f9;overflow:hidden"><div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(${c1},${c2})"></div><div style="display:flex;align-items:flex-start;gap:12px;padding:14px 14px 14px 18px"><div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="${IC[type]}"/></svg></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#1e293b">${title}</div><div style="font-size:12px;color:#64748b;margin-top:2px;line-height:1.5">${msg}</div></div><button onclick="this.closest('.sw-alert').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:18px;padding:0;line-height:1;flex-shrink:0">×</button></div><div style="height:3px;background:#f1f5f9"><div id="swp" style="height:100%;width:100%;background:linear-gradient(90deg,${c1},${c2});transition:width ${dur}ms linear"></div></div></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateX(0)'; });
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ const p=el.querySelector('#swp'); if(p)p.style.width='0%'; }));
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(30px)'; setTimeout(()=>el.remove(),350); }, dur);
}
function showConfirm(title, msg, onOk, type='danger') {
  document.querySelector('.sw-confirm')?.remove();
  const BC = { danger:'linear-gradient(135deg,#ef4444,#dc2626)', warning:'linear-gradient(135deg,#f59e0b,#d97706)', info:'linear-gradient(135deg,#3b82f6,#1d4ed8)' };
  const ov = document.createElement('div'); ov.className='sw-confirm';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.4);backdrop-filter:blur(4px)';
  ov.innerHTML=`<div id="scc" style="background:white;border-radius:24px;max-width:400px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.2);transform:scale(.9);opacity:0;transition:all .3s cubic-bezier(.34,1.56,.64,1)"><div style="padding:24px 24px 16px"><div style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:6px">${title}</div><div style="font-size:13px;color:#64748b;line-height:1.5">${msg}</div></div><div style="display:flex;gap:10px;justify-content:flex-end;padding:12px 24px 20px"><button id="scc_n" style="padding:9px 18px;border-radius:10px;border:none;background:#f1f5f9;color:#64748b;font-size:13px;font-weight:600;cursor:pointer">Batal</button><button id="scc_y" style="padding:9px 18px;border-radius:10px;border:none;background:${BC[type]||BC.danger};color:white;font-size:13px;font-weight:700;cursor:pointer">Ya, Lanjutkan</button></div></div>`;
  document.body.appendChild(ov);
  const box=ov.querySelector('#scc'); requestAnimationFrame(()=>{ box.style.transform='scale(1)'; box.style.opacity='1'; });
  ov.querySelector('#scc_n').onclick=()=>ov.remove();
  ov.querySelector('#scc_y').onclick=()=>{ ov.remove(); onOk(); };
  ov.onclick=e=>{ if(e.target===ov)ov.remove(); };
}
function skel(h=16, cols=1) {
  return `<tr>${Array(cols).fill(`<td style="padding:10px 14px"><div style="height:${h}px;background:#f1f5f9;border-radius:6px;animation:swpulse 1.5s infinite"></div></td>`).join('')}</tr>`;
}
function emptyState(title, sub='') {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center"><div style="width:56px;height:56px;border-radius:16px;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="1.5" style="width:28px;height:28px"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg></div><div style="font-size:14px;font-weight:700;color:#374151">${title}</div>${sub?`<div style="font-size:12px;color:#94a3b8;margin-top:4px;max-width:200px">${sub}</div>`:''}</div>`;
}

// ── SITE IDENTITY (terpusat) ───────────────────────────────
// Hanya panggil 1x per page, hasilnya di-cache di window._siteIdentity
let _siteIdentityPromise = null;
async function loadSiteIdentity(force=false) {
  if (window._siteIdentity && !force) return window._siteIdentity;
  if (_siteIdentityPromise && !force) return _siteIdentityPromise;
  _siteIdentityPromise = (async () => {
    let identity = {
      site_name: 'E-PRESINA',
      site_desc: 'Sistem Informasi Monitoring Warga Binaan',
      logo_url: '',
      favicon_url: '',
      instansi: 'Lapas Kelas III Bandanaira',
      alamat: ''
    };
    try {
      const { data, error } = await sb.from('site_config').select('*').maybeSingle();
      if (!error && data) identity = { ...identity, ...data };
    } catch (e) { /* fallback to defaults */ }
    window._siteIdentity = identity;
    // Cache di localStorage 1 jam (untuk PWA offline)
    try {
      localStorage.setItem('sw_site_identity', JSON.stringify({ ...identity, _ts: Date.now() }));
    } catch (e) {}
    return identity;
  })();
  return _siteIdentityPromise;
}

// Try load dari localStorage segera (sync) sebelum DB - untuk first paint
(function preloadIdentity() {
  try {
    const cached = localStorage.getItem('sw_site_identity');
    if (cached) {
      const data = JSON.parse(cached);
      // Pakai cache kalau umurnya < 1 jam
      if (data._ts && Date.now() - data._ts < 3600000) {
        window._siteIdentity = data;
      }
    }
  } catch (e) {}
})();

// Apply identity ke title + favicon + sidebar
// pageTitle: prefix untuk title (cth: "Admin", "Petugas", "Masuk")
async function applySiteIdentity(opts = {}) {
  const { pageTitle = '', logoWrapId, nameWrapId, descWrapId, sidebarLogo, sidebarName } = opts;
  const data = await loadSiteIdentity();
  // Document title
  document.title = pageTitle ? `${pageTitle} — ${data.site_name}` : data.site_name;
  // Favicon
  if (data.favicon_url) {
    let fav = document.getElementById('faviconEl') || document.querySelector('link[rel="icon"]');
    if (fav) fav.href = data.favicon_url;
  }
  // Apple touch icon (PWA install)
  if (data.logo_url) {
    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (apple) apple.href = data.logo_url;
  }
  // Sidebar brand
  if (sidebarLogo) {
    const sl = document.getElementById(sidebarLogo);
    if (sl) {
      if (data.logo_url) {
        const emoji = document.getElementById('sidebarLogoEmoji');
        if (emoji) emoji.style.display = 'none';
        if (!sl.querySelector('img')) {
          const img = document.createElement('img');
          img.src = data.logo_url;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px';
          sl.appendChild(img);
        } else {
          sl.querySelector('img').src = data.logo_url;
        }
      }
    }
  }
  if (sidebarName) {
    const sn = document.getElementById(sidebarName);
    if (sn) sn.textContent = data.site_name;
  }
  return data;
}

// Load splash dari site_config (DEPRECATED - prefer applySiteIdentity)
async function loadSplashFromDB(logoWrapId, nameWrapId, descWrapId) {
  try {
    const data = await loadSiteIdentity();
    if (!data) throw new Error('no data');
    const sl=document.getElementById(logoWrapId); if(sl){sl.style.animation='none';if(data.logo_url){const img=document.createElement('img');img.src=data.logo_url;img.style.cssText='width:100%;height:100%;object-fit:cover';sl.appendChild(img);}else{sl.textContent='🏛️';sl.style.fontSize='30px';}}
    const sn=document.getElementById(nameWrapId); if(sn){sn.style.cssText='color:white;font-size:20px;font-weight:800;background:none;animation:none;height:auto;width:auto;border-radius:0;margin-bottom:5px';sn.textContent=data.site_name|| 'E-PRESINA';}
    const sd=document.getElementById(descWrapId); if(sd){sd.style.cssText='color:rgba(255,255,255,.7);font-size:12px;background:none;animation:none;height:auto;width:auto;border-radius:0;text-align:center';sd.textContent=(data.site_desc||'').split('\n')[0]||'Sistem Informasi Monitoring Warga Binaan';}
  } catch(e) {
    const sl=document.getElementById(logoWrapId);if(sl){sl.textContent='🏛️';sl.style.fontSize='30px';sl.style.animation='none';}
    const sn=document.getElementById(nameWrapId);if(sn){sn.style.cssText='color:white;font-size:20px;font-weight:800;background:none;animation:none;height:auto;width:auto;border-radius:0;margin-bottom:5px';sn.textContent='E-PRESINA';}
    const sd=document.getElementById(descWrapId);if(sd){sd.style.cssText='color:rgba(255,255,255,.7);font-size:12px;background:none;animation:none;height:auto;width:auto;border-radius:0;text-align:center';sd.textContent='Sistem Informasi Monitoring Warga Binaan';}
  }
}

const _st=document.createElement('style');
_st.textContent='@keyframes swpulse{0%,100%{opacity:1}50%{opacity:.5}}';
document.head.appendChild(_st);
