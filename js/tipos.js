/* Tipos de actividad de la rutina y cálculo del día (portado de Monk Mode).
   Los tipos se pueden editar: viven en Config (id "tipos") y aquí se cargan en TIPOS.
   Sueño (marca el inicio del día) y Tarea (destino de los tipos borrados) no se pueden eliminar. */
const BASE = [
  { k: 'sueno', l: 'Sueño', color: '#6b6b75' },
  { k: 'trabajo', l: 'Trabajo', color: '#c9bcff' },
  { k: 'comida', l: 'Comida', color: '#ffc99a' },
  { k: 'avance', l: 'Avance', color: '#4a6cf7' },
  { k: 'tarea', l: 'Tarea', color: '#ffffff' },
  { k: 'ejercicio', l: 'Ejercicio', color: '#bdeca6' },
  { k: 'recreativo', l: 'Recreativo', color: '#fdf5b0' }
];
export const PROTEGIDOS = ['sueno', 'tarea'];
export const TIPOS = {};

/* Texto oscuro o claro según qué tan claro sea el color de fondo. */
export function tinta(hex) {
  const h = String(hex || '#888').replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
  const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const L = .2126 * lin(n >> 16 & 255) + .7152 * lin(n >> 8 & 255) + .0722 * lin(n & 255);
  return L > .22 ? '#111' : '#fff';
}
export function cargarTipos(state) {
  let lista = null;
  const fila = (state.config || []).find(c => c.id === 'tipos');
  try { lista = fila && JSON.parse(fila.valor); } catch (e) {}
  if (!Array.isArray(lista) || !lista.length) lista = BASE;
  PROTEGIDOS.forEach(k => { if (!lista.some(t => t.k === k)) lista = [...lista, BASE.find(t => t.k === k)]; });
  Object.keys(TIPOS).forEach(k => delete TIPOS[k]);
  lista.forEach(t => { TIPOS[t.k] = { l: t.l, color: t.color, tinta: tinta(t.color) }; });
}
export const listaTipos = () => Object.entries(TIPOS).map(([k, t]) => ({ k, l: t.l, color: t.color }));
cargarTipos({});

export const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

export const aMin = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + m; };
export const norm = m => ((m % 1440) + 1440) % 1440;
export const reloj = m => { m = norm(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
export const horas = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r}` : `${h} h`) : `${r} min`; };

/* Ordena las actividades del día empezando al despertar y arma filas con trayectos.
   La tolerancia queda dentro de la actividad: su rango va de inicio menos tolerancia previa
   a fin más tolerancia posterior. */
export function filasDelDia(lista) {
  const sueno = lista.find(a => a.tipo === 'sueno');
  const ref = sueno ? norm(aMin(sueno.inicio) + Number(sueno.dur) + Number(sueno.tolD || 0) + Number(sueno.vuelta || 0)) : 0;
  const n = v => Number(v) || 0;
  const tramos = lista.map(a => ({ a, desde: norm(aMin(a.inicio) - n(a.tolA) - n(a.ida) - ref) }))
    .sort((x, y) => x.desde - y.desde);
  const filas = [];
  tramos.forEach(({ a, desde }) => {
    let t = desde;
    if (n(a.ida)) { filas.push({ k: 'tray', ini: ref + t, m: n(a.ida), nombre: 'Trayecto de ida' }); t += n(a.ida); }
    const total = n(a.tolA) + n(a.dur) + n(a.tolD);
    filas.push({ k: 'act', ini: ref + t, m: total, a });
    t += total;
    if (n(a.vuelta)) filas.push({ k: 'tray', ini: ref + t, m: n(a.vuelta), nombre: 'Trayecto de vuelta' });
  });
  return filas;
}

/* Análisis del día para Editar rutina: filas con huecos libres, empalmes y horas útiles.
   Horas útiles = 24 h − sueño − trabajo − comidas − trayectos. */
export function analizar(lista) {
  const n = v => Number(v) || 0;
  const sueno = lista.find(a => a.tipo === 'sueno');
  const ref = sueno ? norm(aMin(sueno.inicio) + n(sueno.dur) + n(sueno.tolD) + n(sueno.vuelta)) : 0;
  const tramos = lista.map(a => {
    const desde = norm(aMin(a.inicio) - n(a.tolA) - n(a.ida) - ref);
    return { a, desde, hasta: desde + n(a.ida) + n(a.tolA) + n(a.dur) + n(a.tolD) + n(a.vuelta) };
  }).sort((x, y) => x.desde - y.desde);
  const empalmes = {};
  const choca = (p, q) => [0, 1440, -1440].some(d => p.desde < q.hasta + d && q.desde + d < p.hasta);
  tramos.forEach((p, i) => tramos.slice(i + 1).forEach(q => {
    if (!choca(p, q)) return;
    (empalmes[p.a.id] = empalmes[p.a.id] || []).push(q.a.nombre);
    (empalmes[q.a.id] = empalmes[q.a.id] || []).push(p.a.nombre);
  }));
  const filas = [], barras = [], tot = { tray: 0, tol: 0, libre: 0 };
  Object.keys(TIPOS).forEach(k => { tot[k] = 0; }); tot.sueno = tot.sueno || 0; tot.trabajo = tot.trabajo || 0; tot.comida = tot.comida || 0;
  let cur = 0;
  tramos.forEach(({ a, desde, hasta }) => {
    if (desde > cur) { filas.push({ k: 'gap', ini: ref + cur, m: desde - cur }); barras.push({ m: desde - cur, k: 'libre' }); tot.libre += desde - cur; }
    let t = desde;
    if (n(a.ida)) { filas.push({ k: 'tray', ini: ref + t, m: n(a.ida), nombre: 'Trayecto de ida' }); barras.push({ m: n(a.ida), k: 'tray' }); t += n(a.ida); }
    const total = n(a.tolA) + n(a.dur) + n(a.tolD);
    filas.push({ k: 'act', ini: ref + t, m: total, a });
    if (n(a.tolA)) barras.push({ m: n(a.tolA), k: 'tol' });
    barras.push({ m: n(a.dur), k: a.tipo, core: !!a.core });
    if (n(a.tolD)) barras.push({ m: n(a.tolD), k: 'tol' });
    t += total;
    if (n(a.vuelta)) { filas.push({ k: 'tray', ini: ref + t, m: n(a.vuelta), nombre: 'Trayecto de vuelta' }); barras.push({ m: n(a.vuelta), k: 'tray' }); }
    tot[a.tipo] = (tot[a.tipo] || 0) + n(a.dur); tot.tray += n(a.ida) + n(a.vuelta); tot.tol += n(a.tolA) + n(a.tolD);
    cur = Math.max(cur, hasta);
  });
  if (cur < 1440) { filas.push({ k: 'gap', ini: ref + cur, m: 1440 - cur }); barras.push({ m: 1440 - cur, k: 'libre' }); tot.libre += 1440 - cur; }
  const util = 1440 - tot.sueno - tot.trabajo - tot.comida - tot.tray;
  return { ref, filas, barras, tot, util, empalmes };
}
