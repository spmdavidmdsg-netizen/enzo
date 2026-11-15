/* Utilidades compartidas. */
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const desdeIso = s => new Date(s + 'T00:00:00');
export const diasEntre = (a, b) => Math.round((desdeIso(b) - desdeIso(a)) / 864e5);
export const fechaLarga = d => `${cap(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}`;
export const fechaCorta = s => { const d = desdeIso(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; };

/* Texto relativo para una fecha de vencimiento. */
export function cuando(s) {
  if (!s) return { txt: 'Sin fecha', tarde: false };
  const n = diasEntre(iso(hoy()), s);
  if (n < -1) return { txt: `Vencida · ${fechaCorta(s)}`, tarde: true };
  if (n === -1) return { txt: 'Vencida · ayer', tarde: true };
  if (n === 0) return { txt: 'Hoy', tarde: false };
  if (n === 1) return { txt: 'Mañana', tarde: false };
  return { txt: fechaCorta(s), tarde: false };
}

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Pie de las hojas de edición: bote de basura (si se puede borrar) y palomita para guardar. */
export const ICONO_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
export const ICONO_BASURA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.2 6.5l.9 12.6c.1 1 .9 1.9 2 1.9h5.8c1 0 1.9-.8 2-1.9l.9-12.6M10.2 10.5v6.5M13.8 10.5v6.5"/></svg>';
export const pieHoja = borrar => `<div class="sh-foot">${borrar ? `<button type="button" class="c-btn glass del" data-borrar aria-label="Eliminar" title="Eliminar">${ICONO_BASURA}</button>` : '<span></span>'}<button class="c-btn ok" aria-label="Guardar" title="Guardar">${ICONO_OK}</button></div>`;
