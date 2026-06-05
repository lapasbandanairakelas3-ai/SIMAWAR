// ============================================================
// KONFIGURASI - Ganti dengan kredensial Anda
// ============================================================
const SUPABASE_URL = 'https://ulxghrhnovtkodqpubbr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseGdocmhub3Z0a29kcXB1YmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDAwMTUsImV4cCI6MjA5NjE3NjAxNX0.GdjCCY5RN3nLeAlYqibMWV_AyNw14zZIkMCZqMtzYIc';

// Google Apps Script URL untuk data absensi
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwsbtc6-2WzTLgKnCkeWssmH_DxoSVRME5Ka5Wb9upobETp4DHrQL6gOZqIyB3S_7AHUA/exec';
// Instagram & TikTok pembuat
const CREATOR_IG = 'https://instagram.com/wa_miranti';
const CREATOR_TT = 'https://tiktok.com/@wa_miranti';

// ============================================================
// INIT SUPABASE
// ============================================================
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// ALERT SYSTEM
// ============================================================
function showAlert(type, title, message, duration = 4000) {
  const existing = document.querySelector('.lapas-alert');
  if (existing) existing.remove();

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>`
  };

  const colors = {
    success: 'from-emerald-500 to-teal-500',
    error: 'from-red-500 to-rose-500',
    warning: 'from-amber-500 to-orange-500',
    info: 'from-blue-500 to-indigo-500'
  };

  const el = document.createElement('div');
  el.className = 'lapas-alert fixed top-5 right-5 z-[9999] max-w-sm w-full';
  el.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl shadow-2xl bg-white border border-gray-100">
      <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${colors[type]}"></div>
      <div class="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${colors[type]} opacity-30"></div>
      <div class="flex items-start gap-3 p-4 pl-5">
        <div class="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${colors[type]} flex items-center justify-center text-white [&_svg]:w-4 [&_svg]:h-4 mt-0.5">
          ${icons[type]}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-900">${title}</p>
          <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">${message}</p>
        </div>
        <button onclick="this.closest('.lapas-alert').remove()" class="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="alert-progress absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${colors[type]}" style="width:100%;transition:width ${duration}ms linear"></div>
    </div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.querySelector('.alert-progress').style.width = '0%';
  });

  const timer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);

  el.style.opacity = '0';
  el.style.transform = 'translateX(100%)';
  el.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
  setTimeout(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  }, 10);
}

// Confirm Dialog
function showConfirm(title, message, onConfirm, type = 'danger') {
  const existing = document.querySelector('.lapas-confirm');
  if (existing) existing.remove();

  const colors = {
    danger: { btn: 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600', icon: 'text-red-500', bg: 'bg-red-50' },
    warning: { btn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600', icon: 'text-amber-500', bg: 'bg-amber-50' },
    info: { btn: 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600', icon: 'text-blue-500', bg: 'bg-blue-50' }
  };
  const c = colors[type];

  const overlay = document.createElement('div');
  overlay.className = 'lapas-confirm fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-95 opacity-0" id="confirmBox">
      <div class="${c.bg} p-6 flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl ${c.bg} border-2 border-current ${c.icon} flex items-center justify-center">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-900">${title}</h3>
          <p class="text-sm text-gray-600 mt-0.5">${message}</p>
        </div>
      </div>
      <div class="p-4 flex gap-3 justify-end bg-gray-50">
        <button id="cancelConfirm" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Batal</button>
        <button id="okConfirm" class="px-5 py-2.5 rounded-xl text-sm font-bold text-white ${c.btn} transition-all shadow-lg">Ya, Lanjutkan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const box = overlay.querySelector('#confirmBox');
  setTimeout(() => { box.classList.remove('scale-95', 'opacity-0'); box.classList.add('scale-100', 'opacity-100'); }, 10);

  overlay.querySelector('#cancelConfirm').onclick = () => overlay.remove();
  overlay.querySelector('#okConfirm').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// Skeleton loader generator
function skeletonRow(cols = 4) {
  return `<tr class="animate-pulse">${Array(cols).fill(`<td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded-lg w-full"></div></td>`).join('')}</tr>`;
}

function skeletonCard() {
  return `<div class="animate-pulse bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-12 h-12 bg-gray-200 rounded-xl"></div>
      <div class="flex-1"><div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div class="h-3 bg-gray-200 rounded w-1/2"></div></div>
    </div>
    <div class="space-y-2"><div class="h-3 bg-gray-200 rounded"></div><div class="h-3 bg-gray-200 rounded w-5/6"></div></div>
  </div>`;
}

// Format tanggal Indonesia
function formatTgl(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTglWaktu(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Auth helper
async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function getUserProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await sb.from('pegawai').select('*').eq('user_id', user.id).single();
  return data;
}

// Export ke PDF via print
function printToPDF(elementId, title) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; font-size: 12px; color: #1a1a1a; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f8fafc; }
      h2 { color: #1e40af; margin-bottom: 4px; }
      .meta { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style>
  </head><body>
    <h2>${title}</h2>
    <p class="meta">Dicetak pada: ${formatTglWaktu(new Date())}</p>
    ${el.innerHTML}
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}
