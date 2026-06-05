// ============================================================
// KONFIGURASI - Ganti dengan kredensial Anda
// ============================================================
const SUPABASE_URL = 'https://ulxghrhnovtkodqpubbr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseGdocmhub3Z0a29kcXB1YmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDAwMTUsImV4cCI6MjA5NjE3NjAxNX0.GdjCCY5RN3nLeAlYqibMWV_AyNw14zZIkMCZqMtzYIc';


// Init Supabase client
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// ALERT SYSTEM
// ============================================================
function showAlert(type, title, message, duration = 4000) {
  document.querySelector('.lapas-alert')?.remove();
  const colors = { success:'from-emerald-500 to-teal-500', error:'from-red-500 to-rose-500', warning:'from-amber-500 to-orange-500', info:'from-blue-500 to-indigo-500' };
  const icons  = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>',
    info:    '<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>'
  };
  const el = document.createElement('div');
  el.className = 'lapas-alert';
  el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;max-width:360px;width:100%;opacity:0;transform:translateX(30px);transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1)';
  el.innerHTML = `<div style="background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid #f1f5f9;overflow:hidden;position:relative">
    <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(to bottom,var(--c1),var(--c2))"></div>
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 14px 14px 18px">
      <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,var(--c1),var(--c2));display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="${icons[type].match(/d="([^"]+)"/)?.[1]||''}"/></svg>
      </div>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#1e293b">${title}</div><div style="font-size:12px;color:#64748b;margin-top:2px;line-height:1.4">${message}</div></div>
      <button onclick="this.closest('.lapas-alert').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:2px;flex-shrink:0;font-size:16px;line-height:1">×</button>
    </div>
    <div style="height:3px;background:#f1f5f9"><div class="ap" style="height:100%;width:100%;background:linear-gradient(90deg,var(--c1),var(--c2));transition:width ${duration}ms linear"></div></div>
  </div>`;
  const clrs = { success:['#10b981','#059669'], error:['#ef4444','#dc2626'], warning:['#f59e0b','#d97706'], info:['#3b82f6','#1d4ed8'] };
  el.style.setProperty('--c1', clrs[type][0]);
  el.style.setProperty('--c2', clrs[type][1]);
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity='1'; el.style.transform='translateX(0)'; });
  requestAnimationFrame(() => requestAnimationFrame(() => { const ap = el.querySelector('.ap'); if(ap) ap.style.width='0%'; }));
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(30px)'; setTimeout(()=>el.remove(),350); }, duration);
}

function showConfirm(title, message, onConfirm, type='danger') {
  document.querySelector('.lapas-confirm')?.remove();
  const btnColors = { danger:'background:linear-gradient(135deg,#ef4444,#dc2626)', warning:'background:linear-gradient(135deg,#f59e0b,#d97706)', info:'background:linear-gradient(135deg,#3b82f6,#1d4ed8)' };
  const overlay = document.createElement('div');
  overlay.className = 'lapas-confirm';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px)';
  overlay.innerHTML = `<div style="background:white;border-radius:24px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.2);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)" id="confirmBox">
    <div style="padding:24px 24px 16px">
      <div style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:6px">${title}</div>
      <div style="font-size:13px;color:#64748b;line-height:1.5">${message}</div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;padding:12px 24px 20px">
      <button id="cancelBtn" style="padding:9px 18px;border-radius:10px;border:none;background:#f1f5f9;color:#64748b;font-size:13px;font-weight:600;cursor:pointer">Batal</button>
      <button id="okBtn" style="padding:9px 18px;border-radius:10px;border:none;${btnColors[type]||btnColors.danger};color:white;font-size:13px;font-weight:700;cursor:pointer">Ya, Lanjutkan</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const box = overlay.querySelector('#confirmBox');
  requestAnimationFrame(() => { box.style.transform='scale(1)'; box.style.opacity='1'; });
  overlay.querySelector('#cancelBtn').onclick = () => overlay.remove();
  overlay.querySelector('#okBtn').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
}

function skeletonRow(cols) {
  return `<tr>${Array(cols).fill(`<td style="padding:12px 14px"><div style="height:16px;background:#f1f5f9;border-radius:6px;animation:pulse 1.5s infinite"></div></td>`).join('')}</tr>`;
}

function formatTglWaktu(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}

function formatTgl(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
}
