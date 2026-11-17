/* Enzo · arranque, bienvenida, menú de páginas, Ajustes, hoja, buscador, atajos y avisos. */
import { $, esc, reduceMotion } from './util.js';
import * as store from './store.js';
import * as api from './api.js';
import * as pendientes from './pages/pendientes.js';
import * as rutina from './pages/rutina.js';
import * as proyectos from './pages/proyectos.js';
import * as notas from './pages/notas.js';
import * as presupuesto from './pages/presupuesto.js';
import * as buscador from './buscador.js';
import { cargarTipos } from './tipos.js';
import { VERSION_APP } from './config.js';

/* Páginas del menú (en inglés) y sus secciones (barra de píldora abajo en el celular, arriba en la Mac). */
const vistaRutina = v => ({ render: c => rutina.render(c, v), montar: (el, c) => rutina.montar(el, c), ocultaBarra: () => rutina.ocultaBarra(v) });
const PAGES = [
  { id: 'today', nombre: 'Today', secciones: [
    { id: 'pendientes', nombre: 'Pendientes', mod: pendientes },
    { id: 'rutina', nombre: 'Rutina', mod: vistaRutina('rutina') }] },
  { id: 'projects', nombre: 'Projects', secciones: [
    { id: 'proyectos', nombre: 'Proyectos', mod: proyectos },
    { id: 'notas', nombre: 'Notas', mod: notas }] },
  { id: 'control', nombre: 'Control', secciones: [
    { id: 'resumen', nombre: 'Resumen', mod: vistaRutina('resumen') },
    { id: 'presupuesto', nombre: 'Presupuesto', mod: presupuesto }] }
];
/* Enzo siempre abre en Today › Pendientes; dentro de la sesión cada página recuerda su sección. */
const ui = { page: 'today', sec: { today: 'pendientes', projects: 'proyectos', control: 'resumen' }, bienvenida: !new URLSearchParams(location.search).has('sinbienvenida') };

function leerPref(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
function fijarPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
/* El nombre vive en la hoja (Config, id "nombre") para verse igual en todos tus dispositivos. */
const nombre = () => { const c = store.state.config.find(x => x.id === 'nombre'); return (c && c.valor) || leerPref('enzo-nombre', 'David'); };
const escribiendo = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const hojaAbierta = () => document.body.classList.contains('sheet-open');

/* ---------- contexto que reciben las páginas ---------- */
const ctx = {
  store, toast, abrirHoja, cerrarHoja, render: () => render(), ir: (p, sec) => ir(p, sec),
  abrirNota: (id, origen) => { notas.abrir(id, origen); ir('projects', 'notas'); render(); window.scrollTo(0, 0); },
  nuevaNota: proyectoId => { ir('projects', 'notas'); notas.nuevo(ctx, null, proyectoId, proyectoId); },
  verProyecto: id => { proyectos.verProyecto(id); ir('projects', 'proyectos'); render(); window.scrollTo(0, 0); }
};
/* El círculo crea lo propio de cada sección: pendiente, proyecto (o pendiente del proyecto abierto) o nota. */
const nuevoAqui = desde => { const m = seccion().mod; if (m.nuevo) m.nuevo(ctx, desde); else pendientes.abrirDetalle(ctx, null, desde); };

/* ---------- render ----------
   Cada render crea un contenedor nuevo, así los eventos de la página no se acumulan. */
let entrada = true, te = null;
const pagina = () => PAGES.find(x => x.id === ui.page);
const seccion = () => { const p = pagina(); return p.secciones.find(x => x.id === ui.sec[p.id]) || p.secciones[0]; };
function render() {
  const p = pagina(), sc = seccion(), v = $('#view');
  const caja = document.createElement('div');
  caja.innerHTML = sc.mod.render(ctx);
  v.replaceChildren(caja);
  sc.mod.montar?.(caja, ctx);
  if (entrada && !ui.bienvenida) { entrada = false; v.classList.add('enter'); clearTimeout(te); te = setTimeout(() => v.classList.remove('enter'), 900); }
  document.body.dataset.page = sc.id;        // la sección decide qué controles fijos se ven (captura y lupa en Pendientes)
  document.body.dataset.pagina = p.id;
  if (sc.id !== 'notas') document.body.classList.remove('editando-nota');
  const fab = $('#fab'), et = sc.mod.etiquetaNuevo ? sc.mod.etiquetaNuevo() : 'Nuevo pendiente';
  fab.setAttribute('aria-label', et); fab.title = et + ' (N)';
  pintarBarra();
  $('#cap-label').textContent = p.nombre;
  $('#cap-pop').innerHTML = PAGES.map(x => `<button class="pop-item" data-page="${x.id}" aria-current="${x.id === ui.page}">${x.nombre}</button>`).join('');
  pintarSync();
}

function ir(id, sec) {
  if (sec) {
    if (id === ui.page && sec === ui.sec[id]) return;
    if (id === ui.page) { cambiarSeccion(sec); return; }
    ui.sec[id] = sec;
  }
  if (id === ui.page) return;
  ui.page = id;
  if (document.startViewTransition && !reduceMotion()) {
    /* Con transición, la página entra de una vez (sin la animación escalonada, que la haría parpadear) */
    const raiz = document.documentElement; raiz.classList.add('vt-pagina');
    const t = document.startViewTransition(render);
    t.finished.catch(() => {}).finally(() => raiz.classList.remove('vt-pagina'));
    t.ready.catch(() => {});
  } else { entrada = true; render(); }
  window.scrollTo(0, 0);
}

/* ---------- barra de secciones ----------
   Un solo elemento que nunca se reconstruye (en el iPhone, rehacer el vidrio en cada cambio parpadea).
   La selección viaja a la nueva sección y se estira a medio camino, como gel. */
const bar = $('#rbar');
let barPagina = null, selDesde = null, barMin = false;
function pintarBarra() {
  const p = pagina(), sc = seccion();
  if (barPagina !== p.id) { bar.innerHTML = p.secciones.map(x => `<button data-sec="${x.id}">${x.nombre}</button>`).join(''); barPagina = p.id; }
  bar.querySelectorAll('[data-sec]').forEach(b => b.setAttribute('aria-current', b.dataset.sec === sc.id));
  bar.classList.toggle('min', barMin);
  bar.hidden = !!sc.mod.ocultaBarra?.();
  gel();
}
function cambiarSeccion(id) {
  const actual = bar.querySelector('[aria-current="true"]');
  selDesde = actual ? { x: actual.offsetLeft, w: actual.offsetWidth } : null;
  ui.sec[ui.page] = id; render(); window.scrollTo(0, 0);
}
bar.addEventListener('click', e => {
  const b = e.target.closest('[data-sec]');
  if (b && b.dataset.sec !== seccion().id) cambiarSeccion(b.dataset.sec);
});
function gel() {
  const desde = selDesde; selDesde = null;
  const b = bar.querySelector('[aria-current="true"]');
  if (!desde || !b || reduceMotion()) return;
  const x = b.offsetLeft, w = b.offsetWidth, a = Math.min(desde.x, x), z = Math.max(desde.x + desde.w, x + w);
  const sel = document.createElement('span'); sel.className = 'rsel';
  bar.prepend(sel); bar.classList.add('moviendo');
  const an = sel.animate([
    { left: desde.x + 'px', width: desde.w + 'px' },
    { left: a + 'px', width: (z - a) * .82 + 'px', offset: .45 },
    { left: x + 'px', width: w + 'px' }
  ], { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
  const fin = () => { bar.classList.remove('moviendo'); sel.remove(); };
  an.onfinish = an.oncancel = fin; setTimeout(fin, 480);
}
/* iPhone: la barra se encoge a la sección activa al bajar y regresa al subir. */
let ultimoY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  const min = innerWidth < 820 && (y > ultimoY + 2 && y > 30 ? true : y < ultimoY - 2 || y <= 30 ? false : barMin);
  ultimoY = y;
  if (min === barMin) return;
  barMin = min; bar.classList.toggle('min', min);
}, { passive: true });

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
$('#fab').addEventListener('click', () => nuevoAqui($('#fab')));
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
  if (document.startViewTransition && !reduceMotion()) { const t = document.startViewTransition(aplicarTema); t.ready.catch(() => {}); t.finished.catch(() => {}); } else aplicarTema();
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
    ${matchMedia('(hover:hover) and (pointer:fine)').matches ? '<p class="note keys-note">Atajos: <kbd>1</kbd> Today · <kbd>2</kbd> Projects · <kbd>3</kbd> Control · <kbd>S</kbd> cambiar de sección · <kbd>N</kbd> nuevo (pendiente, proyecto o nota) · <kbd>B</kbd> buscar · <kbd>C</kbd> claro u oscuro</p>' : ''}
    <p class="note" style="margin-top:12px;text-align:right">Versión ${VERSION_APP}</p>`;
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

/* ---------- iPhone: teclado ----------
   iOS no achica la página al abrir el teclado: mide cuánto tapa (--teclado) y el alto visible (--vv-h),
   para que la hoja y la barra de formato de Notas queden justo arriba del teclado. */
function ajustarTeclado() {
  const vv = window.visualViewport; if (!vv) return;
  const t = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)), k = t > 60 ? t : 0;
  const r = document.documentElement;
  r.style.setProperty('--teclado', k + 'px'); r.style.setProperty('--vv-h', Math.round(vv.height) + 'px');
  r.classList.toggle('con-teclado', k > 0);
}
if (window.visualViewport) { visualViewport.addEventListener('resize', ajustarTeclado); visualViewport.addEventListener('scroll', ajustarTeclado); }
/* Con una hoja abierta en el celular, la página de atrás no se mueve: así iOS no la desplaza
   al escribir y la hoja no se sale de la pantalla. */
let yHoja = 0;
const tactil = () => matchMedia('(pointer:coarse)').matches && !matchMedia('(min-width:820px)').matches;
function fijarPagina(si) {
  const b = document.body;
  if (si && tactil() && !b.classList.contains('fijo')) { yHoja = window.scrollY; b.style.top = -yHoja + 'px'; b.classList.add('fijo'); }
  else if (!si && b.classList.contains('fijo')) { b.classList.remove('fijo'); b.style.top = ''; window.scrollTo(0, yHoja); }
}

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
  fijarPagina(true);
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
  fijarPagina(false);
  const fn = alCerrar; alCerrar = null; fn?.(s);
  render();
  foco?.isConnected && foco.focus?.({ preventScroll: true });
}
$('#scrim').addEventListener('click', cerrarHoja);

/* ---------- buscador (Spotlight con categorías y filtros: js/buscador.js) ---------- */
function abrirBuscador() {
  if (ui.bienvenida) return;
  buscador.abrirBuscador(ctx, x => {
    if (x.k === 'pendiente') pendientes.abrirDetalle(ctx, x.id);
    else if (x.k === 'proyecto') ctx.verProyecto(x.id);
    else if (x.k === 'nota') ctx.abrirNota(x.id);
    else if (x.k === 'partida') { presupuesto.verMes(x.id, ctx.store); ir('control', 'presupuesto'); render(); presupuesto.abrir(ctx, x.id); }
  });
}

$('#lupa').addEventListener('click', abrirBuscador);

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  /* Con una rutina en curso, el reproductor maneja su teclado; solo la C (tema) sigue funcionando */
  if (document.body.classList.contains('jugando')) {
    if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey && !escribiendo(e.target)) { e.preventDefault(); alternarTema(); }
    return;
  }
  if (ui.bienvenida) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrar(); } return; }
  if (e.key === 'Escape') {
    if (hojaAbierta()) cerrarHoja();
    else if (menu.classList.contains('open')) abrirMenu(false);
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey || escribiendo(e.target) || hojaAbierta()) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); nuevoAqui($('#fab')); }
  if (k === 'b') { e.preventDefault(); abrirBuscador(); }
  if (k === 'c') { e.preventDefault(); alternarTema(); }
  /* S: siguiente sección de la página (Pendientes ↔ Rutina, Proyectos ↔ Notas, Resumen ↔ Presupuesto); ⇧S, la anterior */
  if (k === 's' && !bar.hidden) {
    e.preventDefault();
    const p = pagina(), i = p.secciones.findIndex(x => x.id === seccion().id), n = p.secciones.length;
    cambiarSeccion(p.secciones[(i + (e.shiftKey ? n - 1 : 1)) % n].id);
  }
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

/* ---------- iPhone: altura real de la pantalla ----------
   En la app instalada, iOS a veces mide la vista más baja que la pantalla (en páginas cortas) y todo lo
   fijo abajo queda más arriba. Medimos ese hueco y lo restamos; cuando iOS mide bien, el hueco es 0. */
const sonda = Object.assign(document.createElement('i'), { ariaHidden: 'true' });
sonda.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none';
document.body.append(sonda);
function ajustarAltura() {
  /* Solo en pantallas táctiles: en la Mac la ventana puede ser más chica que la pantalla y eso no es un hueco */
  const instalada = (navigator.standalone || matchMedia('(display-mode: standalone)').matches) && matchMedia('(pointer:coarse)').matches;
  const vertical = innerHeight >= innerWidth;
  const alto = vertical ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);   // alto real de la pantalla
  const h = instalada ? Math.round(alto - sonda.getBoundingClientRect().height) : 0;   // lo que le falta al área de lo fijo
  document.documentElement.style.setProperty('--hueco', (h > 0 && h < 160 ? h : 0) + 'px');
}
addEventListener('resize', ajustarAltura);
addEventListener('scroll', () => requestAnimationFrame(ajustarAltura), { passive: true });
store.escuchar(() => requestAnimationFrame(ajustarAltura));
ajustarAltura();

/* ---------- inicio ---------- */
aplicarTema();
pintarInicial();
let primeraCarga = true;
store.escuchar(() => {
  cargarTipos(store.state);
  if (primeraCarga) { primeraCarga = false; pendientes.generarRepeticiones(store); if (ui.bienvenida) pintarBienvenida(); }
  if (!hojaAbierta() && !seccion().mod.pausarRender?.()) render(); else pintarSync();
  if (menu.classList.contains('open')) pintarMenu();
});
store.iniciar().then(conectarConEnlace);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  /* Versión nueva: el service worker la baja en segundo plano y, al tomar el control, Enzo se recarga solo.
     Si estás escribiendo, con una hoja abierta o entrenando, espera a que salgas de la app para no perder nada. */
  const habia = !!navigator.serviceWorker.controller;
  let pendiente = false;
  const ocupado = () => hojaAbierta() || document.body.classList.contains('jugando') || !!seccion().mod.pausarRender?.() || !!document.querySelector('.n-ed');
  const recargar = () => { if (ocupado()) { pendiente = true; return; } location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia) recargar(); });
  document.addEventListener('visibilitychange', () => { if (pendiente && document.visibilityState === 'hidden') location.reload(); });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
