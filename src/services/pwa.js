// App web instalable (PWA): manifiesto, service worker, pantalla de carga y aviso de instalación.
// El evento «beforeinstallprompt» se captura aquí, al arrancar, para no perderlo aunque ninguna
// pantalla esté escuchando todavía; las pantallas se suscriben con onInstallChange().

export function isWebPwaStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

// iPhone/iPad no tienen botón de instalar: se instala desde Compartir › Agregar a pantalla de inicio.
export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => { try { fn(getInstallState()); } catch {} });

export function getInstallState() {
  const standalone = isWebPwaStandalone();
  return { standalone, canPrompt: !!deferredPrompt && !standalone, ios: isIOSDevice() && !standalone };
}
export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Abre el diálogo de instalación del navegador. Devuelve 'accepted', 'dismissed' o 'unavailable'.
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  try {
    event.prompt();
    const choice = await event.userChoice;
    return choice?.outcome || 'dismissed';
  } catch { return 'dismissed'; }
  finally { notify(); }
}

// El aviso de instalación se puede descartar; vuelve a ofrecerse a los 14 días.
const DISMISS_KEY = 'mm-install-dismissed-at';
export function installDismissed() {
  try { const at = Number(window.localStorage.getItem(DISMISS_KEY) || 0); return at && Date.now() - at < 14 * 86400000; } catch { return false; }
}
export function dismissInstall() { try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} notify(); }

// Pantalla de carga (public/index.html): se desvanece cuando la app ya dibujó algo en #root.
function hideBootSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  const done = () => { splash.classList.add('boot-hide'); setTimeout(() => splash.remove(), 400); };
  const root = document.getElementById('root');
  const ready = () => root && root.childElementCount > 0;
  const finish = () => requestAnimationFrame(() => requestAnimationFrame(done));
  if (ready()) { finish(); return; }
  const fallback = setTimeout(done, 10000);
  if (!root || typeof MutationObserver === 'undefined') { setTimeout(done, 1200); return; }
  const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); clearTimeout(fallback); finish(); } });
  observer.observe(root, { childList: true });
}

export function registerWebApp() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const ensureLink = (rel, href, attrs = {}) => {
    if (document.querySelector(`link[rel="${rel}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
    document.head.appendChild(link);
  };

  // Ya vienen en public/index.html; se aseguran por si se sirve otra plantilla.
  ensureLink('manifest', '/manifest.webmanifest');
  ensureLink('apple-touch-icon', '/icons/apple-touch-icon.png');
  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#FFFFFF';
    document.head.appendChild(theme);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; notify(); });

  hideBootSplash();

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Keep production app-shell caches out of Metro's development session.
      navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
        registrations.filter(registration => registration.active?.scriptURL === `${window.location.origin}/sw.js`)
          .map(registration => registration.unregister())
      )).catch(error => console.warn('No se pudo desactivar la caché de desarrollo:', error.message));
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('No se pudo registrar el service worker:', error.message);
      });
    });
  }
}
