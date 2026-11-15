/* Conexión con el backend de Apps Script.
   La dirección vive en config.js; el token se guarda solo en este dispositivo
   y llega con el enlace de conexión (…/#conectar=TOKEN). */
import { API_URL } from './config.js';
const K = 'enzo-token';

function token() {
  try {
    const t = localStorage.getItem(K);
    if (t) return t;
    const viejo = JSON.parse(localStorage.getItem('enzo-conexion') || 'null');   // formato anterior
    if (viejo && viejo.token) { localStorage.setItem(K, viejo.token); localStorage.removeItem('enzo-conexion'); return viejo.token; }
  } catch (e) {}
  return '';
}
export const conf = () => (API_URL && token() ? { url: API_URL, token: token() } : null);
export const conectado = () => !!conf();
export function guardarToken(t) { try { localStorage.setItem(K, String(t).trim()); } catch (e) {} }
export function olvidarToken() { try { localStorage.removeItem(K); } catch (e) {} }

async function leer(r) {
  let j;
  try { j = await r.json(); } catch (e) { throw new Error('El servidor no respondió con datos.'); }
  if (!j.ok) throw new Error(j.error || 'El servidor rechazó la solicitud.');
  return j;
}

async function get(accion, c = conf()) {
  const url = `${c.url}?accion=${accion}&token=${encodeURIComponent(c.token)}`;
  return leer(await fetch(url, { redirect: 'follow', cache: 'no-store' }));
}

/* Cuerpo como text/plain para que el navegador no haga una consulta previa (CORS). */
async function post(cuerpo, c = conf()) {
  return leer(await fetch(c.url, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...cuerpo, token: c.token })
  }));
}

export const probar = t => get('ping', { url: API_URL, token: String(t).trim() });
export const cargar = async () => (await get('cargar')).datos;
export const guardar = ops => post({ accion: 'guardar', ops });
