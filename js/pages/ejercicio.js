/* Ejercicio: el reproductor del circuito. Se abre con el botón Empezar de la actividad de ejercicio del día.
   Es una capa a pantalla completa fuera de #view, así las sincronizaciones no lo redibujan.
   La sesión en curso se guarda en este dispositivo: si sales o se cierra la app, la retomas donde ibas.
   Al terminar se guarda en Sesiones y se marca la actividad de ejercicio del día. */
import { esc, iso, hoy, uid, DIAS, MESES, cap, reduceMotion } from '../util.js';
import { DIAS_SEMANA, aMin } from '../tipos.js';
import { rutina, pasos, imgDe, cantidad, mmss } from '../ejercicios.js';
import { desplegable } from '../desplegable.js';

const K = 'enzo-ej-activa';
let act = leerAct(), ctxG = null, tk = null, candado = null;

function leerAct() { try { const a = JSON.parse(localStorage.getItem(K) || 'null'); return a && rutina(a.rid) ? a : null; } catch (e) { return null; } }
function guardarAct() { try { act ? localStorage.setItem(K, JSON.stringify(act)) : localStorage.removeItem(K); } catch (e) {} }

const I = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  ant: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L9 12l9 6zM6 6v12"/></svg>',
  sig: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l9 6-9 6zM18 6v12"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>'
};

/* ---------- foto o marcador ---------- */
const foto = (x, cls = '') => x.img
  ? `<img class="ej-foto${x.espejo ? ' espejo' : ''} ${cls}" src="${imgDe(x.img)}" alt="" loading="lazy" decoding="async">`
  : `<span class="ej-foto vacia ${cls}" aria-hidden="true">${esc(x.n.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>`;

const ultima = (s, id) => s.sesiones.filter(x => x.ejercicioId === id).sort((a, b) => (b.fecha + (b.datos?.fin || '')).localeCompare(a.fecha + (a.datos?.fin || '')))[0];

/* Id de la rutina en curso (o null). Si la app se cerró a media rutina, sigue guardada en este dispositivo. */
export const enCurso = () => act ? act.rid : null;
export function continuar(ctx) { ctxG = ctx; if (act) abrirJugador(); }

/* ---------- reproductor ---------- */
export function empezar(ctx, id) {
  ctxG = ctx;
  const r = rutina(id); if (!r) return;
  if (act && !confirm(act.rid === id ? 'Ya tienes esta rutina en curso. ¿Empezarla de nuevo?' : `Tienes ${rutina(act.rid).nombre} en curso. ¿Descartarla y empezar ${r.nombre}?`)) {
    if (act.rid === id) abrirJugador();
    return;
  }
  act = { rid: id, i: 0, inicio: Date.now(), acum: 0, desde: null, log: {}, paso: null, borr: null };
  entrarPaso();
  abrirJugador();
  /* Guarda las imágenes de la rutina para poder entrenar sin señal */
  pasos(r).forEach(p => { if (p.t === 'ej' && p.e.img) { const im = new Image(); im.src = imgDe(p.e.img); } });
}

const ahora = () => Date.now();
const activo = () => (act ? act.acum + (act.desde ? ahora() - act.desde : 0) : 0);
const listaPasos = () => pasos(rutina(act.rid));

/* Valores iniciales de peso y repeticiones: la vuelta anterior de hoy, o tu última sesión. */
function sugerido(x, v) {
  const de = (log, igualV) => Object.values(log || {}).filter(l => l.id === x.id && l.hecho && (!igualV || l.v === v)).pop();
  const previa = ctxG ? ultima(ctxG.store.state, act.rid) : null;
  const l = de(act.log, false) || de(previa?.datos?.log, true) || de(previa?.datos?.log, false);
  return { kg: l?.kg ?? 0, reps: x.reps };
}

function entrarPaso() {
  const p = listaPasos()[act.i];
  act.borr = null;
  if (!p) { act.paso = null; return; }
  if (p.t === 'desc') act.paso = { corre: true, hasta: ahora() + p.seg * 1000, restante: p.seg * 1000 };
  else if (p.e.seg) act.paso = { corre: false, hasta: 0, restante: p.e.seg * 1000 };
  else { act.paso = null; if (p.e.reg) act.borr = sugerido(p.e, p.v); }
}
const restante = () => !act.paso ? 0 : act.paso.corre ? act.paso.hasta - ahora() : act.paso.restante;

function ir(i) {
  act.i = i;
  if (i >= listaPasos().length) { terminar(); return; }
  entrarPaso(); guardarAct(); pintar();
}
function registrar(hecho) {
  const p = listaPasos()[act.i]; if (!p || p.t !== 'ej') return;
  const l = { id: p.e.id, v: p.v, hecho };
  if (hecho && p.e.reg === 'reps') l.reps = act.borr ? act.borr.reps : p.e.reps;
  if (hecho && p.e.reg === 'carga') { l.reps = act.borr.reps; l.kg = act.borr.kg; }
  act.log[act.i] = l;
}

function abrirJugador() {
  let el = document.getElementById('ej');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ej';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Rutina en curso');
    el.addEventListener('click', clic);
    document.body.append(el);
  }
  document.body.classList.add('jugando');
  if (!act.desde) act.desde = ahora();
  guardarAct(); pintar(true);
  clearInterval(tk); tk = setInterval(tick, 250);
  despertar();
}
function cerrarJugador() {
  clearInterval(tk); tk = null;
  if (act) {
    if (act.desde) { act.acum += ahora() - act.desde; act.desde = null; }
    if (act.paso && act.paso.corre) { act.paso.restante = Math.max(0, act.paso.hasta - ahora()); act.paso.corre = false; }
    guardarAct();
  }
  document.getElementById('ej')?.remove();
  document.body.classList.remove('jugando');
  dormir();
  ctxG?.render();
}

/* La pantalla no se apaga mientras entrenas (si el navegador lo permite). */
async function despertar() { try { if ('wakeLock' in navigator && !candado) { candado = await navigator.wakeLock.request('screen'); candado.addEventListener('release', () => { candado = null; }); } } catch (e) {} }
function dormir() { try { candado?.release(); } catch (e) {} candado = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.body.classList.contains('jugando')) despertar(); });

function tick() {
  const el = document.getElementById('ej'); if (!el || !act) return;
  const r = el.querySelector('[data-reloj]'); if (r) r.textContent = mmss(activo() / 1000);
  const p = listaPasos()[act.i];
  if (!p || !act.paso) return;
  const ms = restante(), t = el.querySelector('[data-t]');
  if (t) t.textContent = mmss(Math.ceil(ms / 1000));
  if (act.paso.corre && ms <= 0) {
    if (p.t === 'ej') registrar(true);
    ir(act.i + 1);
  }
}

function pintar(entrada = false) {
  const el = document.getElementById('ej'); if (!el || !act) return;
  const r = rutina(act.rid), ps = listaPasos(), p = ps[act.i];
  if (!p) return;
  const ejs = ps.map((q, i) => q.t === 'ej' ? i : -1).filter(i => i >= 0);
  const n = ejs.filter(i => i < act.i).length;   // ejercicios antes de este paso
  const barra = `<div class="ej-prog" aria-hidden="true">${ejs.map(i => `<i class="${i < act.i ? 'ok' : i === act.i ? 'va' : ''}"></i>`).join('')}</div>`;
  const cab = (titulo) => `<div class="ej-head"><button class="c-btn glass" data-x aria-label="Salir, terminar o descartar" title="Salir" aria-haspopup="listbox" aria-expanded="false">${I.x}</button><div class="ej-meta"><b>${titulo}</b><span data-reloj>${mmss(activo() / 1000)}</span></div></div>`;
  el.className = (p.t === 'desc' ? 'descanso' : '') + (entrada && !reduceMotion() ? ' entra' : '');
  if (p.t === 'desc') {
    const sig = ps.slice(act.i + 1).find(q => q.t === 'ej');
    const txtSig = sig ? (sig.nv > 1 ? `Sigue · vuelta ${sig.v} de ${sig.nv}` : 'Sigue') : '';
    el.innerHTML = `${barra}${cab(p.vuelta ? 'Entre vueltas' : 'Entre ejercicios')}
      <div class="ej-rest"><p class="lbl">Descanso</p><p class="t" data-t>${mmss(Math.ceil(restante() / 1000))}</p>
        <div class="acc"><button class="gb" data-mas20>+20 s</button><button class="gb w" data-saltar>Saltar</button></div></div>
      ${sig ? `<div class="ej-sig">${foto(sig.e)}<p><span><small>${txtSig}</small><b>${esc(sig.e.n)}</b></span><em>${cantidad(sig.e)}</em></p></div>` : ''}`;
    return;
  }
  const x = p.e, tiempo = !!x.seg;
  const serie = p.nv > 1 ? `Vuelta ${p.v} de ${p.nv}` : tiempo ? 'Por tiempo' : r.bloques[p.b].titulo;
  const step = (k, val, etq) => `<div class="ej-step"><button data-menos="${k}" aria-label="Menos ${etq}">−</button><span><b data-v="${k}">${val}</b><small>${etq}</small></span><button data-mas="${k}" aria-label="Más ${etq}">+</button></div>`;
  let carga = '';
  if (x.reg === 'carga') carga = `<div class="ej-carga">${step('kg', act.borr.kg + ' kg', 'peso')}${step('reps', act.borr.reps, 'hiciste')}</div>`;
  else if (x.reg === 'reps') carga = `<div class="ej-carga">${step('reps', act.borr.reps, 'hiciste')}</div>`;
  const corre = tiempo && act.paso && act.paso.corre;
  const centro = tiempo
    ? `<button class="ej-ok" data-play aria-label="${corre ? 'Pausar' : 'Empezar'}">${corre ? I.pausa : I.play}</button>`
    : `<button class="ej-ok" data-ok aria-label="Hecho">${I.ok}</button>`;
  const lado = tiempo
    ? `<button class="c-btn glass" data-hecho aria-label="Terminar este ejercicio" title="Terminar">${I.ok}</button>`
    : `<button class="c-btn glass" data-saltar aria-label="Saltar este ejercicio" title="Saltar">${I.sig}</button>`;
  el.innerHTML = `${barra}${cab(`Ejercicio ${n + 1} de ${ejs.length}`)}
    <figure class="ej-escena">${foto(x)}</figure>
    <div class="ej-info"><h2>${esc(x.n)}<button class="ej-i" data-info aria-expanded="false" aria-label="Cómo se hace">i</button></h2>
      <p class="ej-serie">${esc(serie)}</p><p class="ej-que" hidden>${esc(x.que || '')}</p>
      <p class="ej-big"${tiempo ? ' data-t' : ''}>${tiempo ? mmss(Math.ceil(restante() / 1000)) : '×' + x.reps}</p>${carga}</div>
    <div class="ej-ctl"><button class="c-btn glass" data-ant aria-label="Ejercicio anterior" title="Anterior" ${n === 0 ? 'disabled' : ''}>${I.ant}</button>${centro}${lado}</div>`;
}

function clic(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.fin !== undefined) { act = null; guardarAct(); cerrarJugador(); return; }
  if (!act) return;
  const ps = listaPasos(), p = ps[act.i];
  if (b.dataset.x !== undefined) {
    const hechos = Object.values(act.log).filter(l => l.hecho).length;
    desplegable(b, [
      { v: 'salir', html: 'Salir<small>tu avance se guarda</small>' },
      ...(hechos ? [{ v: 'terminar', html: 'Terminar aquí<small>guarda lo que llevas</small>' }] : []),
      { v: 'descartar', sep: true, html: '<span class="rojo">Descartar rutina</span>' }
    ], v => {
      if (v === 'salir') cerrarJugador();
      if (v === 'terminar') terminar();
      if (v === 'descartar' && confirm('¿Descartar la rutina? No se guarda lo que llevas.')) { act = null; guardarAct(); cerrarJugador(); }
    });
    return;
  }
  if (b.dataset.info !== undefined) {
    const q = b.closest('.ej-info').querySelector('.ej-que'), abre = q.hidden;
    q.hidden = !abre; b.setAttribute('aria-expanded', abre); return;
  }
  if (b.dataset.ok !== undefined || b.dataset.hecho !== undefined) { registrar(true); ir(act.i + 1); return; }
  if (b.dataset.saltar !== undefined) { if (p.t === 'ej') registrar(false); ir(act.i + 1); return; }
  if (b.dataset.ant !== undefined) {
    let j = act.i - 1; while (j >= 0 && ps[j].t !== 'ej') j--;
    if (j >= 0) { delete act.log[j]; ir(j); }
    return;
  }
  if (b.dataset.play !== undefined) {
    const q = act.paso;
    if (q.corre) { q.restante = Math.max(0, q.hasta - ahora()); q.corre = false; } else { q.hasta = ahora() + q.restante; q.corre = true; }
    guardarAct(); pintar(); return;
  }
  if (b.dataset.mas20 !== undefined) {
    const q = act.paso; if (q.corre) q.hasta += 20000; else q.restante += 20000;
    guardarAct(); tick(); return;
  }
  const k = b.dataset.mas || b.dataset.menos;
  if (k && act.borr) {
    const d = b.dataset.mas ? 1 : -1;
    act.borr[k] = Math.max(0, (Number(act.borr[k]) || 0) + d);
    b.parentElement.querySelector(`[data-v="${k}"]`).textContent = k === 'kg' ? act.borr.kg + ' kg' : act.borr.reps;
    guardarAct();
  }
}

/* Mantener presionado + o − cambia el valor de corrido. */
let rep = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest?.('#ej [data-mas],#ej [data-menos]'); if (!b) return;
  clearTimeout(rep);
  const seguir = (t) => { rep = setTimeout(() => { b.click(); seguir(90); }, t); };
  seguir(450);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, () => clearTimeout(rep), true));

document.addEventListener('keydown', e => {
  if (!document.body.classList.contains('jugando')) return;
  const el = document.getElementById('ej');
  if (e.key === 'Escape') { if (document.querySelector('.dd')) return; e.preventDefault(); if (el.querySelector('[data-fin]')) el.querySelector('[data-fin]').click(); else cerrarJugador(); }
  if (e.key === 'Enter' || e.key === ' ') {
    if (e.target.closest?.('button') && e.target.closest('#ej')) return;   // el botón con foco ya responde
    e.preventDefault(); el.querySelector('[data-ok],[data-play],[data-saltar],[data-fin]')?.click();
  }
});

/* ---------- al terminar ---------- */
function marcarActividad(store, r) {
  const f = iso(hoy()), dia = DIAS_SEMANA[hoy().getDay()];
  const acts = store.state.actividades.filter(a => a.dia === dia && a.tipo === 'ejercicio').sort((a, b) => aMin(a.inicio) - aMin(b.inicio));
  if (!acts.length) return { msg: 'Hoy no tienes una actividad de ejercicio en tu rutina.' };
  const hechos = new Set(store.state.registros.filter(x => x.fecha === f && x.hecho).map(x => x.actividadId));
  const a = acts.find(x => x.ejercicioId === r.id && !hechos.has(x.id)) || acts.find(x => !hechos.has(x.id));
  if (!a) return { msg: `<b>${esc(acts[0].nombre)}</b> ya estaba marcada como hecha hoy.`, ok: true };
  store.guardar('registros', { id: f + '|' + a.id, fecha: f, actividadId: a.id, nombre: a.nombre, tipo: a.tipo, core: !!a.core, hecho: true });
  return { msg: `Se marcó <b>${esc(a.nombre)}</b> como hecha en tu rutina de hoy.`, ok: true };
}

function terminar() {
  const r = rutina(act.rid), ps = listaPasos(), store = ctxG.store;
  if (act.desde) { act.acum += ahora() - act.desde; act.desde = null; }
  const log = Object.keys(act.log).sort((a, b) => a - b).map(i => act.log[i]);
  const hechos = log.filter(l => l.hecho);
  const reps = hechos.reduce((t, l) => {
    const x = ps.find(p => p.t === 'ej' && p.e.id === l.id)?.e;
    return t + (Number(l.reps ?? x?.reps) || 0);
  }, 0);
  const dur = Math.round(act.acum / 1000);
  const fin = new Date();
  store.guardar('sesiones', { id: uid(), ejercicioId: r.id, fecha: iso(hoy()),
    datos: { nombre: r.nombre, inicio: new Date(act.inicio).toISOString(), fin: fin.toISOString(), dur, reps, hechos: hechos.length, log } });
  const aviso = marcarActividad(store, r);
  /* Lo que hiciste en cada vuelta, por ejercicio con registro */
  const filas = r.bloques.flatMap(b => b.ejercicios).filter(x => x.reg).map(x => {
    const ls = log.filter(l => l.id === x.id);
    if (!ls.length) return '';
    const txt = ls.map(l => !l.hecho ? '—' : x.reg === 'carga' ? `${l.kg} kg × ${l.reps}` : l.reps).join(' · ');
    return `<div><span>${esc(x.n)}</span><em>${txt}</em></div>`;
  }).join('');
  const total = ps.filter(p => p.t === 'ej').length;
  const el = document.getElementById('ej');
  clearInterval(tk); tk = null; dormir();
  el.className = 'final';
  el.innerHTML = `<div class="ej-fin">
      <svg class="ej-enso" viewBox="0 0 120 120" aria-hidden="true"><path d="M96 34A44 44 0 1 0 104 64"/></svg>
      <h1>Rutina completa</h1><p class="h">${esc(r.nombre)} · ${cap(DIAS[fin.getDay()])} ${fin.getDate()} de ${MESES[fin.getMonth()]}</p>
      <div class="ej-stats"><div class="card"><b>${Math.max(1, Math.round(dur / 60))} min</b><span>duración</span></div><div class="card"><b>${hechos.length}/${total}</b><span>ejercicios</span></div><div class="card"><b>${reps}</b><span>repeticiones</span></div></div>
      <div class="card ej-aviso${aviso.ok ? ' ok' : ''}"><i>${aviso.ok ? I.ok : ''}</i><span>${aviso.msg}</span></div>
      ${filas ? `<div class="card ej-cargas">${filas}</div>` : ''}
    </div>
    <div class="ej-ctl"><button class="btn p ej-listo" data-fin>Listo</button></div>`;
  act = null; guardarAct();
}

