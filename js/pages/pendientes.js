/* Pendientes: igual que el inicio del task manager.
   Quick tasks en tarjetas (tocar la tarjeta = hecha, con 4 s para deshacer; el círculo abre el detalle),
   y a la derecha (Mac) o debajo (celular) Próximas en lista. */
import { esc, uid, iso, hoy, fechaLarga, fechaCorta, cuando, diasEntre, desdeIso, pieHoja } from '../util.js';
import { activos, nombreDe, ICONO } from './proyectos.js';
import { desplegable } from '../desplegable.js';

const ESPERA = 4000;
const enCurso = new Map();          // id -> { timer, inicio }
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- consultas ---------- */
const abiertos = s => s.pendientes.filter(p => p.estado !== 'hecho');
export function quick(s) {
  const h = iso(hoy());
  return abiertos(s)
    .filter(p => !p.fecha || diasEntre(h, p.fecha) <= 0)
    .sort((a, b) => (tarde(b) - tarde(a)) || ((b.importante ? 1 : 0) - (a.importante ? 1 : 0)) || String(a.fecha || '9').localeCompare(String(b.fecha || '9')) || String(a.creado || '').localeCompare(String(b.creado || '')));
}
const tarde = p => (p.fecha && diasEntre(iso(hoy()), p.fecha) < 0 ? 1 : 0);
const proximas = s => abiertos(s).filter(p => p.fecha && diasEntre(iso(hoy()), p.fecha) > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));

/* ---------- repeticiones (como el task manager) ----------
   Al llegar la fecha de una tarea que se repite, se crea la siguiente, esté o no hecha.
   El id es determinista para que dos dispositivos no creen duplicados. */
const REP_U = { d: ['día', 'días'], h: ['día hábil', 'días hábiles'], w: ['semana', 'semanas'], m: ['mes', 'meses'] };
export const textoRep = r => 'Se repite cada ' + (r.n > 1 ? r.n + ' ' + REP_U[r.unit][1] : REP_U[r.unit][0]);
export function siguienteFecha(fecha, rep) {
  const d = desdeIso(fecha), n = Math.min(365, Math.max(1, parseInt(rep.n, 10) || 1));
  if (rep.unit === 'w') d.setDate(d.getDate() + 7 * n);
  else if (rep.unit === 'm') { const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  else if (rep.unit === 'h') { for (let k = n; k > 0;) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) k--; } }
  else d.setDate(d.getDate() + n);
  return iso(d);
}
export function generarRepeticiones(store) {
  const h = iso(hoy());
  store.state.pendientes.slice().forEach(t => {
    if (!t.rep || !t.rep.unit || t.repGenerada || !t.fecha || t.fecha > h) return;
    const serie = t.serie || t.id, fecha = siguienteFecha(t.fecha, t.rep);
    store.guardar('pendientes', { id: serie + '~' + fecha, serie, titulo: t.titulo, notas: t.notas || '', estado: 'pendiente', importante: !!t.importante, fecha, rep: t.rep, repGenerada: false, creado: h, proyectoId: t.proyectoId || '' });
    store.guardar('pendientes', { ...t, repGenerada: true });
  });
}

/* ---------- vista ---------- */
export function render({ store }) {
  const s = store.state, q = quick(s), px = proximas(s);
  return `<h1 class="st">${fechaLarga(hoy())}</h1>
    <div class="home">
      <section class="sec st" style="--i:1">
        <span class="h">Quick tasks</span>
        ${q.length ? `<div class="qgrid">${q.map(p => tarjeta(p, s)).join('')}</div>`
          : '<p class="empty">Nada pendiente para hoy. Toca el círculo para anotar algo.</p>'}
      </section>
      <aside class="side st" style="--i:2">
        <section><span class="h">Próximas</span>
          ${px.length ? px.map(fila).join('') : '<p class="side-empty">Nada programado para los próximos días.</p>'}</section>
      </aside>
    </div>`;
}

function tarjeta(p, s) {
  const c = cuando(p.fecha), e = enCurso.get(p.id), proy = p.proyectoId ? nombreDe(s, p.proyectoId) : '';
  const resto = e ? Math.max(0, ESPERA - (Date.now() - e.inicio)) : ESPERA;
  return `<article class="qt${e ? ' done' : ''}" data-id="${esc(p.id)}" style="--resto:${resto}ms">
    <div class="qt-inner">
      <div class="qt-face">
        <button class="check" data-abrir="${esc(p.id)}" aria-label="Editar: ${esc(p.titulo)}" title="Editar"></button>
        <button class="qt-hit" data-hecho="${esc(p.id)}" ${e ? 'tabindex="-1"' : ''} aria-label="Marcar como hecho: ${esc(p.titulo)}"><span class="qt-title">${esc(p.titulo)}</span></button>
        <span class="qt-meta${c.tarde ? ' late' : ''}">${p.importante ? '<i class="imp" title="Importante"></i>' : ''}${c.txt}${p.rep ? ' · ' + esc(textoRep(p.rep).replace('Se repite cada', 'cada')) : ''}${proy ? ' · ' + esc(proy) : ''}</span>
      </div>
      <button class="qt-face qt-back" data-deshacer="${esc(p.id)}" ${e ? '' : 'tabindex="-1"'} aria-label="Deshacer: ${esc(p.titulo)}">
        <b>Hecha</b><span><small>Toca para deshacer</small><span class="bar"><i></i></span></span>
      </button>
    </div>
  </article>`;
}

const fila = p => `<button class="srow" data-abrir="${esc(p.id)}"><span>${esc(p.titulo)}</span><span>${p.fecha ? fechaCorta(p.fecha) : '—'}</span></button>`;

/* ---------- interacción ---------- */
export function montar(view, ctx) {
  /* Mantener presionada una tarjeta abre su detalle (en el celular no hay círculo de edición). */
  let lp = null, usado = false;
  const soltar = () => { if (!lp) return; clearTimeout(lp.t); lp.card.classList.remove('presionando'); lp = null; };
  view.addEventListener('pointerdown', e => {
    usado = false;
    const card = e.target.closest('.qt');
    if (!card || card.classList.contains('done') || e.button > 0 || e.target.closest('.check')) return;
    soltar();
    card.classList.add('presionando');
    lp = { card, x: e.clientX, y: e.clientY, t: setTimeout(() => { const c = lp.card; soltar(); usado = true; abrirDetalle(ctx, c.dataset.id, c); }, 480) };
  });
  view.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) soltar(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => view.addEventListener(t, soltar));
  view.addEventListener('contextmenu', e => { if (e.target.closest('.qt')) e.preventDefault(); });
  view.addEventListener('click', e => {
    if (usado) { usado = false; e.preventDefault(); return; }
    const abrir = e.target.closest('[data-abrir]');
    if (abrir) { abrirDetalle(ctx, abrir.dataset.abrir); return; }
    const des = e.target.closest('[data-deshacer]');
    if (des) { deshacer(view, des.dataset.deshacer, ctx); return; }
    const card = e.target.closest('.qt');
    if (card && !card.classList.contains('done')) completar(card, ctx);
  });
}

function completar(card, ctx) {
  const id = card.dataset.id;
  if (enCurso.has(id)) return;
  card.style.setProperty('--resto', ESPERA + 'ms');
  card.classList.add('done');
  card.querySelector('.qt-hit').tabIndex = -1;
  const back = card.querySelector('.qt-back');
  back.tabIndex = 0;
  if (card.contains(document.activeElement)) back.focus({ preventScroll: true });
  enCurso.set(id, {
    inicio: Date.now(),
    timer: setTimeout(() => {
      enCurso.delete(id);
      const p = ctx.store.buscar('pendientes', id);
      if (p) ctx.store.guardar('pendientes', { ...p, estado: 'hecho', completado: iso(hoy()) });
    }, ESPERA)
  });
}

function deshacer(view, id, ctx) {
  const e = enCurso.get(id); if (!e) return;
  clearTimeout(e.timer); enCurso.delete(id);
  const card = view.querySelector(`.qt[data-id="${CSS.escape(id)}"]`);
  if (!card) { ctx.render(); return; }
  card.classList.remove('done');
  card.querySelector('.qt-back').tabIndex = -1;
  const hit = card.querySelector('.qt-hit'); hit.tabIndex = 0; hit.focus({ preventScroll: true });
}

/* ---------- detalle (nuevo o existente) ---------- */
export function abrirDetalle(ctx, id, desde, base = {}) {
  const previo = id ? ctx.store.buscar('pendientes', id) : null;
  if (id && !previo) return;
  const p = previo ? { ...previo } : { id: uid(), titulo: '', notas: '', estado: 'pendiente', importante: false, fecha: iso(hoy()), rep: null, creado: iso(hoy()), proyectoId: '', ...base };
  const estados = [['pendiente', 'Pendiente'], ['hecho', 'Hecha']];
  const ei = Math.max(0, estados.findIndex(x => x[0] === p.estado));
  ctx.abrirHoja(`<form id="f-det" novalidate>
      <input class="sh-title" name="titulo" value="${esc(p.titulo)}" placeholder="¿Qué tienes pendiente?" autocomplete="off" ${previo ? '' : 'autofocus'} aria-label="Pendiente">
      <textarea class="inp area" name="notas" rows="3" placeholder="Notas" aria-label="Notas">${esc(p.notas || '')}</textarea>
      <div class="two">
        <div class="field"><label for="d-fecha">Fecha</label><input class="inp" id="d-fecha" name="fecha" type="date" value="${esc(p.fecha || '')}"></div>
        <div class="field"><span class="lbl">Importante</span><button type="button" class="sw" id="d-imp" role="switch" aria-checked="${!!p.importante}" aria-label="Importante"></button></div>
      </div>
      <div class="field"><span class="lbl" id="d-proy-l">Proyecto</span><button type="button" class="t-sel" id="d-proy" data-valor="${esc(p.proyectoId || '')}" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="d-proy-l d-proy"></button></div>
      <div class="field"><span class="lbl">Estado</span><div class="seg" id="d-estado" style="--n:2;--i:${ei}" role="group" aria-label="Estado">${estados.map((x, i) => `<button type="button" data-i="${i}" data-e="${x[0]}" aria-pressed="${i === ei}">${x[1]}</button>`).join('')}</div></div>
      <div class="field"><label for="d-unidad">Repetir cada</label><div class="rep-row">
        <input class="inp" id="d-n" type="number" min="1" max="365" value="${p.rep ? p.rep.n : 1}" ${p.rep ? '' : 'disabled'} aria-label="Cada cuántos">
        <select class="inp" id="d-unidad" aria-label="Repetir">${[['', 'No se repite'], ['d', 'días'], ['h', 'días hábiles'], ['w', 'semanas'], ['m', 'meses']].map(o => `<option value="${o[0]}"${(p.rep ? p.rep.unit : '') === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
      </div></div>
      ${pieHoja(!!previo)}
    </form>`, {
    desde,
    montar: s => {
      const f = s.querySelector('#f-det');
      s.querySelector('#d-imp').onclick = e => { const b = e.currentTarget; b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); };
      s.querySelector('#d-estado').onclick = e => {
        const b = e.target.closest('[data-e]'); if (!b) return;
        const seg = e.currentTarget; seg.style.setProperty('--i', b.dataset.i);
        seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      };
      s.querySelector('#d-unidad').onchange = e => { s.querySelector('#d-n').disabled = !e.target.value; };
      /* Proyecto: los activos (y el actual aunque esté en pausa o terminado) */
      const pr = s.querySelector('#d-proy');
      const pintarProy = () => {
        const n = pr.dataset.valor ? nombreDe(ctx.store.state, pr.dataset.valor) : '';
        pr.innerHTML = `${n ? ICONO.carpeta : ''}<span>${n ? esc(n) : 'Sin proyecto'}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>`;
      };
      pintarProy();
      pr.onclick = () => {
        const st = ctx.store.state, lista = activos(st);
        if (pr.dataset.valor && !lista.some(x => x.id === pr.dataset.valor)) { const x = st.proyectos.find(y => y.id === pr.dataset.valor); if (x) lista.push(x); }
        desplegable(pr, [{ v: '', actual: !pr.dataset.valor, html: 'Sin proyecto' }, ...lista.map((x, i) => ({ v: x.id, sep: i === 0, actual: x.id === pr.dataset.valor, html: esc(x.nombre) }))], v => { pr.dataset.valor = v; pintarProy(); });
      };
      f.onsubmit = e => { e.preventDefault(); ctx.cerrarHoja(); };
      const borrar = s.querySelector('[data-borrar]');
      if (borrar) borrar.onclick = () => {
        p.__borrado = true; ctx.store.borrar('pendientes', p.id); ctx.cerrarHoja();
        ctx.toast('Pendiente eliminado', () => ctx.store.guardar('pendientes', previo));
      };
      s.__leer = () => {
        const unidad = s.querySelector('#d-unidad').value;
        const estado = s.querySelector('#d-estado [aria-pressed="true"]').dataset.e;
        return {
          ...p,
          titulo: f.titulo.value.trim(), notas: f.notas.value.trim(), fecha: f.fecha.value || '',
          importante: s.querySelector('#d-imp').getAttribute('aria-checked') === 'true',
          estado, completado: estado === 'hecho' ? (p.completado || iso(hoy())) : '',
          rep: unidad ? { n: Math.min(365, Math.max(1, parseInt(s.querySelector('#d-n').value, 10) || 1)), unit: unidad } : null,
          proyectoId: pr.dataset.valor || ''
        };
      };
    },
    cerrar: s => {
      if (p.__borrado || !s.__leer) return;
      const n = s.__leer();
      if (!n.titulo) { if (previo) ctx.toast('El pendiente necesita un nombre; se conservó el anterior.'); return; }
      const clave = x => JSON.stringify([x.titulo, x.notas || '', x.fecha || '', !!x.importante, x.estado, x.rep || null, x.proyectoId || '']);
      if (!previo || clave(n) !== clave(previo)) {
        if (previo && JSON.stringify(n.rep) !== JSON.stringify(previo.rep)) n.repGenerada = false;
        ctx.store.guardar('pendientes', n);
      }
    }
  });
}

/* ---------- búsqueda (para el buscador tipo Spotlight) ---------- */
export function buscar(store, q) {
  const t = norm(q).trim();
  if (!t) return [];
  return store.state.pendientes
    .filter(p => norm(p.titulo).includes(t) || norm(p.notas).includes(t))
    .sort((a, b) => ((a.estado === 'hecho') - (b.estado === 'hecho')) || String(a.fecha || '9').localeCompare(String(b.fecha || '9')))
    .slice(0, 20);
}
