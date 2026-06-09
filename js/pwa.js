// SIMAWAR PWA register + offline detector
// Include di setiap halaman (admin.html, user.html, index.html)
(function(){
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[PWA] SW registered:', reg.scope))
        .catch(err => console.log('[PWA] SW failed:', err));
    });
  }

  // 2. Offline detector — show banner saat offline
  function showOfflineBanner(isOffline) {
    let banner = document.getElementById('offline-banner');
    if (isOffline) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:10px 16px;text-align:center;z-index:99999;font-size:13px;font-weight:700;box-shadow:0 2px 12px rgba(239,68,68,.3);display:flex;align-items:center;justify-content:center;gap:8px;animation:slideDown .3s ease';
        banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"/></svg> Tidak Ada Koneksi Internet';
        document.body.appendChild(banner);
        const style = document.createElement('style');
        style.textContent = '@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}';
        document.head.appendChild(style);
      }
    } else {
      if (banner) {
        banner.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Koneksi Pulih';
        setTimeout(() => { banner.style.animation = 'slideDown .3s ease reverse'; setTimeout(()=>banner.remove(),300); }, 1800);
      }
    }
  }
  window.addEventListener('online', () => showOfflineBanner(false));
  window.addEventListener('offline', () => showOfflineBanner(true));
  // Initial check
  if (!navigator.onLine) showOfflineBanner(true);

  // 3. PWA install prompt — simpan event, tampilkan tombol install jika diizinkan
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    // Expose ke window agar bisa dipanggil dari tombol
    window._pwaInstall = async () => {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      return outcome === 'accepted';
    };
    window._pwaCanInstall = true;
    // Trigger custom event agar UI bisa update
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window._pwaCanInstall = false;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
})();
