/* Notas (Projects › Notas), como Notas de Apple.
   Celular: lista por fecha con buscador; al abrir una nota, ocupa la pantalla con su barra de formato.
   Mac: lista a la izquierda y la nota abierta a la derecha.
   El formato es ligero (título, subtítulo, texto, negrita, cursiva, subrayado, tachado, listas y casillas)
   y se guarda como HTML limpio en la hoja Notas. Se guarda solo mientras escribes. */
import { esc, uid, iso, hoy, DIAS, MESES, cap } from '../util.js';
import { activos, nombreDe, ICONO } from './proyectos.js';
import { desplegable } from '../desplegable.js';

const ui = { abierta: null, q: '', estilos: false };
let borrador = null;      // nota nueva que aún no tiene nada escrito
let ctxG = null, tGuardar = null;
const esMac = () => matchMedia('(min-width:820px)').matches;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- HTML limpio: solo las etiquetas del formato de Enzo ---------- */
const PERMITIDAS = new Set(['H2', 'H3', 'P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI']);
const FUERA = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'svg', 'SVG', 'IMG', 'VIDEO', 'AUDIO']);
function limpiarNodo(n) {
  [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) return;
    if (c.nodeType !== 1 || FUERA.has(c.tagName)) { c.remove(); return; }
    limpiarNodo(c);
    if (!PERMITIDAS.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
    [...c.attributes].forEach(a => { if (a.name !== 'class') c.removeAttribute(a.name); });
    const cls = [...c.classList].filter(k => (k === 'chk' && c.tagName === 'UL') || (k === 'ok' && c.tagName === 'LI'));
    if (cls.length) c.className = cls.join(' '); else c.removeAttribute('class');
  });
}
export function limpiar(html) {
  const d = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  limpiarNodo(d.body);
  return d.body.innerHTML;
}
const textoDe = html => new DOMParser().parseFromString(`<body>${String(html || '').replace(/<\/(p|div|h2|h3|li)>|<br\s*\/?>/gi, ' ')}</body>`, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();

/* ---------- consultas ---------- */
const buscarNota = (s, id) => s.notas.find(n => n.id === id) || (borrador && borrador.id === id ? borrador : null);
const ordenadas = s => s.notas.slice().sort((a, b) => (Number(b.actualizado) || 0) - (Number(a.actualizado) || 0));
const cuando = n => new Date(Number(n.actualizado) || Date.now());
function grupo(n) {
  const d = cuando(n), h = hoy(), dias = Math.floor((h - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (dias <= 0) return 'Hoy';
  if (dias < 7) return 'Últimos 7 días';
  if (d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth()) return 'Este mes';
  return `${cap(MESES[d.getMonth()])}${d.getFullYear() !== h.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
function etiquetaHora(n) {
  const d = cuando(n), g = grupo(n);
  if (g === 'Hoy') return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (g === 'Últimos 7 días') return cap(DIAS[d.getDay()].slice(0, 3));
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}
/* Una sola función para todas las búsquedas (también la usa la lupa) */
export function buscar(store, q) {
  const t = norm(q).trim();
  if (!t) return [];
  return ordenadas(store.state).filter(n => norm(n.titulo).includes(t) || norm(textoDe(n.cuerpo)).includes(t)).slice(0, 20);
}

/* ---------- vista ---------- */
export const ocultaBarra = () => !esMac() && !!ui.abierta;
/* Mientras escribes, Enzo no redibuja la página al sincronizar (perderías el cursor). */
export const pausarRender = () => { const ed = document.querySelector('.n-ed'); return !!ed && ed.contains(document.activeElement); };

export function render(ctx) {
  ctxG = ctx;
  guardarYa();
  const s = ctx.store.state;
  if (ui.abierta && !buscarNota(s, ui.abierta)) ui.abierta = null;
  if (!ui.abierta && esMac()) { const p = ordenadas(s)[0]; if (p) ui.abierta = p.id; }
  const n = ui.abierta && buscarNota(s, ui.abierta);
  return `<div class="notas${n ? ' con-nota' : ''}">
    <div class="n-lado">
      <h1 class="st">Notas</h1>
      <label class="n-buscar st" style="--i:1"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M13.5 13.5L17 17"/></svg><input type="search" placeholder="Buscar en tus notas" value="${esc(ui.q)}" data-nq aria-label="Buscar en tus notas" autocomplete="off"></label>
      <div class="n-items st" style="--i:2">${items(s)}</div>
    </div>
    ${n ? editor(s, n) : ''}
  </div>`;
}

function items(s) {
  const t = norm(ui.q).trim();
  const lista = ordenadas(s).filter(n => !t || norm(n.titulo).includes(t) || norm(textoDe(n.cuerpo)).includes(t));
  if (!s.notas.length) return '<p class="empty">Sin notas todavía. Toca el círculo para escribir la primera.</p>';
  if (!lista.length) return `<p class="note">Sin resultados para «${esc(ui.q.trim())}».</p>`;
  let html = '', actual = null;
  lista.forEach(n => {
    const g = grupo(n);
    if (g !== actual) { html += `${actual ? '</div>' : ''}<span class="h n-g">${g}</span><div class="card n-lista">`; actual = g; }
    const pr = n.proyectoId ? nombreDe(s, n.proyectoId) : '';
    html += `<button class="n-item" data-nota="${esc(n.id)}" aria-current="${n.id === ui.abierta}"><b>${esc(n.titulo || 'Sin título')}</b>
      <span><em>${etiquetaHora(n)}</em>${esc(textoDe(n.cuerpo).slice(0, 90) || 'Sin texto')}</span>${pr ? `<small>${ICONO.carpeta}${esc(pr)}</small>` : ''}</button>`;
  });
  return html + '</div>';
}

const I = {
  atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
  lista: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h11"/></svg>',
  chk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>',
  mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></svg>'
};
function editor(s, n) {
  const d = cuando(n), pr = n.proyectoId ? nombreDe(s, n.proyectoId) : '';
  return `<article class="n-ed" data-id="${esc(n.id)}">
    <div class="n-top"><button class="c-btn glass n-volver" data-n-volver aria-label="Volver a tus notas" title="Volver">${I.atras}</button>
      <button class="n-proy glass" data-n-proy aria-haspopup="listbox" aria-expanded="false" title="Proyecto de la nota">${ICONO.carpeta}<span>${pr ? esc(pr) : 'Sin proyecto'}</span>${I.chev}</button></div>
    <div class="n-estilos glass tint" ${ui.estilos ? '' : 'hidden'}>
      <div class="n-f1"><button data-cmd="h2">Título</button><button data-cmd="h3">Subtítulo</button><button data-cmd="p">Texto</button></div>
      <div class="n-f2"><button data-cmd="b" aria-label="Negrita"><b>B</b></button><button data-cmd="i" aria-label="Cursiva"><i>I</i></button><button data-cmd="u" aria-label="Subrayado"><u>U</u></button><button data-cmd="s" aria-label="Tachado"><s>S</s></button></div>
      <div class="n-f2"><button data-cmd="ul" aria-label="Viñetas">•</button><button data-cmd="ol" aria-label="Numerada">1.</button><button data-cmd="chk" aria-label="Casillas">${I.chk}</button></div>
    </div>
    <div class="n-bar glass tint" role="toolbar" aria-label="Formato">
      <button data-cmd="aa" class="n-aa" aria-label="Estilos" aria-expanded="${ui.estilos}">Aa</button>
      <button data-cmd="ul" aria-label="Lista">${I.lista}</button>
      <button data-cmd="chk" aria-label="Casillas">${I.chk}</button>
      <button data-cmd="b" aria-label="Negrita"><b>B</b></button>
      <button data-cmd="mas" aria-label="Más opciones" aria-haspopup="listbox" aria-expanded="false">${I.mas}</button>
    </div>
    <p class="n-fecha">${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}</p>
    <input class="n-titulo" data-n-titulo value="${esc(n.titulo || '')}" placeholder="Título" aria-label="Título de la nota" autocomplete="off" enterkeyhint="next">
    <div class="n-cuerpo" contenteditable="true" data-n-cuerpo data-ph="Escribe aquí…" role="textbox" aria-multiline="true" aria-label="Contenido de la nota">${limpiar(n.cuerpo)}</div>
  </article>`;
}

/* ---------- guardar ---------- */
function guardarPronto() { clearTimeout(tGuardar); tGuardar = setTimeout(guardarYa, 600); }
function guardarYa() {
  if (!ctxG) return;
  clearTimeout(tGuardar); tGuardar = null;
  const ed = document.querySelector('.n-ed'); if (!ed) return;
  const s = ctxG.store.state, previo = buscarNota(s, ed.dataset.id); if (!previo) return;
  const titulo = ed.querySelector('[data-n-titulo]').value.trim();
  let cuerpo = limpiar(ed.querySelector('[data-n-cuerpo]').innerHTML);
  if (!textoDe(cuerpo) && !/<li|<ul|<ol/.test(cuerpo)) cuerpo = '';
  if (titulo === (previo.titulo || '') && cuerpo === (previo.cuerpo || '')) return;
  if (!titulo && !cuerpo) return;   // vacía: no se guarda (y si ya existía, se borra al salir)
  const n = { ...previo, titulo, cuerpo };
  if (borrador && borrador.id === n.id) borrador = null;
  ctxG.store.guardar('notas', n);
  /* La fila de la lista (Mac) se actualiza sin redibujar la página */
  const it = document.querySelector(`.n-item[data-nota="${CSS.escape(n.id)}"]`);
  if (it) { it.querySelector('b').textContent = titulo || 'Sin título'; const sp = it.querySelector('span'); if (sp) sp.lastChild.textContent = textoDe(cuerpo).slice(0, 90) || 'Sin texto'; }
}
/* Al salir de una nota vacía, se descarta. */
function cerrarNota(ctx) {
  guardarYa();
  const n = buscarNota(ctx.store.state, ui.abierta);
  if (n && !n.titulo && !n.cuerpo && ctx.store.buscar('notas', n.id)) ctx.store.borrar('notas', n.id);
  borrador = null; ui.abierta = null; ui.estilos = false;
}

/* ---------- abrir y crear (también desde Proyectos) ---------- */
export function abrir(id) { if (ctxG) guardarYa(); borrador = null; ui.abierta = id; ui.estilos = false; }
export function nuevo(ctx, desde, proyectoId = '') {
  ctxG = ctx;
  if (ui.abierta) cerrarNota(ctx);
  borrador = { id: uid(), titulo: '', cuerpo: '', proyectoId: proyectoId || '', creado: iso(hoy()), actualizado: Date.now() };
  ui.abierta = borrador.id; ui.q = '';
  ctx.render(); window.scrollTo(0, 0);
  document.querySelector('[data-n-titulo]')?.focus();   // en el mismo toque, para que el iPhone abra el teclado
}
export const etiquetaNuevo = () => 'Nueva nota';

/* ---------- formato ---------- */
const cuerpoEl = () => document.querySelector('[data-n-cuerpo]');
function listaActual() {
  const sel = getSelection(), c = cuerpoEl(); if (!sel.rangeCount || !c) return null;
  const r = sel.getRangeAt(0);
  let n = r.startContainer;
  if (n.nodeType === 1 && n.childNodes[r.startOffset]) n = n.childNodes[r.startOffset];
  else if (n.nodeType === 1 && r.startOffset && n.childNodes[r.startOffset - 1]) n = n.childNodes[r.startOffset - 1];
  n = n && (n.nodeType === 1 ? n : n.parentElement);
  const l = n && n.closest('ul,ol');
  return l && c.contains(l) ? l : null;
}
function formato(cmd) {
  const c = cuerpoEl(); if (!c) return;
  if (!c.contains(getSelection().anchorNode)) { c.focus(); const r = document.createRange(); r.selectNodeContents(c); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.execCommand('defaultParagraphSeparator', false, 'p');
  const l = listaActual();
  switch (cmd) {
    case 'h2': case 'h3': case 'p': document.execCommand('formatBlock', false, cmd); break;
    case 'b': document.execCommand('bold'); break;
    case 'i': document.execCommand('italic'); break;
    case 'u': document.execCommand('underline'); break;
    case 's': document.execCommand('strikeThrough'); break;
    case 'ol': document.execCommand('insertOrderedList'); break;
    case 'ul':
      if (l && l.classList.contains('chk')) l.classList.remove('chk');
      else document.execCommand('insertUnorderedList');
      break;
    case 'chk':
      if (l && l.classList.contains('chk')) { document.execCommand('insertUnorderedList'); break; }
      if (!l || l.tagName !== 'UL') document.execCommand('insertUnorderedList');
      listaActual()?.classList.add('chk');
      break;
  }
  guardarPronto();
}

/* ---------- interacción ---------- */
export function montar(view, ctx) {
  ctxG = ctx;
  const abierta = !!view.querySelector('.n-ed');
  document.body.classList.toggle('editando-nota', abierta && !esMac());
  view.addEventListener('input', e => {
    if (e.target.matches('[data-nq]')) { ui.q = e.target.value; view.querySelector('.n-items').innerHTML = items(ctx.store.state); return; }
    if (e.target.closest('.n-ed')) { guardarPronto(); if (e.target.closest('[data-n-cuerpo]')) verCursor(); }
  });
  /* Al salir de la nota se guarda; pasar del título al texto no cuenta como salir (guardar ahí redibujaría la nota) */
  view.addEventListener('focusout', e => {
    const ed = e.target.closest?.('.n-ed'); if (!ed) return;
    setTimeout(() => { if (!ed.isConnected || !ed.contains(document.activeElement)) guardarYa(); }, 0);
  });
  view.addEventListener('keydown', e => {
    if (e.target.matches('[data-n-titulo]') && e.key === 'Enter') { e.preventDefault(); cuerpoEl()?.focus(); }
    if (e.target.closest('[data-n-cuerpo]') && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); formato('chk'); }
  });
  /* Los botones de formato no le quitan el cursor al texto: si lo hicieran, en el iPhone el teclado
     se cerraría y volvería a abrir y la pantalla brincaría. Con el dedo, la acción va al soltar. */
  const SEL = '.n-bar [data-cmd],.n-estilos [data-cmd]';
  view.addEventListener('mousedown', e => { if (e.target.closest(SEL)) e.preventDefault(); });
  let toque = null;
  view.addEventListener('touchstart', e => {
    const b = e.target.closest(SEL); if (!b) return;
    e.preventDefault();
    toque = { b, x: e.touches[0].clientX, y: e.touches[0].clientY };
    b.classList.add('pulsado');
  }, { passive: false });
  view.addEventListener('touchmove', e => { if (toque && Math.hypot(e.touches[0].clientX - toque.x, e.touches[0].clientY - toque.y) > 12) { toque.b.classList.remove('pulsado'); toque = null; } }, { passive: true });
  view.addEventListener('touchend', e => {
    if (!toque) return;
    const b = toque.b; toque = null; b.classList.remove('pulsado');
    e.preventDefault();
    accion(b, view, ctx);
  });
  view.addEventListener('click', e => {
    const it = e.target.closest('[data-nota]');
    if (it) { if (ui.abierta) cerrarNota(ctx); ui.abierta = it.dataset.nota; ctx.render(); if (!esMac()) window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-n-volver]')) { cerrarNota(ctx); ctx.render(); window.scrollTo(0, 0); return; }
    /* Casillas: tocar el círculo marca o desmarca */
    const li = e.target.closest('[data-n-cuerpo] ul.chk > li');
    if (li && e.clientX - li.getBoundingClientRect().left < 30) { e.preventDefault(); li.classList.toggle('ok'); guardarPronto(); return; }
    const pr = e.target.closest('[data-n-proy]');
    if (pr) {
      const s = ctx.store.state, n = buscarNota(s, ui.abierta); if (!n) return;
      const lista = activos(s);
      if (n.proyectoId && !lista.some(x => x.id === n.proyectoId)) { const x = s.proyectos.find(y => y.id === n.proyectoId); if (x) lista.push(x); }
      desplegable(pr, [{ v: '', actual: !n.proyectoId, html: 'Sin proyecto' }, ...lista.map((x, i) => ({ v: x.id, sep: i === 0, actual: x.id === n.proyectoId, html: esc(x.nombre) }))], v => {
        guardarYa();
        const act = buscarNota(ctx.store.state, ui.abierta); if (!act) return;
        if (borrador && borrador.id === act.id) borrador.proyectoId = v;
        else ctx.store.guardar('notas', { ...act, proyectoId: v });
        pr.querySelector('span').textContent = v ? nombreDe(ctx.store.state, v) : 'Sin proyecto';
        const it2 = document.querySelector(`.n-item[data-nota="${CSS.escape(act.id)}"]`); if (it2) ctx.render();
      });
      return;
    }
    const b = e.target.closest('[data-cmd]'); if (b) accion(b, view, ctx);
  });
}

function accion(b, view, ctx) {
    const cmd = b.dataset.cmd;
    if (cmd === 'aa') { ui.estilos = !ui.estilos; view.querySelector('.n-estilos').hidden = !ui.estilos; b.setAttribute('aria-expanded', ui.estilos); return; }
    if (cmd === 'mas') {
      desplegable(b, [{ v: 'borrar', html: '<span class="rojo">Borrar nota</span>' }], v => {
        if (v !== 'borrar') return;
        const n = buscarNota(ctx.store.state, ui.abierta); if (!n) return;
        clearTimeout(tGuardar); tGuardar = null;
        if (ctx.store.buscar('notas', n.id)) ctx.store.borrar('notas', n.id);
        borrador = null; ui.abierta = null; ui.estilos = false;
        ctx.render();
        if (n.titulo || n.cuerpo) ctx.toast('Nota eliminada', () => ctx.store.guardar('notas', n));
      });
      return;
    }
    formato(cmd);
}

/* iPhone: si la línea que escribes queda detrás de la barra de formato, la página sube lo justo. */
function verCursor() {
  if (esMac()) return;
  const sel = getSelection(); if (!sel.rangeCount) return;
  let r = sel.getRangeAt(0).getClientRects()[0];
  if (!r) { const n = sel.anchorNode; r = (n && (n.nodeType === 1 ? n : n.parentElement))?.getBoundingClientRect(); }
  const bar = document.querySelector('.n-bar'), vv = window.visualViewport;
  if (!r || !bar) return;
  const limite = (vv ? vv.offsetTop + vv.height : innerHeight) - bar.offsetHeight - 12;
  if (r.bottom > limite) window.scrollBy(0, r.bottom - limite);
}
