/* Service worker de Enzo: guarda la app para abrirla sin internet o con mala señal.
   Estrategia: pide la versión nueva a la red, pero si tarda más de 2.5 s (o falla) abre la copia guardada.
   Lo que llegue de la red se guarda igual, para la siguiente vez que abras Enzo.
   Las llamadas a Apps Script no pasan por aquí: son de otro dominio. */
const VERSION = 'enzo-v32';
const ESPERA_RED = 2500;
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/app.js', 'js/buscador.js', 'js/config.js', 'js/util.js', 'js/store.js', 'js/api.js', 'js/tipos.js',
  'js/pages/pendientes.js', 'js/pages/rutina.js', 'js/pages/ejercicio.js', 'js/ejercicios.js', 'js/pages/proyectos.js', 'js/pages/notas.js', 'js/pages/presupuesto.js', 'js/desplegable.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png'
];

/* Imágenes de los ejercicios (~16 KB cada una): se guardan para entrenar sin señal. Si alguna falla, la app instala igual. */
const IMAGENES = ['abdominal-crunches', 'bar-dips', 'bicycle-crunches', 'butt-bridge', 'cobra-stretch', 'crossover-crunch', 'dumbbell-curl',
  'hammer-curl', 'heel-touch', 'jump-rope', 'lateral-raise', 'leg-raises', 'lumbar-twist', 'mountain-climber', 'plank', 'pullup-overhand',
  'pullup-underhand', 'push-ups', 'shoulder-press', 'side-bridges', 'side-plank', 'v-up'].map(k => `img/ej/${k}.webp`);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))
    .then(() => Promise.all(IMAGENES.map(u => c.add(u).catch(() => {}))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const guardada = req => caches.match(req, { ignoreSearch: true })
  .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  /* cache: 'no-cache' = preguntar al servidor si hay versión nueva (GitHub Pages guarda 10 min). */
  const red = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
    return r;
  });
  e.waitUntil(red.then(() => {}, () => {}));   // que termine de guardarse aunque ya hayamos respondido

  e.respondWith(new Promise(responder => {
    let listo = false;
    const usar = r => { if (!listo && r) { listo = true; responder(r); } };
    /* Mala señal: si la red no contesta a tiempo, abre la copia guardada */
    const reloj = setTimeout(() => guardada(e.request).then(usar), ESPERA_RED);
    red.then(r => { clearTimeout(reloj); usar(r); })
      .catch(() => {
        clearTimeout(reloj);
        guardada(e.request).then(r => { if (r) usar(r); else if (!listo) { listo = true; responder(Response.error()); } });
      });
  }));
});
