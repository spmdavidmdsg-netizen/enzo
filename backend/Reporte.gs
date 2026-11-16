/**
 * Enzo · correos de seguimiento (mensual y semanal), enviados desde la nube.
 *
 * Diseño en modo claro con las reglas de la guía visual: fondo gris papel, tarjetas blancas,
 * tinta casi negra, letra del sistema, acento #1A73D9 en botones y verdes del Resumen
 * (gris, no rojo, para lo no hecho).
 *
 * Primera vez: ejecuta `activarCorreos` desde el editor. Programa los envíos y manda uno de prueba de cada uno.
 *   Mensual: día 1 de cada mes, 9:00, con el mes anterior y su PDF adjunto.
 *   Semanal: domingo, 20:00, con la semana que termina.
 * El destinatario vive en la propiedad DESTINO del script (o en Privado.gs); nunca en este archivo, que es público.
 */

var APP_ENZO = 'https://spmdavidmdsg-netizen.github.io/enzo/';
var MESES_R = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var MES3_R = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var DIAS_R = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var CLAVE_DIA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
var LETRA_R = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
var TIPOS_BASE = [
  { k: 'sueno', l: 'Sueño', color: '#6b6b75' }, { k: 'trabajo', l: 'Trabajo', color: '#c9bcff' },
  { k: 'comida', l: 'Comida', color: '#ffc99a' }, { k: 'avance', l: 'Avance', color: '#4a6cf7' },
  { k: 'tarea', l: 'Tarea', color: '#ffffff' }, { k: 'ejercicio', l: 'Ejercicio', color: '#bdeca6' },
  { k: 'recreativo', l: 'Recreativo', color: '#fdf5b0' }
];
var FRASES_R = {
  alto: ['Este nivel no fue suerte: lo construiste día por día. Protégelo.', 'Ya sabes cómo se ve un mes bien hecho. Ahora vuélvelo normal.', 'Lo difícil ya es parte de tu rutina. Sigue subiendo la vara.'],
  medio: ['Vas avanzando más de lo que parece. Elige una sola cosa y hazla mejor.', 'No necesitas un periodo perfecto, necesitas un día más que el anterior.', 'La base ya está. Lo que sigue es repetir lo que funcionó.'],
  bajo: ['Un mal periodo no te define. Vuelve a tu Línea Crítica y empieza mañana.', 'Cuando cueste, reduce el plan, no el compromiso. Hoy solo cumple lo imprescindible.', 'Volver también es disciplina. Un día cumplido basta para retomar.'],
  inicio: ['Todo empieza con la primera actividad marcada. Hazla hoy.']
};
// Tokens de la guía (tema claro)
var R = {
  fuente: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif",
  fondo: '#f2f4f7', tarjeta: '#ffffff', borde: '#e4e8ee', tinta: '#0b0d10', tinta2: '#45484e', tinta3: '#6b6f76',
  acento: '#1A73D9', verdes: ['#e6e9ee', '#c8e6b8', '#8fcb74', '#4f9a3a', '#2c6a1f'], noHecho: '#b9bec7'
};

/* ------------------------------------------------------------ envío */

/** Ejecútala una vez: programa los dos correos y manda uno de prueba de cada uno. */
function activarCorreos() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['enviarMensual', 'enviarSemanal'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarMensual').timeBased().onMonthDay(1).atHour(9).create();
  ScriptApp.newTrigger('enviarSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).create();
  probarCorreos();
  Logger.log('Listo: correos programados (mensual el día 1 a las 9:00, semanal el domingo a las 20:00) y pruebas enviadas a ' + destino_() + '.');
}

/** Manda una prueba del mes y de la semana en curso. */
function probarCorreos() {
  var hoy = new Date();
  enviar_(correoMensual_(hoy.getFullYear(), hoy.getMonth(), true));
  enviar_(correoSemanal_(lunesDe_(hoy), true));
}

/** Disparador: día 1, con el mes anterior. */
function enviarMensual() {
  var hoy = new Date(), m = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  enviar_(correoMensual_(m.getFullYear(), m.getMonth(), false));
}

/** Disparador: domingo en la noche, con la semana que termina. */
function enviarSemanal() {
  enviar_(correoSemanal_(lunesDe_(new Date()), false));
}

function destino_() {
  var p = PropertiesService.getScriptProperties().getProperty('DESTINO');
  if (p) return p;
  if (typeof DESTINO_CORREOS !== 'undefined' && DESTINO_CORREOS) return DESTINO_CORREOS;   // Privado.gs (no se publica)
  return Session.getEffectiveUser().getEmail();
}

function enviar_(c) {
  var opciones = { to: destino_(), subject: c.asunto, htmlBody: c.html, body: c.texto, name: 'Enzo' };
  if (c.pdf) opciones.attachments = [Utilities.newBlob(c.html, 'text/html', c.asunto + '.html').getAs('application/pdf').setName(c.asunto.replace(/^Prueba · /, '') + '.pdf')];
  MailApp.sendEmail(opciones);
}

/* ------------------------------------------------------------ datos */

function iso_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function sumarDias_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function lunesDe_(d) { return sumarDias_(d, -((d.getDay() + 6) % 7)); }

function tiposR_() {
  var lista = null, fila = leer_('config').filter(function (c) { return c.id === 'tipos'; })[0];
  try { lista = fila && JSON.parse(fila.valor); } catch (e) {}
  if (!lista || !lista.length) lista = TIPOS_BASE;
  var out = {};
  lista.forEach(function (t) { out[t.k] = { l: t.l, color: t.color }; });
  return out;
}

/* Mismo cálculo que el Resumen de la app: actividades del día de la semana contra las marcadas como hechas. */
function cargarDatos_() {
  var acts = leer_('actividades'), hechos = {};
  leer_('registros').forEach(function (r) { if (r.hecho) (hechos[r.fecha] = hechos[r.fecha] || {})[r.actividadId] = true; });
  return {
    tipos: tiposR_(),
    dia: function (d) {
      var f = iso_(d), lista = acts.filter(function (a) { return a.dia === CLAVE_DIA[d.getDay()]; }), h = hechos[f] || {};
      var items = lista.map(function (a) { return { tipo: a.tipo, core: a.core, hecho: !!h[a.id] }; });
      var n = items.filter(function (x) { return x.hecho; }).length;
      if (!items.length || !n) return { f: d, pct: null, crit: false, items: items };
      var core = items.filter(function (x) { return x.core; });
      return { f: d, pct: Math.round(n / items.length * 100), crit: core.length > 0 && core.every(function (x) { return x.hecho; }), items: items };
    }
  };
}

function resumen_(dias, tipos) {
  var con = dias.filter(function (d) { return d.pct !== null; });
  var r = { con: con, prom: con.length ? Math.round(con.reduce(function (s, d) { return s + d.pct; }, 0) / con.length) : null,
            crit: con.filter(function (d) { return d.crit; }).length, tipos: [], mejor: null, peor: null, racha: 0 };
  if (con.length >= 2) {
    r.mejor = con.reduce(function (a, b) { return b.pct > a.pct ? b : a; });
    r.peor = con.reduce(function (a, b) { return b.pct < a.pct ? b : a; });
    if (r.mejor.pct === r.peor.pct) r.mejor = r.peor = null;
  }
  var t = {};
  con.forEach(function (d) { d.items.forEach(function (x) { var v = t[x.tipo] = t[x.tipo] || [0, 0]; v[0] += x.hecho ? 1 : 0; v[1]++; }); });
  r.tipos = Object.keys(t).filter(function (k) { return tipos[k]; }).map(function (k) { return [k, Math.round(t[k][0] / t[k][1] * 100)]; })
    .sort(function (a, b) { return b[1] - a[1]; });
  var racha = 0, prev = null;
  con.forEach(function (d) { racha = prev && Math.round((d.f - prev) / 864e5) === 1 ? racha + 1 : 1; prev = d.f; r.racha = Math.max(r.racha, racha); });
  return r;
}

function nivelR_(p) { return p === null ? 0 : p >= 100 ? 4 : p >= 70 ? 3 : p >= 40 ? 2 : 1; }
function frase_(prom, semilla) {
  var g = prom === null ? FRASES_R.inicio : prom >= 80 ? FRASES_R.alto : prom >= 50 ? FRASES_R.medio : FRASES_R.bajo;
  return g[semilla % g.length];
}
function e_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ------------------------------------------------------------ piezas (tablas y estilos en línea, para que se vea igual en Gmail y Mail) */

function doc_(oculto, cuerpo) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>' + e_(oculto) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + R.fondo + ';"><div style="display:none;max-height:0;overflow:hidden;">' + e_(oculto) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + R.fondo + '" style="background:' + R.fondo + ';"><tr><td align="center" style="padding:32px 16px 40px;">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:' + R.fuente + ';color:' + R.tinta + ';">' + cuerpo +
    '<tr><td align="center" style="padding:28px 0 0;color:' + R.tinta3 + ';font-size:12px;line-height:1.5;">Enzo · tu organización diaria</td></tr>' +
    '</table></td></tr></table></body></html>';
}
function fila_(h) { return '<tr><td style="padding:0 0 12px;">' + h + '</td></tr>'; }
function tarjeta_(c, pad) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + R.tarjeta + '" style="background:' + R.tarjeta +
    ';border:1px solid ' + R.borde + ';border-radius:20px;"><tr><td style="padding:' + (pad || '20px 22px') + ';">' + c + '</td></tr></table>';
}
function encabezado_(ceja, titulo, prueba) {
  return '<tr><td style="padding:0 4px 20px;">' + (prueba ? '<p style="margin:0 0 8px;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#ffe9b3;color:#6b4a00;font-size:12px;font-weight:600;">Correo de prueba</span></p>' : '') +
    '<p style="margin:0;color:' + R.tinta3 + ';font-size:13px;font-weight:600;letter-spacing:.02em;">Enzo · ' + e_(ceja) + '</p>' +
    '<h1 style="margin:4px 0 0;color:' + R.tinta + ';font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-.02em;">' + e_(titulo) + '</h1></td></tr>';
}
function seccion_(t) { return '<p style="margin:0 0 12px;color:' + R.tinta3 + ';font-size:13px;font-weight:600;">' + e_(t) + '</p>'; }
function pastilla_(t, pos) {
  var bg = pos ? '#e3f2e2' : '#eceef2', fg = pos ? '#24601c' : R.tinta2;
  return '<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:' + bg + ';color:' + fg + ';font-size:12px;font-weight:600;">' + e_(t) + '</span>';
}
function barra_(p, color) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="' + R.verdes[0] + '" style="background:' + R.verdes[0] + ';border-radius:999px;height:10px;font-size:0;line-height:0;">' +
    '<table role="presentation" width="' + Math.max(p, 3) + '%" cellpadding="0" cellspacing="0"><tr><td bgcolor="' + color + '" style="background:' + color + ';border-radius:999px;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>';
}
function heroe_(prom, etiqueta, contra, cambio) {
  if (prom === null) return tarjeta_('<p style="margin:0;color:' + R.tinta2 + ';font-size:15px;line-height:1.5;">Todavía no hay actividades marcadas en este periodo.</p>');
  var cam = cambio === null ? '' : pastilla_(cambio === 0 ? 'Igual que ' + contra : (cambio > 0 ? '+' : '−') + Math.abs(cambio) + ' puntos contra ' + contra, cambio > 0);
  return tarjeta_('<p style="margin:0;color:' + R.tinta3 + ';font-size:13px;font-weight:600;">' + e_(etiqueta) + '</p>' +
    '<p style="margin:2px 0 10px;color:' + R.tinta + ';font-size:56px;line-height:1;font-weight:700;letter-spacing:-.03em;">' + prom + '<span style="font-size:28px;letter-spacing:0;"> %</span></p>' +
    cam + '<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>' + barra_(prom, R.verdes[Math.max(nivelR_(prom), 2)]), '22px 22px 24px');
}
function datos_(items) {
  var ancho = Math.floor(100 / items.length) + '%';
  var celdas = items.map(function (it, i) {
    var pad = i === 0 ? '0 6px 0 0' : i === items.length - 1 ? '0 0 0 6px' : '0 3px';
    return '<td width="' + ancho + '" valign="top" style="padding:' + pad + ';">' + tarjeta_('<p style="margin:0;color:' + R.tinta + ';font-size:22px;font-weight:700;letter-spacing:-.01em;">' + e_(it[0]) + '</p>' +
      '<p style="margin:2px 0 0;color:' + R.tinta3 + ';font-size:12px;line-height:1.35;">' + e_(it[1]) + '</p>', '14px 14px') + '</td>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>' + celdas + '</tr></table>';
}
function barrasTipo_(lista, tipos) {
  if (!lista.length) return '';
  var filas = lista.map(function (x) {
    var t = tipos[x[0]], fill = x[1] ? R.verdes[Math.max(nivelR_(x[1]), 1)] : R.noHecho;
    return '<tr><td width="34%" style="padding:6px 0;color:' + R.tinta + ';font-size:14px;font-weight:600;white-space:nowrap;">' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + t.color + ';border:1px solid rgba(15,30,50,.18);vertical-align:-1px;margin-right:8px;"></span>' + e_(t.l) + '</td>' +
      '<td style="padding:6px 10px;">' + barra_(x[1], fill) + '</td>' +
      '<td width="46" align="right" style="padding:6px 0;color:' + R.tinta2 + ';font-size:13px;font-weight:600;">' + x[1] + ' %</td></tr>';
  }).join('');
  return tarjeta_(seccion_('Por tipo de actividad') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + filas + '</table>');
}
function casilla_(texto, p, crit, alto) {
  var bg = R.verdes[nivelR_(p)], fg = nivelR_(p) >= 3 ? '#ffffff' : R.tinta;
  return '<div style="height:' + alto + 'px;border-radius:12px;background:' + bg + ';border:2px solid ' + (crit ? R.tinta : bg) + ';text-align:center;">' +
    '<div style="padding-top:' + Math.floor((alto - 18) / 2) + 'px;color:' + fg + ';font-size:13px;font-weight:700;line-height:14px;">' + texto + '</div></div>';
}
function leyenda_() {
  var c = R.verdes.map(function (v) { return '<span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:' + v + ';vertical-align:-2px;margin-right:3px;"></span>'; }).join('');
  return '<p style="margin:14px 0 0;color:' + R.tinta3 + ';font-size:12px;">Menos ' + c + ' Más &nbsp;·&nbsp; <span style="display:inline-block;width:10px;height:10px;border-radius:4px;border:2px solid ' + R.tinta + ';vertical-align:-3px;"></span> Línea Crítica cumplida</p>';
}
function fraseBoton_(frase, texto, enlace) {
  return fila_(tarjeta_('<p style="margin:0;color:' + R.tinta + ';font-size:19px;line-height:1.4;font-weight:700;letter-spacing:-.01em;">' + e_(frase) + '</p>', '22px 22px')) +
    '<tr><td align="center" style="padding:12px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="' + R.acento + '" style="background:' + R.acento + ';border-radius:999px;">' +
    '<a href="' + e_(enlace) + '" target="_blank" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px;">' + e_(texto) + '</a></td></tr></table></td></tr>';
}
function mejorPeor_(r, conFecha) {
  if (!r.mejor) return '';
  var carta = function (t, d) {
    return tarjeta_('<p style="margin:0;color:' + R.tinta3 + ';font-size:12px;font-weight:600;">' + t + '</p>' +
      '<p style="margin:4px 0 0;color:' + R.tinta + ';font-size:17px;font-weight:700;">' + e_(DIAS_R[d.f.getDay()].charAt(0).toUpperCase() + DIAS_R[d.f.getDay()].slice(1)) + (conFecha ? ' ' + d.f.getDate() : '') + '</p>' +
      '<p style="margin:2px 0 0;color:' + R.tinta2 + ';font-size:13px;">' + d.pct + ' % cumplido</p>', '14px 16px');
  };
  return fila_('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>' +
    '<td width="50%" valign="top" style="padding-right:6px;">' + carta('Tu mejor día', r.mejor) + '</td>' +
    '<td width="50%" valign="top" style="padding-left:6px;">' + carta('El que más te costó', r.peor) + '</td></tr></table>');
}
function textoPlano_(titulo, r, frase) {
  var l = [titulo, ''];
  if (r.prom === null) l.push('Todavía no hay actividades marcadas en este periodo.');
  else l.push('Performance promedio: ' + r.prom + ' %', 'Días registrados: ' + r.con.length, 'Línea Crítica cumplida: ' + r.crit + ' de ' + r.con.length);
  l.push('', frase, '', APP_ENZO);
  return l.join('\n');
}

/* ------------------------------------------------------------ correos */

function correoMensual_(y, m, prueba) {
  var datos = cargarDatos_(), hoy = new Date(), n = new Date(y, m + 1, 0).getDate(), dias = [];
  for (var i = 1; i <= n; i++) dias.push(datos.dia(new Date(y, m, i)));
  var r = resumen_(dias, datos.tipos), antes = [], pn = new Date(y, m, 0).getDate();
  for (var j = 1; j <= pn; j++) antes.push(datos.dia(new Date(y, m - 1, j)));
  var ra = resumen_(antes, datos.tipos), cambio = r.prom !== null && ra.prom !== null ? r.prom - ra.prom : null;
  var nombre = MESES_R[m] + ' ' + y;

  var cab = LETRA_R.map(function (l) { return '<td align="center" style="padding:0 0 6px;color:' + R.tinta3 + ';font-size:11px;font-weight:600;">' + l + '</td>'; }).join('');
  var celdas = [], semana = [];
  for (var k = 0; k < (new Date(y, m, 1).getDay() + 6) % 7; k++) semana.push('');
  dias.forEach(function (d) {
    semana.push(d.f > hoy ? '<div style="height:40px;border-radius:12px;border:1px solid ' + R.borde + ';text-align:center;"><div style="padding-top:12px;color:' + R.tinta3 + ';font-size:13px;font-weight:600;line-height:14px;">' + d.f.getDate() + '</div></div>'
      : casilla_(String(d.f.getDate()), d.pct, d.crit, 40));
    if (semana.length === 7) { celdas.push(semana); semana = []; }
  });
  if (semana.length) { while (semana.length < 7) semana.push(''); celdas.push(semana); }
  var cal = celdas.map(function (s) { return '<tr>' + s.map(function (c) { return '<td width="14%" style="padding:3px;">' + c + '</td>'; }).join('') + '</tr>'; }).join('');

  var frase = frase_(r.prom, m), asunto = (prueba ? 'Prueba · ' : '') + 'Seguimiento ' + nombre;
  var cuerpo = encabezado_('Seguimiento del mes', nombre, prueba) +
    fila_(heroe_(r.prom, 'Performance promedio', 'el mes pasado', cambio)) +
    (r.con.length ? fila_(datos_([[String(r.con.length), 'días registrados'], [r.crit + ' de ' + r.con.length, 'con Línea Crítica cumplida'], [String(r.racha), 'días de mejor racha']])) : '') +
    fila_(tarjeta_(seccion_('Tu mes, día por día') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>' + cab + '</tr>' + cal + '</table>' + leyenda_())) +
    mejorPeor_(r, true) + (r.tipos.length ? fila_(barrasTipo_(r.tipos, datos.tipos)) : '') +
    fraseBoton_(frase, 'Abrir Enzo', APP_ENZO);
  return { asunto: asunto, html: doc_('Tu mes en Enzo: ' + nombre, cuerpo), texto: textoPlano_('Enzo · ' + nombre, r, frase), pdf: true };
}

function correoSemanal_(lunes, prueba) {
  var datos = cargarDatos_(), dias = [], antes = [];
  for (var i = 0; i < 7; i++) { dias.push(datos.dia(sumarDias_(lunes, i))); antes.push(datos.dia(sumarDias_(lunes, i - 7))); }
  var r = resumen_(dias, datos.tipos), ra = resumen_(antes, datos.tipos);
  var cambio = r.prom !== null && ra.prom !== null ? r.prom - ra.prom : null, dom = sumarDias_(lunes, 6);
  var titulo = lunes.getMonth() === dom.getMonth() ? 'Del ' + lunes.getDate() + ' al ' + dom.getDate() + ' de ' + MESES_R[dom.getMonth()].toLowerCase()
    : 'Del ' + lunes.getDate() + ' de ' + MESES_R[lunes.getMonth()].toLowerCase() + ' al ' + dom.getDate() + ' de ' + MESES_R[dom.getMonth()].toLowerCase();

  var tira = dias.map(function (d, i) {
    return '<td width="14%" valign="top" style="padding:0 3px;"><p style="margin:0 0 6px;text-align:center;color:' + R.tinta3 + ';font-size:11px;font-weight:600;">' + LETRA_R[i] + '</p>' +
      casilla_(d.pct !== null ? d.pct + '%' : '—', d.pct, d.crit, 56) + '</td>';
  }).join('');
  var foco = '';
  if (r.tipos.length >= 2 && r.tipos[r.tipos.length - 1][1] < r.tipos[0][1]) {
    var bajo = r.tipos[r.tipos.length - 1];
    foco = fila_(tarjeta_('<p style="margin:0;color:' + R.tinta3 + ';font-size:12px;font-weight:600;">Para la semana que entra</p>' +
      '<p style="margin:4px 0 0;color:' + R.tinta + ';font-size:17px;font-weight:700;">Dale prioridad a ' + e_(datos.tipos[bajo[0]].l.toLowerCase()) + '</p>' +
      '<p style="margin:2px 0 0;color:' + R.tinta2 + ';font-size:13px;line-height:1.45;">Fue lo que menos cumpliste esta semana (' + bajo[1] + ' %). Empieza por la de mañana.</p>', '16px 18px'));
  }
  var frase = frase_(r.prom, lunes.getDate()), asunto = (prueba ? 'Prueba · ' : '') + 'Tu semana · ' + lunes.getDate() + '–' + dom.getDate() + ' ' + MES3_R[dom.getMonth()];
  var cuerpo = encabezado_('Tu semana', titulo, prueba) +
    fila_(heroe_(r.prom, 'Performance de la semana', 'la semana pasada', cambio)) +
    (r.con.length ? fila_(datos_([[r.con.length + ' de 7', 'días registrados'], [r.crit + ' de ' + r.con.length, 'con Línea Crítica cumplida']])) : '') +
    fila_(tarjeta_(seccion_('Tu semana, día por día') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>' + tira + '</tr></table>' + leyenda_())) +
    mejorPeor_(r, false) + foco + (r.tipos.length ? fila_(barrasTipo_(r.tipos, datos.tipos)) : '') +
    fraseBoton_(frase, 'Abrir Enzo', APP_ENZO);
  return { asunto: asunto, html: doc_('Tu semana en Enzo: ' + titulo.toLowerCase(), cuerpo), texto: textoPlano_('Enzo · ' + titulo, r, frase), pdf: false };
}
