/* Rutina (Today › Rutina) y Resumen (Control › Resumen), más la subpágina Editar rutina.
   Rutina muestra el día: cada actividad es un botón; hecha = botón pulsado.
   Las actividades de ejercicio de hoy tienen un botón Empezar que abre su rutina de ejercicio.
   Editar rutina arma la semana tipo: actividades por día, huecos libres, empalmes y horas útiles. */
import { esc, iso, hoy, desdeIso, cap, uid, DIAS, MESES, reduceMotion, pieHoja } from '../util.js';
import { TIPOS, DIAS_SEMANA, PROTEGIDOS, filasDelDia, analizar, reloj, horas, listaTipos, cargarTipos, aMin } from '../tipos.js';
import { desplegable } from '../desplegable.js';
import * as ejercicio from './ejercicio.js';
import { RUTINAS, rutina as rutinaEj } from '../ejercicios.js';

const SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const ui = {
  modo: leer('enzo-rutina-modo', 'performance'),
  fecha: iso(hoy()),
  mes: (() => { const d = hoy(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  cambioModo: false,
  editando: false,     // subpágina Editar rutina
  diaEdit: DIAS_SEMANA[hoy().getDay()],
  semDesde: null,      // lo mismo para el selector de día de Editar rutina
  anchoModo: 0         // ancho previo del botón de vista, para el resorte
};
const RESORTE = 'linear(0,.009,.035 2.1%,.141 4.4%,.723 12.9%,.938 16.7%,1.017 20.5%,1.043 24.8%,1.035 28.4%,1 39.7%,.993 47.3%,1)';
function leer(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
function fijar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const nombreDia = k => DIAS[DIAS_SEMANA.indexOf(k)];

/* vista: 'rutina' (el día y Editar rutina) o 'resumen' (el mes). */
export function render(ctx, vista) {
  if (vista === 'resumen') return `<div class="rutina">${resumen(ctx)}</div>`;
  return `<div class="rutina">${ui.editando ? editar(ctx) : dia(ctx)}</div>`;
}
/* En Editar rutina la barra de secciones se esconde. */
export const ocultaBarra = vista => vista === 'rutina' && ui.editando;
/* Desde el calendario del Resumen: ir a la rutina de ese día. */
export function verDia(f) { ui.fecha = f; ui.editando = false; }

function etiquetaDia(f) {
  const d = desdeIso(f), n = Math.round((d - hoy()) / 864e5);
  if (n === 0) return 'Rutina de hoy';
  if (n === -1) return 'Rutina de ayer';
  if (n === 1) return 'Rutina de mañana';
  return `${cap(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/* ---------- el día: cada actividad es un botón; hecha = pulsado ---------- */
function dia({ store }) {
  const d = desdeIso(ui.fecha), clave = DIAS_SEMANA[d.getDay()];
  const lista = store.state.actividades.filter(a => a.dia === clave);
  const hechos = new Set(store.state.registros.filter(r => r.fecha === ui.fecha && r.hecho).map(r => r.actividadId));
  const futuro = ui.fecha > iso(hoy()), esHoy = ui.fecha === iso(hoy());
  const perf = ui.modo !== 'critica', etiquetaModo = perf ? 'Performance' : 'Línea Crítica';
  const animar = ui.cambioModo; ui.cambioModo = false;
  const cab = `<div class="r-head st"><h1>${etiquetaDia(ui.fecha)}</h1><button class="btn sm glass" data-editar>Editar rutina</button></div>
    <div class="r-tools st" style="--i:1">
      <button class="btn sm glass modo${perf ? ' perf' : ''}" data-modo aria-label="Vista: ${etiquetaModo}. Cambiar a ${perf ? 'Línea Crítica' : 'Performance'}"><span class="${animar ? 'swap' : ''}">${etiquetaModo}</span></button>
      <div class="daynav"><button class="icon" data-dia="-1" aria-label="Día anterior"><svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg></button><button class="icon" data-dia="1" aria-label="Día siguiente"><svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg></button></div>
    </div>`;
  if (!lista.length) return cab + '<p class="empty st" style="--i:2">Este día no tiene actividades. Arma tu semana con Editar rutina.</p>';

  const filas = filasDelDia(lista).filter(f => perf || (f.k === 'act' && f.a.core));
  const html = filas.map(f => {
    if (f.k === 'tray') return `<li class="bk tray"><span class="bk-n">${f.nombre}</span><time>${horas(f.m)}</time></li>`;
    const a = f.a, t = TIPOS[a.tipo] || TIPOS.tarea, tol = [];
    if (Number(a.tolA)) tol.push(`${a.tolA} min antes`); if (Number(a.tolD)) tol.push(`${a.tolD} min después`);
    const rEj = a.tipo === 'ejercicio' ? rutinaEj(a.ejercicioId) : null;
    const boton = a.tipo === 'ejercicio' && esHoy ? botonEjercicio(a) : '';
    return `<li${boton ? ' class="con-ej"' : ''}><button class="bk act ${a.core ? 'core' : 'opt'}" data-reg="${esc(a.id)}" aria-pressed="${hechos.has(a.id)}" ${futuro ? 'disabled' : ''} style="--c:${t.color};--t:${t.tinta}">
      <span class="bk-n">${esc(a.nombre)}${tol.length ? `<small>Tolerancia ${tol.join(', ')}</small>` : ''}${rEj ? `<small>${esc(rEj.nombre)}</small>` : ''}</span>
      <time>${reloj(f.ini)}<br>${reloj(f.ini + f.m)}</time></button>${boton}</li>`;
  }).join('');
  if (!html) return cab + '<p class="empty st" style="--i:2">Este día no tiene actividades en tu Línea Crítica. Márcalas en Editar rutina.</p>';
  return cab + `<ul class="blocks st" style="--i:2">${html}</ul>`;
}

/* Empezar (o Continuar) la rutina de ejercicio ligada a la actividad. */
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
function botonEjercicio(a) {
  const curso = ejercicio.enCurso(), sigue = curso && (!a.ejercicioId || curso === a.ejercicioId);
  return `<button class="ej-go" data-ej-go="${esc(a.id)}">${PLAY}${sigue ? 'Continuar' : 'Empezar'}</button>`;
}

/* ---------- Editar rutina: semana tipo ---------- */
function editar({ store }) {
  const lista = store.state.actividades.filter(a => a.dia === ui.diaEdit);
  const info = analizar(lista), tot = info.tot;
  const semana = SEMANA.map(k => {
    const u = analizar(store.state.actividades.filter(a => a.dia === k)).util;
    return `<button data-edia="${k}" aria-pressed="${k === ui.diaEdit}" aria-label="${cap(nombreDia(k))}: ${horas(u)} útiles"><b>${cap(nombreDia(k).slice(0, 3))}</b><small>${Math.floor(u / 60)}h${u % 60 ? String(u % 60).padStart(2, '0') : ''}</small></button>`;
  }).join('');
  const partes = [`${horas(tot.sueno)} de sueño`];
  if (tot.trabajo) partes.push(`${horas(tot.trabajo)} de trabajo`);
  if (tot.tray) partes.push(`${horas(tot.tray)} de trayecto`);
  if (tot.comida) partes.push(`${horas(tot.comida)} de comidas`);
  /* Barra de 24 h agrupada: cada tipo junta sus minutos, de mayor a menor; lo libre al final */
  const grupos = Object.keys(TIPOS).filter(k => tot[k]).map(k => ({ m: tot[k], l: TIPOS[k].l, c: TIPOS[k].color }))
    .concat(tot.tray ? [{ m: tot.tray, l: 'Trayecto', c: 'var(--ink3)' }] : [], tot.tol ? [{ m: tot.tol, l: 'Tolerancia', c: 'var(--line2)' }] : [])
    .sort((x, y) => y.m - x.m)
    .concat(tot.libre ? [{ m: tot.libre, l: 'Sin asignar', c: 'var(--field-hi)', libre: true }] : []);
  const barra24 = grupos.map(g => `<i style="flex:${g.m};background:${g.c}" title="${esc(g.l)}: ${horas(g.m)}"></i>`).join('');
  const leyenda = grupos.map(g => `<li${g.libre ? ' class="libre"' : ''}><i style="background:${g.c}"></i>${esc(g.l)} <b>${horas(g.m)}</b></li>`).join('');
  const nEmp = Object.keys(info.empalmes).length, nCore = lista.filter(a => a.core).length;

  const filas = info.filas.map(f => {
    if (f.k === 'gap') return f.m < 5 ? '' : `<li><button class="bk gap" data-hueco="${f.ini}" data-len="${f.m}"><span class="bk-n">Libre · ${horas(f.m)}<small>Agregar aquí</small></span><time>${reloj(f.ini)}<br>${reloj(f.ini + f.m)}</time></button></li>`;
    if (f.k === 'tray') return `<li class="bk tray"><span class="bk-n">${f.nombre}</span><time>${horas(f.m)}</time></li>`;
    const a = f.a, t = TIPOS[a.tipo] || TIPOS.tarea, emp = info.empalmes[a.id], tol = [];
    if (Number(a.tolA)) tol.push(`${a.tolA} min antes`); if (Number(a.tolD)) tol.push(`${a.tolD} min después`);
    return `<li><button class="bk act edit ${a.core ? 'core' : 'opt'}${emp ? ' choca' : ''}" data-act="${esc(a.id)}" style="--c:${t.color};--t:${t.tinta}" aria-label="Editar ${esc(a.nombre)}">
      <span class="bk-n">${esc(a.nombre)}<small>${t.l}${a.core ? ' · Línea Crítica' : ''}${tol.length ? ' · tolerancia ' + tol.join(', ') : ''}</small>${emp ? `<small class="warn">Se empalma con ${esc(emp.join(', '))}</small>` : ''}</span>
      <time>${reloj(f.ini)}<br>${reloj(f.ini + f.m)}</time></button></li>`;
  }).join('');

  return `<div class="e-head st"><button class="c-btn glass" data-volver aria-label="Volver a la rutina" title="Volver"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h1>Editar rutina</h1></div>
    <div class="semana st" style="--i:1" role="group" aria-label="Día de la semana">${semana}</div>
    <section class="sec st" style="--i:2">
      <span class="h">${cap(nombreDia(ui.diaEdit))}</span>
      <p class="eq">24 h − ${partes.join(' − ')} = <b>${horas(info.util)} útiles</b></p>
      <div class="bar24" aria-hidden="true">${barra24}</div>
      <ul class="leyenda">${leyenda}</ul>
      ${nEmp ? `<p class="warn-msg" role="status">${nEmp} actividades se empalman. Mueve la hora o reduce tolerancias.</p>` : ''}
      <div class="e-tools">
        <button class="btn sm glass" data-nueva>Agregar actividad</button>
        <button class="btn sm glass" data-copiar aria-haspopup="listbox" aria-expanded="false">Copiar otro día<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></button>
      </div>
      <p class="note">${lista.length ? `${nCore} de ${lista.length} están en tu Línea Crítica. Toca una actividad para editarla, o un espacio libre para agregar ahí.` : 'Este día está vacío. Agrega una actividad o copia la rutina de otro día.'}</p>
    </section>
    <ol class="blocks st" style="--i:3">${filas}</ol>`;
}

function abrirActividad(ctx, id, base = {}) {
  const previo = id ? ctx.store.buscar('actividades', id) : null;
  if (id && !previo) return;
  const a = previo ? { ...previo } : { id: uid(), dia: ui.diaEdit, nombre: '', inicio: '09:00', dur: 60, tipo: 'tarea', tolA: 0, tolD: 0, ida: 0, vuelta: 0, core: false, ejercicioId: '', ...base };
  const tray = Number(a.ida) > 0 || Number(a.vuelta) > 0;
  const num = (n, l, v, extra = '') => `<div class="field"><label for="a-${n}">${l}</label><input class="inp" id="a-${n}" name="${n}" type="number" inputmode="numeric" min="0" step="5" value="${Number(v) || 0}" ${extra}></div>`;
  ctx.abrirHoja(`<form id="f-act" novalidate>
      <input class="sh-title" name="nombre" value="${esc(a.nombre)}" placeholder="Nombre de la actividad" autocomplete="off" ${previo ? '' : 'autofocus'} aria-label="Actividad">
      <div class="field"><span class="lbl" id="a-tipo-l">Tipo</span><button type="button" class="t-sel" id="a-tipo" data-valor="${esc(TIPOS[a.tipo] ? a.tipo : 'tarea')}" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="a-tipo-l a-tipo"></button></div>
      <div class="field" id="a-ejf" ${a.tipo === 'ejercicio' ? '' : 'hidden'}><span class="lbl" id="a-ej-l">Rutina de ejercicio</span><button type="button" class="t-sel" id="a-ej" data-valor="${esc(a.ejercicioId || '')}" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="a-ej-l a-ej"></button></div>
      <div class="cols">
        <div class="field"><label for="a-inicio">Hora de inicio</label><input class="inp" id="a-inicio" name="inicio" type="time" value="${esc(a.inicio)}"></div>
        <div class="field"><label for="a-fin">Hora de término</label><input class="inp" id="a-fin" name="fin" type="time" value="${reloj(aMin(a.inicio) + (Number(a.dur) || 60))}"></div>
        ${num('tolA', 'Tolerancia antes, min', a.tolA)}
        ${num('tolD', 'Tolerancia después, min', a.tolD)}
      </div>
      <div class="sw-row"><span>Línea Crítica<small>Aparece cuando cambias a la vista Línea Crítica</small></span><button type="button" class="sw" id="a-core" role="switch" aria-checked="${!!a.core}" aria-label="Línea Crítica"></button></div>
      <div class="sw-row"><span>Trayecto<small>Tiempo para llegar y para regresar</small></span><button type="button" class="sw" id="a-tray" role="switch" aria-checked="${tray}" aria-label="Trayecto"></button></div>
      <div class="cols" id="a-trayf" ${tray ? '' : 'hidden'}>${num('ida', 'Ida, min', a.ida)}${num('vuelta', 'Vuelta, min', a.vuelta)}</div>
      ${pieHoja(!!previo)}
    </form>
    <div class="t-editor" id="t-editor" hidden></div>`, {
    montar: s => {
      const f = s.querySelector('#f-act'), sel = s.querySelector('#a-tipo');
      const pintarSel = () => {
        if (!TIPOS[sel.dataset.valor]) sel.dataset.valor = 'tarea';
        const t = TIPOS[sel.dataset.valor];
        sel.innerHTML = `<i style="background:${t.color}"></i><span>${esc(t.l)}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>`;
      };
      pintarSel();
      sel.onclick = () => desplegable(sel, [
        ...listaTipos().map(t => ({ v: t.k, actual: t.k === sel.dataset.valor, html: `<i class="dot" style="background:${t.color}"></i>${esc(t.l)}` })),
        { v: '__editar', sep: true, html: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13H3v-3z"/></svg>Editar tipos…' }
      ], v => {
        if (v !== '__editar') { sel.dataset.valor = v; pintarSel(); s.querySelector('#a-ejf').hidden = v !== 'ejercicio'; return; }
        editorTipos(ctx, s, () => { f.hidden = false; s.querySelector('#t-editor').hidden = true; pintarSel(); sel.focus(); });
        f.hidden = true;
      });
      /* Rutina de ejercicio que abre el botón Empezar de esta actividad */
      const ej = s.querySelector('#a-ej');
      const pintarEj = () => {
        const r = rutinaEj(ej.dataset.valor);
        ej.innerHTML = `<span>${r ? esc(r.nombre) : 'Elegir al empezar'}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>`;
      };
      pintarEj();
      ej.onclick = () => desplegable(ej, [{ v: '', actual: !ej.dataset.valor, html: 'Elegir al empezar' }, ...RUTINAS.map(r => ({ v: r.id, actual: r.id === ej.dataset.valor, html: esc(r.nombre) }))], v => { ej.dataset.valor = v; pintarEj(); });
      const sw = b => b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true');
      s.querySelector('#a-core').onclick = e => sw(e.currentTarget);
      s.querySelector('#a-tray').onclick = e => { sw(e.currentTarget); s.querySelector('#a-trayf').hidden = e.currentTarget.getAttribute('aria-checked') !== 'true'; };
      f.onsubmit = e => { e.preventDefault(); ctx.cerrarHoja(); };
      const borrar = s.querySelector('[data-borrar]');
      if (borrar) borrar.onclick = () => {
        a.__borrado = true; ctx.store.borrar('actividades', a.id); ctx.cerrarHoja();
        ctx.toast('Actividad eliminada', () => ctx.store.guardar('actividades', previo));
      };
      s.__leer = () => {
        const n = k => Math.max(0, parseInt(f[k].value, 10) || 0), conTray = s.querySelector('#a-tray').getAttribute('aria-checked') === 'true';
        return {
          ...a, nombre: f.nombre.value.trim(), inicio: f.inicio.value || a.inicio,
          tipo: TIPOS[sel.dataset.valor] ? sel.dataset.valor : 'tarea',
          dur: Math.max(5, (aMin(f.fin.value || reloj(aMin(f.inicio.value || a.inicio) + (Number(a.dur) || 60))) - aMin(f.inicio.value || a.inicio) + 1440) % 1440), tolA: n('tolA'), tolD: n('tolD'),
          ida: conTray ? n('ida') : 0, vuelta: conTray ? n('vuelta') : 0,
          core: s.querySelector('#a-core').getAttribute('aria-checked') === 'true',
          ejercicioId: sel.dataset.valor === 'ejercicio' ? ej.dataset.valor : ''
        };
      };
    },
    cerrar: s => {
      if (a.__borrado || !s.__leer) return;
      const n = s.__leer();
      if (!n.nombre) { if (previo) ctx.toast('La actividad necesita un nombre; se conservó la anterior.'); return; }
      const clave = x => JSON.stringify(['nombre', 'inicio', 'dur', 'tipo', 'tolA', 'tolD', 'ida', 'vuelta', 'core', 'ejercicioId'].map(k => k === 'core' ? !!x[k] : String(x[k] ?? '')));
      if (!previo || clave(n) !== clave(previo)) ctx.store.guardar('actividades', n);
    }
  });
}

/* Editor de tipos dentro de la misma hoja: nombre, color, agregar y eliminar.
   Trabaja sobre un borrador: solo se guarda al tocar la palomita; volver descarta los cambios.
   Al guardar, las actividades de los tipos eliminados pasan a Tarea. */
function guardarTipos(ctx, lista) {
  ctx.store.guardar('config', { id: 'tipos', valor: JSON.stringify(lista) });
  cargarTipos({ config: [{ id: 'tipos', valor: JSON.stringify(lista) }] });
}
function editorTipos(ctx, s, volver) {
  const caja = s.querySelector('#t-editor');
  let borrador = listaTipos();
  const borrados = new Set();
  const usos = k => ctx.store.state.actividades.filter(a => a.tipo === k).length;
  const BASURA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.2 6.5l.9 12.6c.1 1 .9 1.9 2 1.9h5.8c1 0 1.9-.8 2-1.9l.9-12.6M10.2 10.5v6.5M13.8 10.5v6.5"/></svg>';
  const pintar = () => {
    caja.innerHTML = `<div class="sh-bar"><button type="button" class="c-btn glass" data-t-volver aria-label="Volver sin guardar" title="Volver sin guardar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h2 class="sh-h">Tipos</h2><button type="button" class="c-btn ok" data-t-ok aria-label="Guardar tipos" title="Guardar tipos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button></div>
      <p class="note">Cambia el nombre o el color, agrega o elimina tipos y toca la palomita para guardar. Al eliminar un tipo, sus actividades pasan a Tarea.</p>
      <ul class="t-lista">${borrador.map(t => `<li data-k="${t.k}">
        <label class="t-color" style="--c:${t.color}" title="Color"><input type="color" value="${t.color}" aria-label="Color de ${esc(t.l)}"></label>
        <input class="inp" value="${esc(t.l)}" maxlength="24" aria-label="Nombre del tipo">
        ${PROTEGIDOS.includes(t.k) ? '<span class="t-fijo" title="Este tipo no se puede eliminar"></span>' : `<button type="button" class="c-btn glass del" data-t-borrar aria-label="Eliminar ${esc(t.l)}${usos(t.k) ? ` (${usos(t.k)} actividades)` : ''}" title="Eliminar">${BASURA}</button>`}
      </li>`).join('')}</ul>
      <button type="button" class="btn sm glass" data-t-nuevo>Agregar tipo</button>`;
  };
  const tipoDe = el => borrador.find(t => t.k === el.closest('[data-k]').dataset.k);
  caja.oninput = e => {
    const li = e.target.closest('[data-k]'); if (!li) return;
    if (e.target.type === 'color') { tipoDe(e.target).color = e.target.value; li.querySelector('.t-color').style.setProperty('--c', e.target.value); }
    else if (e.target.classList.contains('inp')) tipoDe(e.target).l = e.target.value;
  };
  caja.onchange = null;
  caja.onclick = e => {
    if (e.target.closest('[data-t-volver]')) { volver(); return; }
    if (e.target.closest('[data-t-ok]')) {
      const lista = borrador.map(t => ({ ...t, l: t.l.trim() || (TIPOS[t.k] ? TIPOS[t.k].l : 'Sin nombre') }));
      ctx.store.state.actividades.filter(a => borrados.has(a.tipo)).forEach(a => ctx.store.guardar('actividades', { ...a, tipo: 'tarea' }));
      guardarTipos(ctx, lista);
      volver();
      ctx.toast('Tipos guardados');
      return;
    }
    if (e.target.closest('[data-t-nuevo]')) {
      const k = 't' + uid().slice(0, 8);
      borrador.push({ k, l: 'Nuevo tipo', color: '#9ad0f5' });
      pintar();
      const inp = caja.querySelector(`[data-k="${k}"] .inp`); inp.focus(); inp.select();
      return;
    }
    const b = e.target.closest('[data-t-borrar]');
    if (b) {
      const k = b.closest('[data-k]').dataset.k, n = usos(k);
      if (n && !confirm(`${n === 1 ? 'Una actividad usa' : n + ' actividades usan'} este tipo y ${n === 1 ? 'pasará' : 'pasarán'} a Tarea al guardar. ¿Eliminarlo?`)) return;
      borrados.add(k);
      borrador = borrador.filter(t => t.k !== k);
      pintar();
    }
  };
  pintar();
  caja.hidden = false;
  const sc = s.querySelector('.sh-scroll'); if (sc) sc.scrollTop = 0;
  caja.querySelector('[data-t-volver]').focus({ preventScroll: true });
}

function copiarDia(ctx, desde) {
  const s = ctx.store.state, actuales = s.actividades.filter(a => a.dia === ui.diaEdit);
  const fuente = s.actividades.filter(a => a.dia === desde);
  if (!fuente.length) { ctx.toast(`El ${nombreDia(desde)} no tiene actividades.`); return; }
  if (actuales.length && !confirm(`Esto reemplaza el ${nombreDia(ui.diaEdit)} con la rutina del ${nombreDia(desde)}. ¿Continuar?`)) return;
  actuales.forEach(a => ctx.store.borrar('actividades', a.id));
  fuente.forEach(a => ctx.store.guardar('actividades', { ...a, id: uid(), dia: ui.diaEdit }));
  ctx.toast(`Se copió la rutina del ${nombreDia(desde)}.`);
}

/* ---------- interacción ---------- */
export function montar(view, ctx) {
  const g = view.querySelector('.graph');
  if (g) { const h = g.querySelector('.cg.hoy'); g.scrollLeft = h ? h.offsetLeft - g.clientWidth / 2 : g.scrollWidth; }
  resorteModo(view); gelSemana(view);
  view.addEventListener('click', e => {
    const go = e.target.closest('[data-ej-go]');
    if (go) {
      const a = ctx.store.buscar('actividades', go.dataset.ejGo); if (!a) return;
      const curso = ejercicio.enCurso();
      if (curso && (!a.ejercicioId || curso === a.ejercicioId)) { ejercicio.continuar(ctx); return; }
      if (rutinaEj(a.ejercicioId)) { ejercicio.empezar(ctx, a.ejercicioId); return; }
      desplegable(go, RUTINAS.map(r => ({ v: r.id, html: esc(r.nombre) })), id => ejercicio.empezar(ctx, id));
      return;
    }
    if (e.target.closest('[data-volver]')) { ui.editando = false; ctx.render(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-editar]')) { ui.editando = true; ui.diaEdit = DIAS_SEMANA[desdeIso(ui.fecha).getDay()]; ctx.render(); window.scrollTo(0, 0); return; }
    const ed = e.target.closest('[data-edia]');
    if (ed) {
      if (ed.dataset.edia === ui.diaEdit) return;
      const actual = view.querySelector('.semana [aria-pressed="true"]');
      ui.semDesde = actual ? { x: actual.offsetLeft, w: actual.offsetWidth } : null;
      ui.diaEdit = ed.dataset.edia; ctx.render(); return;
    }
    const cp = e.target.closest('[data-copiar]');
    if (cp) {
      desplegable(cp, SEMANA.filter(k => k !== ui.diaEdit).map(k => {
        const n = ctx.store.state.actividades.filter(a => a.dia === k).length;
        return { v: k, html: `${cap(nombreDia(k))}<small>${n ? n + (n === 1 ? ' actividad' : ' actividades') : 'vacío'}</small>` };
      }), k => copiarDia(ctx, k));
      return;
    }
    if (e.target.closest('[data-nueva]')) { abrirActividad(ctx, null); return; }
    const hu = e.target.closest('[data-hueco]');
    if (hu) { abrirActividad(ctx, null, { inicio: reloj(Number(hu.dataset.hueco)), dur: Math.min(60, Number(hu.dataset.len)) }); return; }
    const ac = e.target.closest('[data-act]');
    if (ac) { abrirActividad(ctx, ac.dataset.act); return; }

    const bm = e.target.closest('[data-modo]');
    if (bm) { ui.anchoModo = bm.offsetWidth; ui.modo = ui.modo === 'critica' ? 'performance' : 'critica'; ui.cambioModo = true; fijar('enzo-rutina-modo', ui.modo); ctx.render(); return; }
    const mm = e.target.closest('[data-mes]');
    if (mm) { ui.mes = new Date(ui.mes.getFullYear(), ui.mes.getMonth() + Number(mm.dataset.mes), 1); ctx.render(); return; }
    const k = e.target.closest('[data-ir]');
    if (k) { verDia(k.dataset.ir); ctx.ir('today', 'rutina'); return; }
    const n = e.target.closest('[data-dia]');
    if (n) { const d = desdeIso(ui.fecha); d.setDate(d.getDate() + Number(n.dataset.dia)); ui.fecha = iso(d); ctx.render(); return; }
    const r = e.target.closest('[data-reg]');
    if (r && !r.disabled) {
      const a = ctx.store.buscar('actividades', r.dataset.reg); if (!a) return;
      const id = ui.fecha + '|' + a.id, previo = ctx.store.buscar('registros', id);
      ctx.store.guardar('registros', { id, fecha: ui.fecha, actividadId: a.id, nombre: a.nombre, tipo: a.tipo, core: !!a.core, hecho: !(previo && previo.hecho) });
    }
  });
}

/* El selector de día también desliza su selección con efecto de gel. */
function gelSemana(view) {
  const desde = ui.semDesde; ui.semDesde = null;
  const sem = view.querySelector('.semana'), b = sem && sem.querySelector('[aria-pressed="true"]');
  if (!desde || !b || reduceMotion()) return;
  const x = b.offsetLeft, w = b.offsetWidth, a = Math.min(desde.x, x), z = Math.max(desde.x + desde.w, x + w);
  const sel = document.createElement('span'); sel.className = 'ssel';
  sem.prepend(sel); sem.classList.add('moviendo');
  const an = sel.animate([
    { left: desde.x + 'px', width: desde.w + 'px' },
    { left: a + 'px', width: (z - a) * .82 + 'px', offset: .45 },
    { left: x + 'px', width: w + 'px' }
  ], { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
  const fin = () => { sem.classList.remove('moviendo'); sel.remove(); };
  an.onfinish = an.oncancel = fin; setTimeout(fin, 480);
}

/* Al cambiar Performance ↔ Línea Crítica, el botón ajusta su ancho con resorte. */
function resorteModo(view) {
  const antes = ui.anchoModo; ui.anchoModo = 0;
  const b = view.querySelector('[data-modo]');
  if (!antes || !b || reduceMotion()) return;
  const despues = b.offsetWidth;
  if (antes !== despues) b.animate([{ width: antes + 'px' }, { width: despues + 'px' }], { duration: 420, easing: RESORTE });
}

/* ---------- Resumen del mes: Contribution graph del año, calendario y heatmap por tipo ---------- */
function indice(s) {
  const porFecha = new Map();
  s.registros.forEach(r => { if (!r.hecho) return; if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, new Set()); porFecha.get(r.fecha).add(r.actividadId); });
  return porFecha;
}
function puntaje(s, idx, f) {
  const acts = s.actividades.filter(a => a.dia === DIAS_SEMANA[desdeIso(f).getDay()]);
  const hechos = idx.get(f);
  if (!acts.length || !hechos) return null;
  const n = acts.filter(a => hechos.has(a.id)).length;
  if (!n) return null;
  const core = acts.filter(a => a.core);
  return { pct: Math.round(n / acts.length * 100), crit: core.length > 0 && core.every(a => hechos.has(a.id)), acts, hechos };
}
const nivel = p => p == null ? 0 : p >= 100 ? 4 : p >= 70 ? 3 : p >= 40 ? 2 : 1;
const MES3 = MESES.map(m => m.slice(0, 3));

function resumen({ store }) {
  const s = store.state, idx = indice(s), h = hoy(), hIso = iso(h);
  const y = ui.mes.getFullYear(), m = ui.mes.getMonth(), n = new Date(y, m + 1, 0).getDate();
  const esActual = y === h.getFullYear() && m === h.getMonth();

  /* Contribution graph: todo el año del mes que estás viendo, de enero a diciembre */
  const ene1 = new Date(y, 0, 1), dic31 = new Date(y, 11, 31);
  const inicio = new Date(ene1); inicio.setDate(ene1.getDate() - ((ene1.getDay() + 6) % 7));
  const semanas = Math.ceil((Math.round((dic31 - inicio) / 864e5) + 1) / 7);
  let celdas = '', meses = '';
  for (let w = 0; w < semanas; w++) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + w * 7 + i); const f = iso(d);
      if (d.getDate() === 1 && d.getFullYear() === y) meses += `<span style="grid-column:${w + 1}">${MES3[d.getMonth()]}</span>`;
      if (d.getFullYear() !== y) { celdas += '<i class="cg out"></i>'; continue; }
      if (d > h) { celdas += '<i class="cg fut"></i>'; continue; }
      const p = puntaje(s, idx, f), txt = `${d.getDate()} ${MES3[d.getMonth()]}: ${p ? p.pct + ' %' : 'sin registro'}`;
      celdas += `<button class="cg l${nivel(p && p.pct)}${p && p.crit ? ' crit' : ''}${f === hIso ? ' hoy' : ''}" data-ir="${f}" title="${txt}" aria-label="${txt}"></button>`;
    }
  }

  /* Calendario del mes */
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  let cal = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span class="c-dow">${d}</span>`).join('') + '<span></span>'.repeat(offset);
  let suma = 0, cuenta = 0, crit = 0;
  for (let i = 1; i <= n; i++) {
    const d = new Date(y, m, i), f = iso(d);
    if (d > h) { cal += `<span class="c-day fut"><b>${i}</b></span>`; continue; }
    const p = puntaje(s, idx, f);
    if (p) { suma += p.pct; cuenta++; if (p.crit) crit++; }
    cal += `<button class="c-day l${nivel(p && p.pct)}${f === hIso ? ' hoy' : ''}" data-ir="${f}" aria-label="${i} de ${MESES[m]}: ${p ? p.pct + ' %' : 'sin registro'}"><b>${i}</b>${p ? `<small>${p.pct}%</small>` : ''}${p && p.crit ? '<i class="c-crit" aria-hidden="true"></i>' : ''}</button>`;
  }

  /* Heatmap por tipo */
  const usados = Object.keys(TIPOS).filter(t => s.actividades.some(a => a.tipo === t));
  const tipos = usados.length ? usados : Object.keys(TIPOS);   // sin rutina aún: todos los tipos, vacíos
  let heat = `<span></span>${Array.from({ length: n }, (_, i) => `<span class="h-d">${i + 1}</span>`).join('')}`;
  tipos.forEach(t => {
    heat += `<span class="h-l"><i style="background:${TIPOS[t].color}"></i>${TIPOS[t].l}</span>`;
    for (let i = 1; i <= n; i++) {
      const d = new Date(y, m, i), f = iso(d);
      if (d > h) { heat += '<i class="h-c fut"></i>'; continue; }
      const p = puntaje(s, idx, f), de = p ? p.acts.filter(a => a.tipo === t) : [];
      if (!de.length) { heat += '<i class="h-c"></i>'; continue; }
      const pct = Math.round(de.filter(a => p.hechos.has(a.id)).length / de.length * 100);
      heat += `<i class="h-c ${pct === 0 ? 'lz' : 'l' + nivel(pct)}" title="${TIPOS[t].l}, ${i} ${MES3[m]}: ${pct} %"></i>`;
    }
  });

  const resumenTxt = cuenta ? `Promedio de Performance: <b>${Math.round(suma / cuenta)} %</b> en ${cuenta} ${cuenta === 1 ? 'día' : 'días'} · Línea Crítica cumplida ${crit} ${crit === 1 ? 'vez' : 'veces'}` : 'Sin registros este mes.';
  return `<div class="r-head st"><h1>${cap(MESES[m])} ${y}</h1>
      <div class="daynav"><button class="icon" data-mes="-1" aria-label="Mes anterior"><svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg></button><button class="icon" data-mes="1" ${esActual ? 'disabled' : ''} aria-label="Mes siguiente"><svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg></button></div></div>
    <p class="r-sum st" style="--i:1">${resumenTxt}</p>
    <section class="sec st" style="--i:2"><span class="h">Contribution graph · ${y}</span>
      <div class="graph" style="--w:${semanas}"><div class="g-meses" aria-hidden="true">${meses}</div><div class="g-cells">${celdas}</div></div>
      <div class="escala" aria-hidden="true"><span>Menos</span><i class="cg l0"></i><i class="cg l1"></i><i class="cg l2"></i><i class="cg l3"></i><i class="cg l4"></i><span>Más</span><i class="cg l2 crit"></i><span>Línea Crítica</span></div></section>
    <section class="sec st" style="--i:3"><span class="h">Calendario</span><div class="cal">${cal}</div></section>
    <section class="sec st" style="--i:4"><span class="h">Heatmap por tipo</span><div class="heatwrap"><div class="heat" style="--n:${n}">${heat}</div></div>${usados.length ? '' : '<p class="note" style="margin-top:8px">Se llena cuando tu rutina tenga actividades y las marques como hechas.</p>'}</section>
    <section class="sec st" style="--i:5"><span class="h">Ejercicio</span>${ejercicio.resumenMes(s.sesiones, y, m)}</section>`;
}
