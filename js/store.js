/* Estado de Enzo, primero local.
   Todo vive en IndexedDB del dispositivo; cada cambio se anota en una cola
   y se envía a Apps Script cuando hay conexión. Al sincronizar, el servidor
   manda el estado completo y reemplaza la copia local. */
import * as api from './api.js';

export const ENTIDADES = ['actividades', 'registros', 'pendientes', 'followups', 'ejercicios', 'sesiones', 'config'];
export const state = Object.fromEntries(ENTIDADES.map(e => [e, []]));
export const estado = { s: 'local', ultimo: null, error: '' };

let cola = [];
const oyentes = new Set();
export const escuchar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisar = () => oyentes.forEach(fn => fn());

/* ---------- IndexedDB ---------- */
const db = new Promise((ok, ko) => {
  const r = indexedDB.open('enzo', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => ko(r.error);
});
async function idb(modo, fn) {
  const d = await db;
  return new Promise((ok, ko) => {
    const q = fn(d.transaction('kv', modo).objectStore('kv'));
    q.onsuccess = () => ok(q.result);
    q.onerror = () => ko(q.error);
  });
}
const persistir = () => idb('readwrite', s => s.put({ state, cola, ultimo: estado.ultimo }, 'todo')).catch(() => {});

export async function iniciar() {
  try {
    const g = await idb('readonly', s => s.get('todo'));
    if (g) {
      ENTIDADES.forEach(e => { state[e] = (g.state && g.state[e]) || []; });
      cola = g.cola || [];
      estado.ultimo = g.ultimo || null;
    }
  } catch (e) { /* sin IndexedDB: la app funciona en memoria */ }
  estado.s = api.conectado() ? (cola.length ? 'pendiente' : 'ok') : 'local';
  window.addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60000);
  avisar();
  sincronizar();
}

/* ---------- cambios ---------- */
function aplicar(op) {
  const lista = state[op.entidad];
  const i = lista.findIndex(x => x.id === op.fila.id);
  if (op.op === 'borrar') { if (i >= 0) lista.splice(i, 1); return; }
  if (i >= 0) lista[i] = op.fila; else lista.push(op.fila);
}
let temporizador = null;
function encolar(op) {
  aplicar(op);
  cola.push(op);
  if (api.conectado()) estado.s = 'pendiente';
  persistir();
  avisar();
  clearTimeout(temporizador);
  temporizador = setTimeout(sincronizar, 900);
}
export function guardar(entidad, fila) {
  encolar({ entidad, op: 'upsert', fila: { ...fila, actualizado: Date.now() } });
}
export function borrar(entidad, id) {
  encolar({ entidad, op: 'borrar', fila: { id, actualizado: Date.now() } });
}
export const buscar = (entidad, id) => state[entidad].find(x => x.id === id);

/* Reemplaza todo con un respaldo importado y lo manda al servidor. */
export function importar(datos) {
  ENTIDADES.forEach(e => {
    const nuevos = Array.isArray(datos[e]) ? datos[e] : [];
    state[e].forEach(x => { if (!nuevos.some(n => n.id === x.id)) cola.push({ entidad: e, op: 'borrar', fila: { id: x.id, actualizado: Date.now() } }); });
    nuevos.forEach(x => cola.push({ entidad: e, op: 'upsert', fila: { ...x, actualizado: Date.now() } }));
    state[e] = nuevos.map(x => ({ ...x }));
  });
  persistir(); avisar(); sincronizar();
}
export const exportar = () => JSON.parse(JSON.stringify(state));

/* ---------- sincronización ---------- */
let enCurso = null;
export function sincronizar() {
  if (!api.conectado()) { estado.s = 'local'; avisar(); return Promise.resolve(); }
  if (enCurso) return enCurso;
  if (!navigator.onLine) { estado.s = cola.length ? 'pendiente' : estado.s; avisar(); return Promise.resolve(); }
  estado.s = 'sincronizando'; avisar();
  enCurso = (async () => {
    try {
      if (cola.length) {
        const lote = cola.slice(0, 400);
        await api.guardar(lote);
        cola = cola.slice(lote.length);
        await persistir();
      }
      const datos = await api.cargar();
      ENTIDADES.forEach(e => { state[e] = Array.isArray(datos[e]) ? datos[e] : []; });
      cola.forEach(aplicar);
      estado.ultimo = Date.now(); estado.error = '';
      estado.s = cola.length ? 'pendiente' : 'ok';
      await persistir();
    } catch (e) {
      estado.s = 'error'; estado.error = e.message || String(e);
    } finally {
      enCurso = null;
      avisar();
      if (estado.s === 'pendiente') setTimeout(sincronizar, 300);
    }
  })();
  return enCurso;
}

/* Al desconectar se conservan los datos del dispositivo. */
export function desconectar() { api.olvidarToken(); estado.s = 'local'; avisar(); }
