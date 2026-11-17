/* Buscador tipo Spotlight (como el del task manager).
   Una barra en píldora y, a un lado (Mac) o debajo (celular), las categorías: Pendientes, Proyectos, Notas y Presupuesto.
   Sin categoría busca en todo; con una, aparecen sus filtros en píldoras. Flechas para moverte, Enter para abrir. */
import { esc, fechaCorta, MESES, cap } from './util.js';
import { desplegable } from './desplegable.js';
import { activos, nombreDe } from './pages/proyectos.js';
import { dinero } from './pages/presupuesto.js';

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const textoDe = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const IC = {
  lupa: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M13.5 13.5L17 17"/></svg>',
  pendiente: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>',
  proyecto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  nota: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/></svg>',
  partida: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.2c-.5-.8-1.5-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.5-2.7-1.3M12 6.5v11"/></svg>',
  chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
  x: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  alterna: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13"/></svg>'
};
const CATS = [['pendiente', 'Pendientes'], ['proyecto', 'Proyectos'], ['nota', 'Notas'], ['partida', 'Presupuesto']];
const ESTADO_P = { activo: 'Activo', pausa: 'En pausa', terminado: 'Terminado' };
const nombreMes = k => { const [y, m] = String(k).split('-').map(Number); return y && m ? `${cap(MESES[m - 1])} ${y}` : ''; };

/* ---------- resultados ---------- */
function resultados(s, q, F) {
  const t = norm(q).trim(), hit = (...xs) => !t || xs.some(x => norm(x).includes(t)), want = k => !F.kind || F.kind === k, out = [];
  if (want('pendiente')) s.pendientes.forEach(p => {
    const hecha = p.estado === 'hecho';
    if ((F.st === 'abiertas' && hecha) || (F.st === 'hechas' && !hecha) || (F.pid && p.proyectoId !== F.pid)) return;
    const pr = p.proyectoId ? nombreDe(s, p.proyectoId) : '';
    if (hit(p.titulo, p.notas, pr)) out.push({ k: 'pendiente', id: p.id, titulo: p.titulo, meta: `${hecha ? 'Hecho' : 'Pendiente'}${p.fecha ? ' · ' + fechaCorta(p.fecha) : ''}${pr ? ' · ' + pr : ''}`, dim: hecha, rank: hecha ? 3 : 0, orden: p.fecha || '9' });
  });
  if (want('proyecto')) s.proyectos.forEach(p => {
    if ((F.tipo && p.tipo !== F.tipo) || (F.est && p.estado !== F.est)) return;
    if (hit(p.nombre, p.descripcion)) out.push({ k: 'proyecto', id: p.id, titulo: p.nombre, meta: `Proyecto ${p.tipo === 'exploratorio' ? 'exploratorio' : 'delimitado'} · ${ESTADO_P[p.estado] || 'Activo'}`, dim: p.estado !== 'activo', rank: p.estado === 'activo' ? 1 : 3, orden: '' });
  });
  if (want('nota')) s.notas.forEach(n => {
    if (F.pid && n.proyectoId !== F.pid) return;
    const pr = n.proyectoId ? nombreDe(s, n.proyectoId) : '', tx = textoDe(n.cuerpo);
    if (hit(n.titulo, tx, pr)) out.push({ k: 'nota', id: n.id, titulo: n.titulo || 'Sin título', meta: `Nota${pr ? ' · ' + pr : ''}${tx ? ' · ' + tx.slice(0, 60) : ''}`, rank: 2, orden: String(-(Number(n.actualizado) || 0)) });
  });
  if (want('partida')) s.partidas.forEach(p => {
    if (F.tp && p.tipo !== F.tp) return;
    if (hit(p.nombre, nombreMes(p.mes))) out.push({ k: 'partida', id: p.id, titulo: p.nombre, meta: `${p.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} · ${dinero(Number(p.monto) || 0)} · ${nombreMes(p.mes)}`, rank: 2, orden: String(9999 - Number(String(p.mes).replace('-', ''))) });
  });
  out.sort((a, b) => a.rank - b.rank || String(a.orden).localeCompare(String(b.orden)));
  if (F.kind) return out.slice(0, 30);
  const n = {}; return out.filter(x => (n[x.k] = (n[x.k] || 0) + 1) <= 5).slice(0, 16);   // en todo: unos cuantos de cada tipo
}

/* ---------- filtros de cada categoría ---------- */
function filtros(s, F) {
  let i = 0;
  const pill = (campo, v, label) => `<button type="button" class="sf" style="--i:${i++}" data-f="${campo}" data-v="${v}" aria-pressed="${F[campo] === v}">${label}</button>`;
  const proy = () => { const n = F.pid ? nombreDe(s, F.pid) : ''; return `<button type="button" class="sf" style="--i:${i++}" data-fproy aria-pressed="${!!F.pid}" aria-haspopup="listbox" aria-expanded="false">${n ? esc(n) + IC.x : 'Proyecto' + IC.chev}</button>`; };
  if (F.kind === 'pendiente') return pill('st', 'abiertas', 'Abiertos') + pill('st', 'hechas', 'Hechos') + proy();
  if (F.kind === 'proyecto') {
    /* Tipo: un solo botón que alterna Delimitados → Exploratorios → sin filtro. Estado: menú desplegable. */
    const tipo = F.tipo === 'delimitado' ? 'Delimitados' : F.tipo === 'exploratorio' ? 'Exploratorios' : 'Tipo';
    const est = { activo: 'Activos', pausa: 'En pausa', terminado: 'Terminados' }[F.est];
    return `<button type="button" class="sf" style="--i:${i++}" data-ftipo aria-pressed="${!!F.tipo}" title="Cambiar tipo">${tipo}${IC.alterna}</button>`
      + `<button type="button" class="sf" style="--i:${i++}" data-fest aria-pressed="${!!F.est}" aria-haspopup="listbox" aria-expanded="false">${est ? est + IC.x : 'Estado' + IC.chev}</button>`;
  }
  if (F.kind === 'nota') return proy();
  if (F.kind === 'partida') return pill('tp', 'ingreso', 'Ingresos') + pill('tp', 'gasto', 'Gastos');
  return '';
}

/* ---------- abrir ---------- */
export function abrirBuscador(ctx, al) {
  const F = { kind: '', st: '', pid: '', tipo: '', est: '', tp: '' };
  ctx.abrirHoja(`<div class="spot-row">
      <div class="spot-bar glass">${IC.lupa}<span class="spot-chip" id="sr-chip" hidden></span><input class="sr-input" id="sr-q" placeholder="Buscar…" aria-label="Buscar" autocomplete="off" autofocus enterkeyhint="search"></div>
      <div class="spot-cats" role="group" aria-label="Buscar en">${CATS.map((c, i) => `<button type="button" class="spot-cat glass" style="--i:${i}" data-kind="${c[0]}" aria-pressed="false" title="${c[1]}" aria-label="Buscar solo en ${c[1]}">${IC[c[0]]}<span>${c[1]}</span></button>`).join('')}</div>
    </div>
    <div class="spot-filters" id="sr-filtros" hidden></div>
    <div class="spot-panel glass tint" id="sr-panel" hidden><div class="sr-res" id="sr-res" role="listbox" aria-label="Resultados"></div></div>`, {
    clase: 'spot',
    montar: sh => {
      const q = sh.querySelector('#sr-q'), panel = sh.querySelector('#sr-panel'), res = sh.querySelector('#sr-res'), fila = sh.querySelector('#sr-filtros'), chip = sh.querySelector('#sr-chip');
      let sel = 0, lista = [];
      const pintar = (filtrosCambiaron) => {
        const s = ctx.store.state, cat = CATS.find(c => c[0] === F.kind);
        sh.querySelectorAll('.spot-cat').forEach(b => b.setAttribute('aria-pressed', b.dataset.kind === F.kind));
        chip.hidden = !cat; chip.textContent = cat ? cat[1] : '';
        q.placeholder = cat ? `Buscar en ${cat[1].toLowerCase()}…` : 'Buscar…';
        if (filtrosCambiaron) {
          const h = filtros(s, F), nuevo = fila.hidden || fila.dataset.kind !== F.kind;
          fila.hidden = !h; fila.innerHTML = h; fila.dataset.kind = F.kind;
          fila.classList.toggle('anim', nuevo && !matchMedia('(prefers-reduced-motion: reduce)').matches);
        }
        const activo = q.value.trim() || F.kind;
        if (!activo) { panel.hidden = true; lista = []; return; }
        lista = resultados(s, q.value, F);
        sel = Math.min(sel, Math.max(0, lista.length - 1));
        res.innerHTML = lista.length ? lista.map((x, i) => `<button class="sr-item${x.dim ? ' dim' : ''}${i === sel ? ' kb' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">
            <span class="sr-ic">${IC[x.k]}</span><span><b>${esc(x.titulo)}</b><small>${esc(x.meta)}</small></span></button>`).join('')
          : `<p class="sr-empty">Sin resultados${q.value.trim() ? ` para «${esc(q.value.trim())}»` : ''}.</p>`;
        panel.hidden = false;
      };
      const abrir = x => { ctx.cerrarHoja(); al(x); };
      q.addEventListener('input', () => { sel = 0; pintar(false); });
      /* Celular: la palomita de la barra del teclado quita el cursor del campo; si eso pasa sin haber tocado
         algo del buscador (categoría, filtro, resultado), el buscador se cierra. */
      let toqueDentro = 0;
      sh.addEventListener('pointerdown', () => { toqueDentro = Date.now(); }, true);
      q.addEventListener('blur', () => {
        if (!matchMedia('(pointer:coarse)').matches || matchMedia('(min-width:820px)').matches) return;
        setTimeout(() => {
          const enHoja = document.body.classList.contains('sheet-open') && sh.classList.contains('spot');
          if (!enHoja || sh.contains(document.activeElement) || document.querySelector('.dd') || Date.now() - toqueDentro < 600) return;
          ctx.cerrarHoja();
        }, 120);
      });
      q.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); if (!lista.length) return;
          sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length; pintar(false);
          res.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter' && lista[sel]) { e.preventDefault(); abrir(lista[sel]); }
        if (e.key === 'Backspace' && !q.value && F.kind) { F.kind = ''; limpiar(); pintar(true); }
      });
      const limpiar = () => { F.st = F.pid = F.tipo = F.est = F.tp = ''; sel = 0; };
      sh.addEventListener('click', e => {
        const c = e.target.closest('.spot-cat');
        if (c) {
          F.kind = F.kind === c.dataset.kind ? '' : c.dataset.kind; limpiar(); pintar(true); q.focus({ preventScroll: true });
          return;
        }
        const f = e.target.closest('[data-f]');
        if (f) { F[f.dataset.f] = F[f.dataset.f] === f.dataset.v ? '' : f.dataset.v; sel = 0; pintar(true); q.focus({ preventScroll: true }); return; }
        if (e.target.closest('[data-ftipo]')) {
          F.tipo = F.tipo === '' ? 'delimitado' : F.tipo === 'delimitado' ? 'exploratorio' : '';
          sel = 0; pintar(true); q.focus({ preventScroll: true }); return;
        }
        const fe = e.target.closest('[data-fest]');
        if (fe) {
          if (F.est) { F.est = ''; sel = 0; pintar(true); q.focus({ preventScroll: true }); return; }
          desplegable(fe, [['activo', 'Activos'], ['pausa', 'En pausa'], ['terminado', 'Terminados']].map(o => ({ v: o[0], html: o[1] })), v => { F.est = v; sel = 0; pintar(true); q.focus({ preventScroll: true }); });
          return;
        }
        const fp = e.target.closest('[data-fproy]');
        if (fp) {
          if (F.pid) { F.pid = ''; sel = 0; pintar(true); q.focus({ preventScroll: true }); return; }
          const s = ctx.store.state, ps = [...activos(s), ...s.proyectos.filter(p => p.estado !== 'activo')];
          if (!ps.length) { ctx.toast('Aún no tienes proyectos'); return; }
          desplegable(fp, ps.map(p => ({ v: p.id, html: `${esc(p.nombre)}${p.estado !== 'activo' ? `<small>${ESTADO_P[p.estado]}</small>` : ''}` })), v => { F.pid = v; sel = 0; pintar(true); q.focus({ preventScroll: true }); });
          return;
        }
        const it = e.target.closest('.sr-item');
        if (it && lista[Number(it.dataset.i)]) abrir(lista[Number(it.dataset.i)]);
      });
      pintar(true);
    }
  });
}
