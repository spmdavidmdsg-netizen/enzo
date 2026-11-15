/* Enzo · arranque, bienvenida, menú de páginas, Ajustes, hoja, buscador, atajos y avisos. */
import { $, esc, reduceMotion, fechaCorta } from './util.js';
import * as store from './store.js';
import * as api from './api.js';
import * as pendientes from './pages/pendientes.js';
import * as rutina from './pages/rutina.js';
import { cargarTipos } from './tipos.js';

const PAGES = [
  { id: 'pendientes', nombre: 'Pendientes', mod: pendientes },
  { id: 'rutina', nombre: 'Rutina', mod: rutina }
];
const ui = { page: leerPref('enzo-pagina', 'pendientes'), bienvenida: !new URLSearchParams(location.search).has('sinbienvenida') };
if (!PAGES.some(p => p.id === ui.page)) ui.page = 'pendientes';

function leerPref(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
function fijarPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
/* El nombre vive en la hoja (Config, id "nombre") para verse igual en todos tus dispositivos. */
const nombre = () => { const c = store.state.config.find(x => x.id === 'nombre'); return (c && c.valor) || leerPref('enzo-nombre', 'David'); };
const escribiendo = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const hojaAbierta = () => document.body.classList.contains('sheet-open');

/* ---------- contexto que reciben las páginas ---------- */
const ctx = { store, toast, abrirHoja, cerrarHoja, render: () => render() };

/* ---------- render ----------
   Cada render crea un contenedor nuevo, así los eventos de la página no se acumulan. */
let entrada = true, te = null;
function render() {
  const p = PAGES.find(x => x.id === ui.page), v = $('#view');
  const caja = document.createElement('div');
  caja.innerHTML = p.mod.render(ctx);
  v.replaceChildren(caja);
  p.mod.montar?.(caja, ctx);
  if (entrada && !ui.bienvenida) { entrada = false; v.classList.add('enter'); clearTimeout(te); te = setTimeout(() => v.classList.remove('enter'), 900); }
  document.body.dataset.page = ui.page;
  $('#cap-label').textContent = p.nombre;
  $('#cap-pop').innerHTML = PAGES.map(x => `<button class="pop-item" data-page="${x.id}" aria-current="${x.id === ui.page}">${x.nombre}</button>`).join('');
  pintarSync();
}

function ir(id) {
  if (id === ui.page) return;
  ui.page = id; fijarPref('enzo-pagina', id); entrada = true;
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(render);
  else render();
  window.scrollTo(0, 0);
}

/* Menú de página: un toque pasa a la siguiente; mantener presionado muestra la lista. */
const capW = $('.cap-wrap');
let capLp = null, capUsado = false;
const capLista = abrir => capW.classList.toggle('open', abrir);
$('#cap').addEventListener('pointerdown', e => {
  capUsado = false;
  if (e.button > 0) return;
  clearTimeout(capLp);
  capLp = setTimeout(() => { capUsado = true; capLista(true); }, 450);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('#cap').addEventListener(t, () => clearTimeout(capLp)));
$('#cap').addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerdown', e => { if (capW.classList.contains('open') && !capW.contains(e.target)) capLista(false); });
$('#cap').addEventListener('click', () => {
  if (capUsado) { capUsado = false; return; }
  capLista(false);
  const i = PAGES.findIndex(x => x.id === ui.page);
  ir(PAGES[(i + 1) % PAGES.length].id);
});
$('#fab').addEventListener('click', () => pendientes.abrirDetalle(ctx, null, $('#fab')));
$('#cap-pop').addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (b) { capLista(false); ir(b.dataset.page); b.blur(); }
});

/* ---------- bienvenida (cada vez que la app se abre desde cero) ---------- */
function saludo() {
  const h = new Date().getHours();
  return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + nombre();
}
function pintarBienvenida() {
  $('#w-hi').textContent = saludo();
  const q = pendientes.quick(store.state).length;
  $('#w-sub').textContent = q ? (q === 1 ? 'Tienes 1 pendiente para hoy.' : `Tienes ${q} pendientes para hoy.`) : 'No tienes pendientes para hoy.';
  $('.w-btn').classList.remove('loading');
}
function entrar() {
  if (!ui.bienvenida) return;
  ui.bienvenida = false;
  $('#welcome').classList.add('gone');
  $('#app').inert = false;
  entrada = true; render();
}
$('.w-btn').addEventListener('click', entrar);
if (ui.bienvenida) { $('#app').inert = true; $('#w-hi').textContent = saludo(); }
else $('#welcome').remove();

/* ---------- tema ---------- */
const media = matchMedia('(prefers-color-scheme: light)');
function aplicarTema() {
  document.documentElement.dataset.vidrio = leerPref('enzo-vidrio', 'claro');
  const p = leerPref('enzo-tema', 'auto');
  document.documentElement.dataset.theme = p === 'auto' ? (media.matches ? 'light' : 'dark') : p;
}
media.addEventListener('change', aplicarTema);

/* ---------- Ajustes ---------- */
const menu = $('#menu'), me = $('#me');
function abrirMenu(abrir) {
  menu.classList.toggle('open', abrir);
  me.setAttribute('aria-expanded', abrir);
  if (abrir) pintarMenu();
}
/* Círculo del usuario.
   Celular: un toque cambia entre claro y oscuro; mantener presionado abre Ajustes.
   Mac: clic o cursor encima abre Ajustes; la tecla C cambia el tema. */
const esEscritorio = () => matchMedia('(min-width:820px)').matches;
function alternarTema() {
  const nuevo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  fijarPref('enzo-tema', nuevo);
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(aplicarTema); else aplicarTema();
  if (menu.classList.contains('open')) pintarMenu();
}
let meLp = null, meUsado = false;
me.addEventListener('pointerdown', e => {
  meUsado = false;
  if (e.button > 0 || esEscritorio()) return;
  clearTimeout(meLp);
  meLp = setTimeout(() => { meUsado = true; abrirMenu(true); }, 450);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => me.addEventListener(t, () => clearTimeout(meLp)));
me.addEventListener('contextmenu', e => { e.preventDefault(); abrirMenu(true); });
me.addEventListener('click', () => {
  if (meUsado) { meUsado = false; return; }
  if (esEscritorio()) abrirMenu(!menu.classList.contains('open'));
  else alternarTema();
});
me.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); abrirMenu(true); menu.querySelector('input,button')?.focus(); } });
/* Cursor encima: solo en la Mac (pantalla ancha); en el celular el menú se abre únicamente con long press. */
let tHover = null;
const cursorEntra = () => { if (!esEscritorio()) return; clearTimeout(tHover); if (!menu.classList.contains('open')) tHover = setTimeout(() => abrirMenu(true), 120); };
const cursorSale = () => {
  if (!esEscritorio()) return;
  clearTimeout(tHover);
  tHover = setTimeout(() => { if (!menu.contains(document.activeElement) || !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) abrirMenu(false); }, 280);
};
[me, menu].forEach(el => { el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') cursorEntra(); }); el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') cursorSale(); }); });
document.addEventListener('pointerdown', e => {
  if (menu.classList.contains('open') && !menu.contains(e.target) && !me.contains(e.target)) abrirMenu(false);
});

const TEXTO_SYNC = { local: 'Solo en este dispositivo', ok: 'Sincronizado', pendiente: 'Cambios por enviar', sincronizando: 'Sincronizando…', error: 'No se pudo sincronizar' };
function hace(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? ' · justo ahora' : m < 60 ? ` · hace ${m} min` : '';
}

function pintarMenu() {
  const sistema = leerPref('enzo-tema', 'auto') === 'auto';
  const vidrio = leerPref('enzo-vidrio', 'claro'), vidrios = [['claro', 'Claro'], ['tintado', 'Tintado']];
  const con = api.conectado(), est = store.estado;
  menu.innerHTML = `<h2>Ajustes</h2>
    <div class="field"><label for="m-nombre">Nombre</label><input class="inp" id="m-nombre" maxlength="24" autocomplete="off" value="${esc(nombre())}"></div>
    <div class="sw-row"><span>Seguir al sistema<small>Claro u oscuro como tu ${esMac() ? 'Mac' : 'iPhone'}. ${esMac() ? 'Con la tecla C lo cambias' : 'Toca tu inicial para cambiarlo'} a mano.</small></span><button type="button" class="sw" data-m="sistema" role="switch" aria-checked="${sistema}" aria-label="Seguir al sistema"></button></div>
    <div class="field" style="margin-top:16px"><span class="lbl">Vidrio</span><div class="seg" style="--n:2;--i:${vidrio === 'tintado' ? 1 : 0}" role="group" aria-label="Vidrio">${vidrios.map(t => `<button data-vidrio="${t[0]}" aria-pressed="${t[0] === vidrio}">${t[1]}</button>`).join('')}</div>
      <p class="note" style="margin-top:6px">Claro deja ver más el fondo; Tintado da más contraste.</p></div>
    <div class="group">
      <span class="lbl">Sincronización</span>
      <div class="state" data-s="${est.s}"><i></i>${TEXTO_SYNC[est.s]}${est.s === 'ok' ? hace(est.ultimo) : ''}</div>
      ${est.s === 'error' ? `<p class="note" style="margin-top:6px">${esc(est.error)}</p>` : ''}
      ${con ? '<div class="row"><button class="btn" data-m="sync">Sincronizar ahora</button></div>'
        : `<p class="note" style="margin-top:6px">Para guardar en Google Sheets y ver tus datos en todos tus dispositivos, pega aquí tu enlace de conexión.</p>
           <div class="row"><input class="inp" id="m-enlace" placeholder="Enlace de conexión" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn p" data-m="conectar">Conectar</button></div>`}
    </div>
    ${matchMedia('(hover:hover) and (pointer:fine)').matches ? '<p class="note keys-note">Atajos: <kbd>1</kbd> Pendientes · <kbd>2</kbd> Rutina · <kbd>N</kbd> nuevo pendiente · <kbd>B</kbd> buscar · <kbd>C</kbd> claro u oscuro</p>' : ''}`;
}

menu.addEventListener('input', e => {
  if (e.target.id === 'm-nombre') { fijarPref('enzo-nombre', e.target.value.trim() || 'David'); pintarInicial(); }
});
menu.addEventListener('change', e => {
  if (e.target.id === 'm-nombre') store.guardar('config', { id: 'nombre', valor: e.target.value.trim() || 'David' });
});
menu.addEventListener('click', async e => {
  const vi = e.target.closest('button[data-vidrio]');
  if (vi) { fijarPref('enzo-vidrio', vi.dataset.vidrio); aplicarTema(); pintarMenu(); return; }
  const b = e.target.closest('[data-m]'); if (!b) return;
  if (b.dataset.m === 'sistema') {
    const seguir = b.getAttribute('aria-checked') !== 'true';
    fijarPref('enzo-tema', seguir ? 'auto' : document.documentElement.dataset.theme);
    if (document.startViewTransition && !reduceMotion()) document.startViewTransition(aplicarTema); else aplicarTema();
    b.setAttribute('aria-checked', seguir);   // sin redibujar, para que la perilla se deslice
    return;
  }
  if (b.dataset.m === 'sync') { await store.sincronizar(); pintarMenu(); }
  if (b.dataset.m === 'conectar') {
    const v = $('#m-enlace').value.trim(), t = (/#conectar=([\w-]+)/.exec(v) || [, /^[\w-]{20,}$/.test(v) ? v : ''])[1];
    if (!t) { toast('Pega el enlace completo que te dio verEnlace.'); return; }
    b.textContent = 'Conectando…'; b.disabled = true;
    await conectarCon(t);
    pintarMenu();
  }
});

/* ---------- enlace de conexión: …/#conectar=TOKEN ----------
   Se abre una vez en cada dispositivo. El token se guarda aquí y se borra de la barra de direcciones. */
const enlace = /#conectar=([\w-]+)/.exec(location.hash);
if (enlace) history.replaceState(null, '', location.pathname + location.search);
async function conectarConEnlace() { if (enlace) await conectarCon(enlace[1]); }
async function conectarCon(token) {
  try {
    await api.probar(token);
    api.guardarToken(token);
    await store.sincronizar();
    toast('Conectado. Tus datos se guardan en Google Sheets.');
  } catch (x) {
    toast('Ese enlace de conexión no funcionó. Pide uno nuevo con verEnlace en Apps Script.');
  }
}

function pintarInicial() { $('#me-i').textContent = (nombre()[0] || 'D').toUpperCase(); }
function pintarSync() { $('#sync').dataset.s = store.estado.s; }

/* ---------- hoja ----------
   Si se abre desde un botón (`desde`), la hoja nace de él y regresa a él al cerrarse. */
let alCerrar = null, foco = null, origen = null;
const RESORTE = 'linear(0,.009,.035 2.1%,.141 4.4%,.723 12.9%,.938 16.7%,1.017 20.5%,1.043 24.8%,1.035 28.4%,1 39.7%,.993 47.3%,1)';
const esMac = () => matchMedia('(min-width:820px)').matches;
function desdeBoton(s, b) {
  const f = b.getBoundingClientRect(), r = s.getBoundingClientRect();
  const base = esMac() ? 'translate(-50%,-50%) ' : '';
  return { de: `translate(${f.left - r.left}px,${f.top - r.top}px) ${base}scale(${f.width / r.width},${f.height / r.height})`, a: base || 'none' };
}
function abrirHoja(html, { montar, cerrar, clase = '', desde = null } = {}) {
  if (hojaAbierta()) cerrarHoja();
  foco = document.activeElement;
  const s = $('#sheet');
  s.getAnimations().forEach(a => a.cancel());
  origen = desde && desde.offsetWidth && !reduceMotion() ? desde : null;
  s.className = clase === 'spot' ? 'spot' : `glass tint ${clase}${origen ? ' morph' : ''}`;
  s.innerHTML = clase === 'spot' ? html : `<div class="sh-grab" aria-hidden="true"></div><div class="sh-scroll">${html}</div>`;
  document.body.classList.add('sheet-open');
  if (origen) {
    const m = desdeBoton(s, origen);
    s.animate([{ transform: m.de, borderRadius: '50%', opacity: .6 }, { transform: m.a, opacity: 1 }], { duration: 480, easing: RESORTE });
    s.querySelector('.sh-scroll')?.animate([{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: 480, easing: 'ease-out' });
  }
  alCerrar = cerrar || null;
  montar?.(s);
  requestAnimationFrame(() => (s.querySelector('[autofocus]') || s).focus({ preventScroll: true }));
}
function cerrarHoja() {
  if (!hojaAbierta()) return;
  const s = $('#sheet');
  if (origen && origen.offsetWidth && !reduceMotion()) {
    const m = desdeBoton(s, origen);
    const an = s.animate([{ transform: m.a, opacity: 1, visibility: 'visible' }, { transform: m.de, borderRadius: '50%', opacity: 0, visibility: 'visible' }], { duration: 300, easing: 'cubic-bezier(.23,1,.32,1)' });
    const fin = () => { if (!hojaAbierta()) s.classList.remove('morph'); };
    an.onfinish = fin; setTimeout(fin, 340);
  } else s.classList.remove('morph');
  origen = null;
  document.body.classList.remove('sheet-open');
  const fn = alCerrar; alCerrar = null; fn?.(s);
  render();
  foco?.isConnected && foco.focus?.({ preventScroll: true });
}
$('#scrim').addEventListener('click', cerrarHoja);

/* ---------- buscador (Spotlight, sin filtros) ---------- */
function abrirBuscador() {
  if (ui.bienvenida) return;
  abrirHoja(`<div class="spot-bar glass"><svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="6"/><path d="M13.5 13.5L17 17"/></svg><input class="sr-input" id="sr-q" placeholder="Buscar pendientes…" aria-label="Buscar" autocomplete="off" autofocus enterkeyhint="search"></div>
    <div class="spot-panel glass tint" id="sr-panel" hidden><div class="sr-res" id="sr-res" role="listbox" aria-label="Resultados"></div></div>`, {
    clase: 'spot',
    montar: s => {
      const q = s.querySelector('#sr-q'), panel = s.querySelector('#sr-panel'), res = s.querySelector('#sr-res');
      let sel = 0, lista = [];
      const pintar = () => {
        lista = pendientes.buscar(store, q.value);
        panel.hidden = !q.value.trim();
        res.innerHTML = lista.length ? lista.map((p, i) => `<button class="sr-item${i === sel ? ' kb' : ''}${p.estado === 'hecho' ? ' dim' : ''}" data-id="${esc(p.id)}" role="option" aria-selected="${i === sel}">
            <b>${esc(p.titulo)}</b><small>${p.estado === 'hecho' ? 'Hecha' : 'Pendiente'}${p.fecha ? ' · ' + fechaCorta(p.fecha) : ''}</small></button>`).join('')
          : `<p class="sr-empty">Sin resultados para «${esc(q.value.trim())}».</p>`;
      };
      const abrir = id => { cerrarHoja(); pendientes.abrirDetalle(ctx, id); };
      q.addEventListener('input', () => { sel = 0; pintar(); });
      q.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!lista.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length; pintar(); }
        if (e.key === 'Enter' && lista[sel]) { e.preventDefault(); abrir(lista[sel].id); }
      });
      res.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) abrir(b.dataset.id); });
    }
  });
}

$('#lupa').addEventListener('click', abrirBuscador);

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  if (ui.bienvenida) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrar(); } return; }
  if (e.key === 'Escape') {
    if (hojaAbierta()) cerrarHoja();
    else if (menu.classList.contains('open')) abrirMenu(false);
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey || escribiendo(e.target) || hojaAbierta()) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); pendientes.abrirDetalle(ctx, null, $('#fab')); }
  if (k === 'b') { e.preventDefault(); abrirBuscador(); }
  if (k === 'c') { e.preventDefault(); alternarTema(); }
  const num = PAGES[Number(e.key) - 1];
  if (num) { e.preventDefault(); ir(num.id); }
});

/* ---------- reflejo del vidrio que sigue al cursor o al dedo ---------- */
document.addEventListener('pointermove', e => {
  const g = e.target.closest?.('.glass'); if (!g) return;
  const r = g.getBoundingClientRect();
  g.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
  g.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
}, { passive: true });

/* ---------- aviso ---------- */
let tt = null;
function toast(msg, deshacer) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${deshacer ? '<button id="t-undo">Deshacer</button>' : ''}`;
  if (deshacer) $('#t-undo').onclick = () => { deshacer(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), deshacer ? 5000 : 2600);
}

/* ---------- inicio ---------- */
aplicarTema();
pintarInicial();
let primeraCarga = true;
store.escuchar(() => {
  cargarTipos(store.state);
  if (primeraCarga) { primeraCarga = false; pendientes.generarRepeticiones(store); if (ui.bienvenida) pintarBienvenida(); }
  if (!hojaAbierta()) render(); else pintarSync();
  if (menu.classList.contains('open')) pintarMenu();
});
store.iniciar().then(conectarConEnlace);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
