/* Menú desplegable de vidrio que nace del botón que lo abre, con resorte.
   desplegable(boton, opciones, alElegir)
   opciones: [{ v, html, actual?, sep? }]  ·  sep = línea divisoria antes de la opción. */
let abierto = null;

export function cerrarDesplegable() {
  if (!abierto) return;
  const { el, boton, fuera, tecla } = abierto;
  abierto = null;
  boton.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', fuera, true);
  document.removeEventListener('keydown', tecla, true);
  el.classList.remove('show');
  setTimeout(() => el.remove(), 200);
}

export function desplegable(boton, opciones, alElegir) {
  const era = abierto && abierto.boton === boton;
  cerrarDesplegable();
  if (era) return;
  const el = document.createElement('div');
  el.className = 'dd glass tint';
  el.setAttribute('role', 'listbox');
  el.innerHTML = opciones.map((o, i) => `${o.sep ? '<hr>' : ''}<button type="button" role="option" data-i="${i}" aria-selected="${!!o.actual}">${o.html}</button>`).join('');
  document.body.append(el);

  /* Abajo del botón si cabe; si no, arriba. Alineado a su borde más cercano. */
  const r = boton.getBoundingClientRect(), w = Math.max(r.width, el.offsetWidth), h = el.offsetHeight;
  const abajo = r.bottom + 8 + h < innerHeight - 8 || r.top < h + 16;
  const izq = Math.min(Math.max(8, r.right - w > 8 && r.left + w > innerWidth - 8 ? r.right - w : r.left), innerWidth - w - 8);
  Object.assign(el.style, { left: izq + 'px', minWidth: r.width + 'px', top: (abajo ? r.bottom + 8 : Math.max(8, r.top - 8 - h)) + 'px', transformOrigin: `${r.left + r.width / 2 - izq}px ${abajo ? 0 : h}px` });
  requestAnimationFrame(() => el.classList.add('show'));
  boton.setAttribute('aria-expanded', 'true');

  const fuera = e => { if (!el.contains(e.target) && !boton.contains(e.target)) cerrarDesplegable(); };
  const tecla = e => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrarDesplegable(); boton.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const bs = [...el.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
    }
  };
  document.addEventListener('pointerdown', fuera, true);
  document.addEventListener('keydown', tecla, true);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    cerrarDesplegable();
    alElegir(opciones[Number(b.dataset.i)].v);
  });
  abierto = { el, boton, fuera, tecla };
  (el.querySelector('[aria-selected="true"]') || el.querySelector('button')).focus({ preventScroll: true });
}
