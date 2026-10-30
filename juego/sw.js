// Service worker: guarda el port (no los datos del juego, que salen de tu carpeta) para que funcione sin conexión
const V = 'brr-v7', FILES = ['./BigRedRacing.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './title.jpg', './paypal_qr.png',
  ...['lang', 'i18n', 'brrdata', 'zip', 'model3dw', 'level', 'vehicle', 'carsx', 'race', 'ai', 'replay', 'props', 'effects', 'audio', 'render', 'net', 'p2p', 'version', 'cloud', 'front', 'origmenu', 'logos_data', 'horns_data', 'horns', 'drift_data', 'editor', 'main'].map(n => './js/' + n + '.js')];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// primero la red (para tener siempre la última versión) y, sin conexión, lo guardado
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
