/* Presupuesto (Control › Presupuesto).
   Se arma una vez al inicio del mes: ingresos y gastos, cada gasto exacto (sabes cuánto) o estimado (un tope),
   con su categoría. No se registra cada gasto: al cerrar el mes anotas lo real de cada partida y cuadras tu dinero.
   Las partidas que se repiten aparecen solas en el mes siguiente. Todo en pesos.
   Hojas: Presupuesto (partidas) y Meses (lo que tenías al empezar y lo que hay en tus cuentas al cerrar). */
import { esc, uid, MESES, cap, pieHoja } from '../util.js';
import { desplegable } from '../desplegable.js';

const hoyMes = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const ui = { mes: hoyMes(), vista: 'plan' };
const repetidas = new Set();   // meses ya revisados en esta sesión
const esMac = () => matchMedia('(min-width:820px)').matches;

/* ---------- categorías (editables, como los tipos de actividad) ---------- */
const BASE = [
  { k: 'vivienda', l: 'Vivienda', color: '#c9bcff' }, { k: 'comida', l: 'Comida', color: '#ffc99a' },
  { k: 'transporte', l: 'Transporte', color: '#9ad0f5' }, { k: 'suscripciones', l: 'Suscripciones', color: '#bdeca6' },
  { k: 'salud', l: 'Salud', color: '#f5a3b5' }, { k: 'ocio', l: 'Ocio', color: '#fdf5b0' },
  { k: 'ahorro', l: 'Ahorro', color: '#7ee0c3' }, { k: 'otros', l: 'Otros', color: '#c8ccd4' }
];
export function categorias(s) {
  const f = s.config.find(c => c.id === 'categorias');
  let l = null; try { l = f && JSON.parse(f.valor); } catch (e) {}
  if (!Array.isArray(l) || !l.length) l = BASE;
  if (!l.some(c => c.k === 'otros')) l = [...l, BASE.find(c => c.k === 'otros')];
  return l;
}
const cat = (s, k) => categorias(s).find(c => c.k === k) || categorias(s).find(c => c.k === 'otros');

/* ---------- números ---------- */
const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const tieneReal = p => p.real !== '' && p.real != null && isFinite(parseFloat(p.real));
export const dinero = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-MX');
const sinSigno = n => Math.abs(Math.round(n)).toLocaleString('es-MX');
const nombreMes = k => { const [y, m] = k.split('-').map(Number); return `${cap(MESES[m - 1])} ${y}`; };
const mover = (k, d) => { const [y, m] = k.split('-').map(Number), x = new Date(y, m - 1 + d, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
const delMes = (s, k) => s.partidas.filter(p => p.mes === k).sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.nombre).localeCompare(String(b.nombre)));

/* Las partidas que se repiten pasan solas al mes actual (una vez; el id evita duplicados entre dispositivos). */
function asegurarRepetidas(store, k) {
  if (repetidas.has(k) || k < hoyMes()) return;
  repetidas.add(k);
  const s = store.state, ant = mover(k, -1);
  if (delMes(s, k).length) return;
  delMes(s, ant).filter(p => p.repetir).forEach(p => {
    const origen = p.origen || p.id;
    store.guardar('partidas', { ...p, id: origen + '@' + k, mes: k, origen, real: '' });
  });
}

/* ---------- vista ---------- */
export const pausarRender = () => !!document.activeElement?.closest?.('.pp-cierre');
export function render(ctx) {
  const s = ctx.store.state;
  if (!repetidas.has(ui.mes) && ui.mes >= hoyMes()) queueMicrotask(() => asegurarRepetidas(ctx.store, ui.mes));
  const ps = delMes(s, ui.mes);
  const cab = `<div class="r-head st"><h1>${nombreMes(ui.mes)}</h1>
      <div class="daynav"><button class="icon" data-pmes="-1" aria-label="Mes anterior"><svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg></button><button class="icon" data-pmes="1" aria-label="Mes siguiente"><svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg></button></div></div>
    <div class="seg pp-seg st" style="--n:2;--i:${ui.vista === 'cierre' ? 1 : 0}" role="group" aria-label="Plan o cierre"><button data-pvista="plan" aria-pressed="${ui.vista !== 'cierre'}">Plan</button><button data-pvista="cierre" aria-pressed="${ui.vista === 'cierre'}">Cierre</button></div>`;
  if (!ps.length) {
    const ant = delMes(s, mover(ui.mes, -1));
    return `<div class="pp">${cab}<p class="empty st" style="--i:2">Sin partidas en ${nombreMes(ui.mes).toLowerCase()}. Agrega tus ingresos y gastos con el círculo.</p>
      ${ant.length ? `<button class="btn sm glass st" style="--i:3;margin-top:12px" data-copiar-ant>Copiar el plan de ${MESES[Number(mover(ui.mes, -1).split('-')[1]) - 1]}</button>` : ''}</div>`;
  }
  return `<div class="pp">${cab}${ui.vista === 'cierre' ? cierre(s, ps) : plan(s, ps)}</div>`;
}

function fila(s, p) {
  const c = p.tipo === 'gasto' ? cat(s, p.categoria) : null;
  const det = p.tipo === 'ingreso' ? (p.repetir ? 'Se repite cada mes' : 'Solo este mes') : `${p.modo === 'estimado' ? 'Estimado' : 'Exacto'}${p.repetir ? ' · se repite' : ''}`;
  return `<button class="pp-row" data-par="${esc(p.id)}"><b>${esc(p.nombre)}</b><small>${det}</small><em class="${p.tipo === 'ingreso' ? 'in' : ''}">${dinero(num(p.monto))}</em></button>`;
}

function plan(s, ps) {
  const ing = ps.filter(p => p.tipo === 'ingreso'), gas = ps.filter(p => p.tipo === 'gasto');
  const tIng = ing.reduce((t, p) => t + num(p.monto), 0), tGas = gas.reduce((t, p) => t + num(p.monto), 0), libre = tIng - tGas;
  const exactos = gas.filter(p => p.modo !== 'estimado').reduce((t, p) => t + num(p.monto), 0);
  /* por categoría, en el orden de tus categorías */
  const grupos = categorias(s).map(c => ({ c, ps: gas.filter(p => cat(s, p.categoria).k === c.k) })).filter(g => g.ps.length)
    .map(g => ({ ...g, t: g.ps.reduce((t, p) => t + num(p.monto), 0) }));
  const base = Math.max(tIng, tGas) || 1;
  const reparto = grupos.map(g => `<i style="flex:${g.t / base};background:${g.c.color}" title="${esc(g.c.l)}: ${dinero(g.t)}"></i>`).join('') + (libre > 0 ? `<i class="libre" style="flex:${libre / base}" title="Libre: ${dinero(libre)}"></i>` : '');
  const leyenda = grupos.map(g => `<span><i style="background:${g.c.color}"></i>${esc(g.c.l)}</span>`).join('') + (libre > 0 ? '<span><i class="libre"></i>Libre</span>' : '');
  /* el mes pasado, si ya cerró */
  const ant = delMes(s, mover(ui.mes, -1)).filter(p => p.tipo === 'gasto');
  let nota = '';
  if (ant.length && ant.every(tieneReal)) {
    const d = ant.reduce((t, p) => t + num(p.real) - num(p.monto), 0);
    nota = `<p class="note pp-ant">${cap(MESES[Number(mover(ui.mes, -1).split('-')[1]) - 1])} cerró ${Math.abs(d) < 1 ? 'justo en lo planeado' : `con ${dinero(Math.abs(d))} ${d > 0 ? 'sobre' : 'bajo'} lo planeado`}.</p>`;
  }
  const resumen = `<div class="pp-res st" style="--i:2">
      <span class="h">${libre >= 0 ? 'Te queda libre' : 'Te faltan'}</span>
      <p class="pp-big${libre < 0 ? ' neg' : ''}">${dinero(Math.abs(libre))} <small>de ${dinero(tIng)}</small></p>
      ${grupos.length ? `<div class="pp-reparto" aria-hidden="true">${reparto}</div><div class="pp-ley">${leyenda}</div>` : ''}
      <div class="pp-3"><div class="card"><b>${dinero(tIng)}</b><span>ingresos</span></div><div class="card"><b>${dinero(exactos)}</b><span>exactos</span></div><div class="card"><b>${dinero(tGas - exactos)}</b><span>estimados</span></div></div>
      ${nota}
    </div>`;
  const listas = `<div class="pp-listas st" style="--i:3">
      <section class="sec"><span class="h">Ingresos</span>
        ${ing.length ? `<div class="card pp-lista">${ing.map(p => fila(s, p)).join('')}</div>` : '<p class="note">Sin ingresos. Agrégalos con el círculo.</p>'}</section>
      <section class="sec"><span class="h">Gastos</span>
        ${grupos.length ? `<div class="card pp-lista">${grupos.map(g => `<div class="pp-cat"><span><i style="background:${g.c.color}"></i>${esc(g.c.l)}</span><em>${dinero(g.t)}</em></div>${g.ps.map(p => fila(s, p)).join('')}`).join('')}</div>` : '<p class="note">Sin gastos todavía.</p>'}</section>
    </div>`;
  return `<div class="pp-plan">${resumen}${listas}</div>`;
}

function cierre(s, ps) {
  const ing = ps.filter(p => p.tipo === 'ingreso'), gas = ps.filter(p => p.tipo === 'gasto');
  const m = s.meses.find(x => x.id === ui.mes) || {};
  const filaC = p => {
    const r = tieneReal(p), d = r ? num(p.real) - num(p.monto) : 0;
    const clase = !r || Math.abs(d) < 1 ? '' : (p.tipo === 'gasto' ? (d > 0 ? 'mas' : 'menos') : (d < 0 ? 'mas' : 'menos'));
    return `<div class="pp-c"><span>${esc(p.nombre)}</span><span>${sinSigno(num(p.monto))}</span>
      <label class="pp-in ${clase}"><input inputmode="decimal" data-real="${esc(p.id)}" value="${r ? sinSigno(num(p.real)) : ''}" placeholder="—" aria-label="Real de ${esc(p.nombre)}" autocomplete="off"></label></div>`;
  };
  const grupos = categorias(s).map(c => ({ c, ps: gas.filter(p => cat(s, p.categoria).k === c.k) })).filter(g => g.ps.length);
  return `<div class="pp-cierre">
    <p class="note st" style="--i:2;margin-top:12px">Anota lo real de cada partida. Lo que dejes vacío cuenta como lo planeado.</p>
    <div class="card pp-tabla st" style="--i:3">
      <div class="pp-c cab"><span></span><span>Plan</span><span>Real</span></div>
      ${ing.length ? `<div class="pp-cat"><span>Ingresos</span></div>${ing.map(filaC).join('')}` : ''}
      ${grupos.map(g => `<div class="pp-cat"><span><i style="background:${g.c.color}"></i>${esc(g.c.l)}</span></div>${g.ps.map(filaC).join('')}`).join('')}
    </div>
    <div class="card pp-cuadre st" style="--i:4">
      <span class="h">Cuadre de dinero</span>
      <div class="l"><span>Tenías al empezar</span><label class="pp-in"><input inputmode="decimal" data-mes="inicial" value="${m.inicial !== undefined && m.inicial !== '' ? sinSigno(num(m.inicial)) : ''}" placeholder="—" aria-label="Lo que tenías al empezar el mes" autocomplete="off"></label></div>
      <div class="l"><span>+ Ingresos reales</span><b data-t="ing"></b></div>
      <div class="l"><span>− Gastos reales</span><b data-t="gas"></b></div>
      <div class="l t"><span>Deberías tener</span><b data-t="deberias"></b></div>
      <div class="l"><span>Tienes en tus cuentas</span><label class="pp-in"><input inputmode="decimal" data-mes="final" value="${m.final !== undefined && m.final !== '' ? sinSigno(num(m.final)) : ''}" placeholder="—" aria-label="Lo que tienes en tus cuentas" autocomplete="off"></label></div>
      <div class="pp-estado" data-t="estado"></div>
    </div>
  </div>`;
}

/* Totales del cuadre: se recalculan mientras escribes, sin redibujar la página. */
function cuadrar(view, s) {
  const caja = view.querySelector('.pp-cuadre'); if (!caja) return;
  const val = (p) => { const i = view.querySelector(`[data-real="${CSS.escape(p.id)}"]`); const v = i ? i.value.trim() : ''; return v === '' ? num(p.monto) : num(v); };
  const ps = delMes(s, ui.mes);
  const ing = ps.filter(p => p.tipo === 'ingreso').reduce((t, p) => t + val(p), 0);
  const gas = ps.filter(p => p.tipo === 'gasto').reduce((t, p) => t + val(p), 0);
  const ini = view.querySelector('[data-mes="inicial"]').value.trim(), fin = view.querySelector('[data-mes="final"]').value.trim();
  const deb = num(ini) + ing - gas;
  caja.querySelector('[data-t="ing"]').textContent = dinero(ing);
  caja.querySelector('[data-t="gas"]').textContent = dinero(gas);
  caja.querySelector('[data-t="deberias"]').textContent = ini === '' ? '—' : dinero(deb);
  const est = caja.querySelector('[data-t="estado"]');
  if (ini === '' || fin === '') { est.className = 'pp-estado'; est.innerHTML = '<span>Anota lo que tenías al empezar y lo que hay hoy en tus cuentas para cuadrar.</span>'; return; }
  const d = num(fin) - deb;
  if (Math.abs(d) < 1) { est.className = 'pp-estado ok'; est.innerHTML = '<i>✓</i><span>Cuadra. Tu dinero coincide con el plan y lo real.</span>'; }
  else if (d < 0) { est.className = 'pp-estado falta'; est.innerHTML = `<i>!</i><span>Faltan <b>${dinero(-d)}</b> por explicar: algún gasto que no está en el plan.</span>`; }
  else { est.className = 'pp-estado sobra'; est.innerHTML = `<i>+</i><span>Sobran <b>${dinero(d)}</b>: algún ingreso que no anotaste o un gasto que fue menor.</span>`; }
}

/* ---------- interacción ---------- */
export function montar(view, ctx) {
  cuadrar(view, ctx.store.state);
  view.addEventListener('click', e => {
    const pm = e.target.closest('[data-pmes]');
    if (pm) { ui.mes = mover(ui.mes, Number(pm.dataset.pmes)); ctx.render(); return; }
    const pv = e.target.closest('[data-pvista]');
    if (pv) { if (pv.dataset.pvista !== ui.vista) { ui.vista = pv.dataset.pvista; ctx.render(); } return; }
    const pr = e.target.closest('[data-par]');
    if (pr) { abrirPartida(ctx, pr.dataset.par, pr); return; }
    if (e.target.closest('[data-copiar-ant]')) {
      const ant = delMes(ctx.store.state, mover(ui.mes, -1));
      ant.forEach(p => ctx.store.guardar('partidas', { ...p, id: uid(), mes: ui.mes, origen: p.origen || p.id, real: '' }));
      ctx.toast(`Se copiaron ${ant.length} partidas`);
    }
  });
  view.addEventListener('input', e => {
    if (!e.target.matches('[data-real],[data-mes]')) return;
    cuadrar(view, ctx.store.state);
    const lbl = e.target.closest('.pp-in');
    if (e.target.dataset.real) {
      const p = ctx.store.buscar('partidas', e.target.dataset.real); if (!p || !lbl) return;
      const v = e.target.value.trim(), d = num(v) - num(p.monto);
      lbl.className = 'pp-in ' + (v === '' || Math.abs(d) < 1 ? '' : (p.tipo === 'gasto' ? (d > 0 ? 'mas' : 'menos') : (d < 0 ? 'mas' : 'menos')));
    }
  });
  view.addEventListener('change', e => {
    const t = e.target, v = t.value.trim();
    if (t.dataset.real) {
      const p = ctx.store.buscar('partidas', t.dataset.real); if (!p) return;
      const real = v === '' ? '' : String(num(v));
      if (String(p.real ?? '') !== real) ctx.store.guardar('partidas', { ...p, real });
      if (v !== '') t.value = sinSigno(num(v));
    }
    if (t.dataset.mes) {
      const m = ctx.store.buscar('meses', ui.mes) || { id: ui.mes, inicial: '', final: '' };
      const val = v === '' ? '' : String(num(v));
      if (String(m[t.dataset.mes] ?? '') !== val) ctx.store.guardar('meses', { ...m, [t.dataset.mes]: val });
      if (v !== '') t.value = sinSigno(num(v));
    }
  });
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.pp-in input')) e.target.blur(); });
}

export function nuevo(ctx, desde) { ui.vista = 'plan'; abrirPartida(ctx, null, desde); }
export const etiquetaNuevo = () => 'Nueva partida';

/* ---------- hoja: crear o editar partida ---------- */
function abrirPartida(ctx, id, desde) {
  const previo = id ? ctx.store.buscar('partidas', id) : null;
  if (id && !previo) return;
  const s = ctx.store.state;
  const p = previo ? { ...previo } : { id: uid(), mes: ui.mes, tipo: 'gasto', nombre: '', monto: '', modo: 'exacto', categoria: categorias(s)[0].k, repetir: true, real: '', orden: delMes(s, ui.mes).length };
  const seg = (nombre, op, v) => { const i = Math.max(0, op.findIndex(o => o[0] === v)); return `<div class="seg" data-seg="${nombre}" style="--n:${op.length};--i:${i}" role="group">${op.map((o, k) => `<button type="button" data-i="${k}" data-v="${o[0]}" aria-pressed="${k === i}">${o[1]}</button>`).join('')}</div>`; };
  ctx.abrirHoja(`<form id="f-par" novalidate>
      <input class="sh-title" name="nombre" value="${esc(p.nombre)}" placeholder="Nombre (renta, súper, sueldo…)" autocomplete="off" ${previo ? '' : 'autofocus'} aria-label="Partida">
      <div class="field">${seg('tipo', [['ingreso', 'Ingreso'], ['gasto', 'Gasto']], p.tipo)}</div>
      <div class="field"><label for="pp-monto">Monto</label><input class="inp pp-monto" id="pp-monto" name="monto" inputmode="decimal" value="${p.monto !== '' ? sinSigno(num(p.monto)) : ''}" placeholder="$0" autocomplete="off"></div>
      <div class="field" data-solo-gasto><span class="lbl">Tipo de gasto</span>${seg('modo', [['exacto', 'Exacto'], ['estimado', 'Estimado']], p.modo || 'exacto')}
        <p class="note" style="margin-top:6px" data-modo-nota></p></div>
      <div class="field" data-solo-gasto><span class="lbl" id="pp-cat-l">Categoría</span><button type="button" class="t-sel" id="pp-cat" data-valor="${esc(p.categoria || 'otros')}" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="pp-cat-l pp-cat"></button></div>
      <div class="sw-row"><span>Repetir cada mes<small>Aparece sola al empezar el mes siguiente</small></span><button type="button" class="sw" id="pp-rep" role="switch" aria-checked="${!!p.repetir}" aria-label="Repetir cada mes"></button></div>
      ${pieHoja(!!previo)}
    </form>
    <div class="t-editor" id="c-editor" hidden></div>`, {
    desde,
    montar: sh => {
      const f = sh.querySelector('#f-par'), sel = sh.querySelector('#pp-cat');
      const valor = n => sh.querySelector(`[data-seg="${n}"] [aria-pressed="true"]`).dataset.v;
      const pintar = () => {
        const gasto = valor('tipo') === 'gasto';
        sh.querySelectorAll('[data-solo-gasto]').forEach(x => { x.hidden = !gasto; });
        sh.querySelector('[data-modo-nota]').textContent = valor('modo') === 'estimado' ? 'Estimado: un tope. Al cerrar el mes anotas cuánto fue en realidad.' : 'Exacto: sabes cuánto será (renta, suscripciones).';
        const c = cat(ctx.store.state, sel.dataset.valor); sel.dataset.valor = c.k;
        sel.innerHTML = `<i style="background:${c.color}"></i><span>${esc(c.l)}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>`;
      };
      pintar();
      sh.querySelectorAll('[data-seg]').forEach(g => g.onclick = e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        g.style.setProperty('--i', b.dataset.i); g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); pintar();
      });
      sh.querySelector('#pp-rep').onclick = e => { const b = e.currentTarget; b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); };
      sel.onclick = () => desplegable(sel, [
        ...categorias(ctx.store.state).map(c => ({ v: c.k, actual: c.k === sel.dataset.valor, html: `<i class="dot" style="background:${c.color}"></i>${esc(c.l)}` })),
        { v: '__editar', sep: true, html: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13H3v-3z"/></svg>Editar categorías…' }
      ], v => {
        if (v !== '__editar') { sel.dataset.valor = v; pintar(); return; }
        editorCategorias(ctx, sh, () => { f.hidden = false; sh.querySelector('#c-editor').hidden = true; pintar(); sel.focus(); });
        f.hidden = true;
      });
      f.onsubmit = e => { e.preventDefault(); ctx.cerrarHoja(); };
      const borrar = sh.querySelector('[data-borrar]');
      if (borrar) borrar.onclick = () => {
        p.__borrado = true; ctx.store.borrar('partidas', p.id); ctx.cerrarHoja();
        ctx.toast('Partida eliminada', () => ctx.store.guardar('partidas', previo));
      };
      sh.__leer = () => {
        const tipo = valor('tipo');
        return { ...p, nombre: f.nombre.value.trim(), tipo, monto: num(f.monto.value), modo: tipo === 'gasto' ? valor('modo') : '',
          categoria: tipo === 'gasto' ? sel.dataset.valor : '', repetir: sh.querySelector('#pp-rep').getAttribute('aria-checked') === 'true' };
      };
    },
    cerrar: sh => {
      if (p.__borrado || !sh.__leer) return;
      const n = sh.__leer();
      if (!n.nombre) { if (previo) ctx.toast('La partida necesita un nombre; se conservó la anterior.'); return; }
      const clave = x => JSON.stringify([x.nombre, x.tipo, num(x.monto), x.modo || '', x.categoria || '', !!x.repetir]);
      if (!previo || clave(n) !== clave(previo)) ctx.store.guardar('partidas', n);
    }
  });
}

/* Editor de categorías dentro de la hoja: nombre, color, agregar y borrar. Al borrar, sus gastos pasan a Otros. */
function editorCategorias(ctx, sh, volver) {
  const caja = sh.querySelector('#c-editor');
  let borrador = categorias(ctx.store.state).map(c => ({ ...c }));
  const borradas = new Set();
  const usos = k => ctx.store.state.partidas.filter(p => p.categoria === k).length;
  const BASURA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.2 6.5l.9 12.6c.1 1 .9 1.9 2 1.9h5.8c1 0 1.9-.8 2-1.9l.9-12.6M10.2 10.5v6.5M13.8 10.5v6.5"/></svg>';
  const pintar = () => {
    caja.innerHTML = `<div class="sh-bar"><button type="button" class="c-btn glass" data-c-volver aria-label="Volver sin guardar" title="Volver sin guardar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h2 class="sh-h">Categorías</h2><button type="button" class="c-btn ok" data-c-ok aria-label="Guardar categorías" title="Guardar categorías"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button></div>
      <p class="note">Cambia el nombre o el color, agrega o borra categorías y toca la palomita. Al borrar una, sus gastos pasan a Otros.</p>
      <ul class="t-lista">${borrador.map(c => `<li data-k="${c.k}">
        <label class="t-color" style="--c:${c.color}" title="Color"><input type="color" value="${c.color}" aria-label="Color de ${esc(c.l)}"></label>
        <input class="inp" value="${esc(c.l)}" maxlength="24" aria-label="Nombre de la categoría">
        ${c.k === 'otros' ? '<span class="t-fijo" title="Esta categoría no se puede borrar"></span>' : `<button type="button" class="c-btn glass del" data-c-borrar aria-label="Borrar ${esc(c.l)}" title="Borrar">${BASURA}</button>`}
      </li>`).join('')}</ul>
      <button type="button" class="btn sm glass" data-c-nueva>Agregar categoría</button>`;
  };
  const de = el => borrador.find(c => c.k === el.closest('[data-k]').dataset.k);
  caja.oninput = e => {
    const li = e.target.closest('[data-k]'); if (!li) return;
    if (e.target.type === 'color') { de(e.target).color = e.target.value; li.querySelector('.t-color').style.setProperty('--c', e.target.value); }
    else if (e.target.classList.contains('inp')) de(e.target).l = e.target.value;
  };
  caja.onclick = e => {
    if (e.target.closest('[data-c-volver]')) { volver(); return; }
    if (e.target.closest('[data-c-ok]')) {
      const lista = borrador.map(c => ({ ...c, l: c.l.trim() || 'Sin nombre' }));
      ctx.store.state.partidas.filter(p => borradas.has(p.categoria)).forEach(p => ctx.store.guardar('partidas', { ...p, categoria: 'otros' }));
      ctx.store.guardar('config', { id: 'categorias', valor: JSON.stringify(lista) });
      volver(); ctx.toast('Categorías guardadas'); return;
    }
    if (e.target.closest('[data-c-nueva]')) {
      const k = 'c' + uid().slice(0, 8);
      borrador.splice(borrador.length - 1, 0, { k, l: 'Nueva categoría', color: '#9ad0f5' });
      pintar(); const i = caja.querySelector(`[data-k="${k}"] .inp`); i.focus(); i.select(); return;
    }
    const b = e.target.closest('[data-c-borrar]');
    if (b) {
      const k = b.closest('[data-k]').dataset.k, n = usos(k);
      if (n && !confirm(`${n === 1 ? 'Un gasto usa' : n + ' gastos usan'} esta categoría y ${n === 1 ? 'pasará' : 'pasarán'} a Otros al guardar. ¿Borrarla?`)) return;
      borradas.add(k); borrador = borrador.filter(c => c.k !== k); pintar();
    }
  };
  pintar();
  caja.hidden = false;
  const sc = sh.querySelector('.sh-scroll'); if (sc) sc.scrollTop = 0;
}
