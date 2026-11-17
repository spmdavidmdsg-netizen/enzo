/* Proyectos (Projects › Proyectos): lista de activos, detalle y hoja para crear o editar.
   Dos tipos, como en el task manager:
   · delimitado: tiene fin; se mide con el avance de sus pendientes.
   · exploratorio: abierto; se mide con la constancia (días con pendientes hechos).
   Los pendientes y las notas se ligan con proyectoId. */
import { esc, uid, iso, hoy, diasEntre, fechaCorta, cuando, pieHoja, MESES } from '../util.js';
import * as pendientes from './pendientes.js';

const ui = { detalle: null, todas: false };
export const ESTADOS = [['activo', 'Activo'], ['pausa', 'En pausa'], ['terminado', 'Terminado']];
export const TIPOS_P = [['delimitado', 'Delimitado'], ['exploratorio', 'Exploratorio']];
export const ICONO = {
  delimitado: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>',
  exploratorio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  carpeta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>'
};
const ATRAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const LAPIZ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5l4 4L9 19H5v-4z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

/* ---------- consultas (también las usan Pendientes y Notas) ---------- */
export const activos = s => s.proyectos.filter(p => p.estado === 'activo').sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
export const nombreDe = (s, id) => (s.proyectos.find(p => p.id === id) || {}).nombre || '';
const deProyecto = (s, id) => s.pendientes.filter(t => t.proyectoId === id);
const abierto = t => t.estado !== 'hecho';
const porFecha = (a, b) => String(a.fecha || '9').localeCompare(String(b.fecha || '9')) || String(a.creado || '').localeCompare(String(b.creado || ''));
function avance(s, p) {
  const ts = deProyecto(s, p.id), h = ts.filter(t => !abierto(t)).length;
  return { n: ts.length, h, pct: ts.length ? Math.round(h / ts.length * 100) : 0 };
}
/* Pendientes hechos por día (para la constancia de los exploratorios) */
function hechosPorDia(s, p) {
  const m = {};
  deProyecto(s, p.id).forEach(t => { if (!abierto(t) && t.completado) m[t.completado] = (m[t.completado] || 0) + 1; });
  return m;
}
const nivel = n => !n ? '' : n >= 4 ? 'a4' : 'a' + n;
const chipTipo = p => `<span class="chip">${ICONO[p.tipo] || ICONO.delimitado}${p.tipo === 'exploratorio' ? 'Exploratorio' : 'Delimitado'}</span>`;
function termina(p) {
  if (!p.fecha) return '';
  const n = diasEntre(iso(hoy()), p.fecha);
  return `Termina ${fechaCorta(p.fecha)}${n > 1 ? ` · faltan ${n} días` : n === 1 ? ' · mañana' : n === 0 ? ' · hoy' : ' · vencido'}`;
}

/* ---------- vista ---------- */
export const ocultaBarra = () => !!ui.detalle;
export function render(ctx) {
  const s = ctx.store.state;
  const p = ui.detalle && s.proyectos.find(x => x.id === ui.detalle);
  if (p) return detalle(ctx, p);
  ui.detalle = null; ui.todas = false;
  const act = activos(s), otros = s.proyectos.filter(x => x.estado !== 'activo')
    .sort((a, b) => (a.estado === 'pausa' ? 0 : 1) - (b.estado === 'pausa' ? 0 : 1) || String(b.actualizado).localeCompare(String(a.actualizado)));
  const tarjetas = act.map((x, i) => tarjeta(s, x, i + 1)).join('');
  return `<div class="proy">
    <h1 class="st">Proyectos</h1>
    ${act.length ? `<div class="p-grid">${tarjetas}</div>` : '<p class="empty st" style="--i:1">Sin proyectos activos. Toca el círculo para crear el primero.</p>'}
    ${otros.length ? `<section class="sec st" style="--i:${act.length + 2}"><span class="h">En pausa y terminados</span>
      <div class="p-otros">${otros.map(x => `<button class="srow" data-proy="${esc(x.id)}"><span>${esc(x.nombre)}</span><span>${x.estado === 'pausa' ? 'En pausa' : 'Terminado'}</span></button>`).join('')}</div></section>` : ''}
  </div>`;
}

function tarjeta(s, p, i) {
  let cuerpo;
  if (p.tipo === 'exploratorio') {
    const m = hechosPorDia(s, p), dias = [];
    for (let k = 13; k >= 0; k--) { const d = hoy(); d.setDate(d.getDate() - k); dias.push(m[iso(d)] || 0); }
    const n = dias.filter(Boolean).length;
    cuerpo = `<div class="p-mini" aria-hidden="true">${dias.map(v => `<i class="${nivel(v)}"></i>`).join('')}</div><p class="p-mini-l">${n ? `${n} de los últimos 14 días` : 'Sin avance en los últimos 14 días'}</p>`;
  } else {
    const a = avance(s, p), sig = deProyecto(s, p.id).filter(abierto).sort(porFecha)[0];
    const c = sig && sig.fecha ? cuando(sig.fecha) : null;
    cuerpo = `<div class="p-avance"><div class="p-barra"><i style="width:${a.pct}%"></i></div><span>${a.n ? `${a.h} de ${a.n} · ${a.pct} %` : 'Sin pendientes'}</span></div>
      ${sig ? `<p class="p-sig"><i></i><span>${esc(sig.titulo)}</span>${c ? `<em class="${c.tarde ? 'late' : ''}">${c.txt}</em>` : ''}</p>` : ''}`;
  }
  return `<button class="card p-card st" style="--i:${i}" data-proy="${esc(p.id)}">
    <b>${esc(p.nombre)}</b>
    <span class="p-meta">${chipTipo(p)}${p.fecha ? `<span class="chip">Termina ${fechaCorta(p.fecha)}</span>` : ''}</span>
    ${cuerpo}
  </button>`;
}

function fila(t, cur) {
  const hecha = !abierto(t), c = !hecha && t.fecha ? cuando(t.fecha) : null;
  return `<li class="tl-row${hecha ? ' done' : ''}${cur ? ' cur' : ''}">
    <button class="tl-node" data-tl="${esc(t.id)}" aria-label="${hecha ? 'Reabrir' : 'Marcar como hecho'}: ${esc(t.titulo)}">${hecha ? CHECK : ''}</button>
    <button class="tl-main" data-abrir="${esc(t.id)}"><span>${esc(t.titulo)}</span><em class="${c && c.tarde ? 'late' : ''}">${hecha ? (t.completado ? fechaCorta(t.completado) : '') : c ? c.txt : ''}</em></button>
  </li>`;
}

function detalle(ctx, p) {
  const s = ctx.store.state, ts = deProyecto(s, p.id);
  const pend = ts.filter(abierto).sort(porFecha);
  const hechas = ts.filter(t => !abierto(t)).sort((a, b) => String(a.completado || '').localeCompare(String(b.completado || '')));
  const estado = (ESTADOS.find(e => e[0] === p.estado) || ESTADOS[0])[1];
  let cuerpo;
  if (p.tipo === 'exploratorio') {
    /* Constancia: 5 semanas de lunes a domingo, terminando esta semana */
    const m = hechosPorDia(s, p), fin = hoy(); fin.setDate(fin.getDate() + (7 - fin.getDay()) % 7);
    let celdas = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join(''), total = 0, dias = 0;
    for (let k = 34; k >= 0; k--) {
      const d = new Date(fin); d.setDate(fin.getDate() - k); const f = iso(d), v = m[f] || 0;
      if (d > hoy()) { celdas += '<i class="fut"></i>'; continue; }
      if (v) { total += v; dias++; }
      celdas += `<i class="${nivel(v)}" title="${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}: ${v}"></i>`;
    }
    cuerpo = `<section class="sec st" style="--i:3"><span class="h">Pendientes</span>
        ${pend.length ? `<div class="qgrid">${pend.map(t => pendientes.tarjeta(t, s, false)).join('')}</div>`
          : '<p class="note">Sin pendientes. Anota lo siguiente que quieras explorar con el círculo.</p>'}</section>
      <section class="sec st" style="--i:4"><span class="h">Constancia · últimas 5 semanas</span>
        <div class="p-mes">${celdas}</div>
        <p class="p-mini-l">${total ? `${total} ${total === 1 ? 'pendiente hecho' : 'pendientes hechos'} en ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Aún sin pendientes hechos'}</p></section>`;
  } else {
    const a = avance(s, p);
    const visibles = ui.todas ? hechas : hechas.slice(-2);
    const filas = visibles.map(t => fila(t)).join('') + pend.map((t, i) => fila(t, i === 0)).join('');
    cuerpo = `<div class="p-avance grande st" style="--i:2"><div class="p-barra"><i style="width:${a.pct}%"></i></div><span>${a.pct} %</span></div>
      <section class="sec st" style="--i:3"><span class="h">Pendientes</span>
        ${filas ? `<ol class="tl">${filas}</ol>` : '<p class="note">Sin pendientes todavía. Agrega el primero con el círculo.</p>'}
        ${hechas.length > 2 ? `<button class="btn sm q" data-todas>${ui.todas ? 'Ocultar las hechas' : `Ver las ${hechas.length} hechas`}</button>` : ''}
      </section>`;
  }
  const notas = s.notas.filter(n => n.proyectoId === p.id).sort((a, b) => (Number(b.actualizado) || 0) - (Number(a.actualizado) || 0));
  return `<div class="proy">
    <div class="e-head st"><button class="c-btn glass" data-volver-p aria-label="Volver a tus proyectos" title="Volver">${ATRAS}</button><h1>${esc(p.nombre)}</h1><button class="c-btn glass" data-editar-p aria-label="Editar proyecto" title="Editar">${LAPIZ}</button></div>
    <div class="p-meta st" style="--i:1">${chipTipo(p)}<span class="chip">${estado}</span>${p.fecha ? `<span class="chip">${termina(p)}</span>` : ''}</div>
    ${p.descripcion ? `<p class="p-desc st" style="--i:1">${esc(p.descripcion)}</p>` : ''}
    ${cuerpo}
    <section class="sec st" style="--i:5"><span class="h">Notas</span>
      <div class="p-notas">${notas.map(n => `<button class="srow" data-nota="${esc(n.id)}"><span>${esc(n.titulo || 'Sin título')}</span><span>${fechaCorta(iso(new Date(Number(n.actualizado) || Date.now())))}</span></button>`).join('')}</div>
      <button class="btn sm q" data-nueva-nota>Nueva nota</button>
    </section>
  </div>`;
}

/* ---------- interacción ---------- */
export function montar(view, ctx) {
  /* Tarjetas y filas de pendientes: mismo comportamiento que en Pendientes (tocar = hecho con deshacer,
     mantener presionado o el círculo = editar) */
  pendientes.montar(view, ctx);
  view.addEventListener('click', e => {
    const pr = e.target.closest('[data-proy]');
    if (pr) { ui.detalle = pr.dataset.proy; ui.todas = false; ctx.render(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-volver-p]')) { ui.detalle = null; ctx.render(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-editar-p]')) { abrirProyecto(ctx, ui.detalle, e.target.closest('[data-editar-p]')); return; }
    if (e.target.closest('[data-todas]')) { ui.todas = !ui.todas; ctx.render(); return; }
    const tl = e.target.closest('[data-tl]');
    if (tl) {
      const t = ctx.store.buscar('pendientes', tl.dataset.tl); if (!t) return;
      const hecha = t.estado === 'hecho';
      ctx.store.guardar('pendientes', { ...t, estado: hecha ? 'pendiente' : 'hecho', completado: hecha ? '' : iso(hoy()) });
      return;
    }
    const no = e.target.closest('[data-nota]');
    if (no) { ctx.abrirNota(no.dataset.nota, ui.detalle); return; }
    if (e.target.closest('[data-nueva-nota]')) { ctx.nuevaNota(ui.detalle); return; }
  });
}

/* El círculo: en un proyecto abierto crea un pendiente de ese proyecto; en la lista, un proyecto nuevo. */
export function nuevo(ctx, desde) {
  if (ui.detalle) pendientes.abrirDetalle(ctx, null, desde, { proyectoId: ui.detalle, fecha: '' });
  else abrirProyecto(ctx, null, desde);
}
export const etiquetaNuevo = () => ui.detalle ? 'Nuevo pendiente del proyecto' : 'Nuevo proyecto';

/* ---------- hoja: crear o editar ---------- */
function abrirProyecto(ctx, id, desde) {
  const previo = id ? ctx.store.buscar('proyectos', id) : null;
  if (id && !previo) return;
  const p = previo ? { ...previo } : { id: uid(), nombre: '', tipo: 'delimitado', estado: 'activo', fecha: '', descripcion: '', creado: iso(hoy()) };
  const seg = (nombre, opciones, valor) => {
    const i = Math.max(0, opciones.findIndex(o => o[0] === valor));
    return `<div class="seg" data-seg="${nombre}" style="--n:${opciones.length};--i:${i}" role="group">${opciones.map((o, k) => `<button type="button" data-i="${k}" data-v="${o[0]}" aria-pressed="${k === i}">${o[1]}</button>`).join('')}</div>`;
  };
  ctx.abrirHoja(`<form id="f-proy" novalidate>
      <input class="sh-title" name="nombre" value="${esc(p.nombre)}" placeholder="Nombre del proyecto" autocomplete="off" ${previo ? '' : 'autofocus'} aria-label="Proyecto">
      <div class="field"><span class="lbl">Tipo</span>${seg('tipo', TIPOS_P, p.tipo)}
        <p class="note" style="margin-top:6px" data-tipo-nota></p></div>
      <div class="field"><span class="lbl">Estado</span>${seg('estado', ESTADOS, p.estado)}</div>
      <div class="field"><label for="p-fecha">Fecha límite</label><input class="inp" id="p-fecha" name="fecha" type="date" value="${esc(p.fecha || '')}"></div>
      <div class="field"><label for="p-desc">Descripción</label><textarea class="inp area" id="p-desc" name="descripcion" rows="3" placeholder="¿Qué quieres lograr?">${esc(p.descripcion || '')}</textarea></div>
      ${pieHoja(!!previo)}
    </form>`, {
    desde,
    montar: s => {
      const f = s.querySelector('#f-proy'), notaTipo = s.querySelector('[data-tipo-nota]');
      const valor = n => s.querySelector(`[data-seg="${n}"] [aria-pressed="true"]`).dataset.v;
      const pintarNota = () => { notaTipo.textContent = valor('tipo') === 'exploratorio' ? 'Abierto: se mide con tu constancia. La fecha límite es opcional.' : 'Tiene fin: se mide con el avance de sus pendientes.'; };
      pintarNota();
      s.querySelectorAll('[data-seg]').forEach(g => g.onclick = e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        g.style.setProperty('--i', b.dataset.i);
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
        pintarNota();
      });
      f.onsubmit = e => { e.preventDefault(); ctx.cerrarHoja(); };
      const borrar = s.querySelector('[data-borrar]');
      if (borrar) borrar.onclick = () => {
        const st = ctx.store.state, ts = deProyecto(st, p.id), ns = st.notas.filter(n => n.proyectoId === p.id);
        if ((ts.length || ns.length) && !confirm(`Se borra el proyecto. Sus ${ts.length} pendientes y ${ns.length} notas se conservan, sin proyecto. ¿Continuar?`)) return;
        p.__borrado = true;
        ts.forEach(t => ctx.store.guardar('pendientes', { ...t, proyectoId: '' }));
        ns.forEach(n => ctx.store.guardar('notas', { ...n, proyectoId: '' }));
        ctx.store.borrar('proyectos', p.id);
        ui.detalle = null;
        ctx.cerrarHoja();
        ctx.toast('Proyecto eliminado');
      };
      s.__leer = () => {
        const estado = valor('estado');
        return { ...p, nombre: f.nombre.value.trim(), tipo: valor('tipo'), estado, fecha: f.fecha.value || '', descripcion: f.descripcion.value.trim(),
          terminado: estado === 'terminado' ? (p.terminado || iso(hoy())) : '' };
      };
    },
    cerrar: s => {
      if (p.__borrado || !s.__leer) return;
      const n = s.__leer();
      if (!n.nombre) { if (previo) ctx.toast('El proyecto necesita un nombre; se conservó el anterior.'); return; }
      const clave = x => JSON.stringify([x.nombre, x.tipo, x.estado, x.fecha || '', x.descripcion || '']);
      if (!previo || clave(n) !== clave(previo)) ctx.store.guardar('proyectos', n);
      if (!previo) { ui.detalle = n.id; }
    }
  });
}

/* Para abrir un proyecto desde fuera (por ejemplo, desde una nota). */
export function verProyecto(id) { ui.detalle = id; ui.todas = false; }
