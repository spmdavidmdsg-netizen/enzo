/* Service worker de Enzo: guarda la app para abrirla sin internet.
   Estrategia: primero la red (para recibir actualizaciones) y, si falla, la copia guardada.
   Las llamadas a Apps Script no pasan por aquí: son de otro dominio. */
const VERSION = 'enzo-v11';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/util.js', 'js/store.js', 'js/api.js', 'js/tipos.js',
  'js/pages/pendientes.js', 'js/pages/rutina.js', 'js/desplegable.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        if (r.ok) caches.open(VERSION).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
