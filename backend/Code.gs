/**
 * Enzo · backend en Google Apps Script.
 *
 * La hoja de cálculo ligada a este proyecto es la base de datos: una pestaña por entidad.
 * La app (GitHub Pages) habla con este script como aplicación web:
 *   GET  ?accion=ping|cargar&token=…        -> JSON
 *   POST {accion:'guardar', token, ops:[…]}  -> JSON   (cuerpo text/plain)
 *
 * Primera vez: ejecuta `configurar` desde el editor; crea las pestañas y muestra el token.
 */

var ENTIDADES = {
  actividades: { hoja: 'Actividades', cols: ['id', 'dia', 'nombre', 'inicio', 'dur', 'tipo', 'tolA', 'tolD', 'ida', 'vuelta', 'core', 'ejercicioId', 'actualizado'] },
  registros:   { hoja: 'Registros',   cols: ['id', 'fecha', 'actividadId', 'nombre', 'tipo', 'core', 'hecho', 'actualizado'] },
  pendientes:  { hoja: 'Pendientes',  cols: ['id', 'titulo', 'notas', 'estado', 'importante', 'fecha', 'pasos', 'rep', 'serie', 'repGenerada', 'orden', 'creado', 'completado', 'proyectoId', 'actualizado'] },
  proyectos:   { hoja: 'Proyectos',   cols: ['id', 'nombre', 'tipo', 'estado', 'fecha', 'descripcion', 'creado', 'terminado', 'actualizado'] },
  notas:       { hoja: 'Notas',       cols: ['id', 'titulo', 'cuerpo', 'proyectoId', 'creado', 'actualizado'] },
  partidas:    { hoja: 'Presupuesto', cols: ['id', 'mes', 'tipo', 'nombre', 'monto', 'modo', 'categoria', 'repetir', 'real', 'origen', 'orden', 'actualizado'] },
  meses:       { hoja: 'Meses',       cols: ['id', 'inicial', 'final', 'actualizado'] },
  followups:   { hoja: 'FollowUps',   cols: ['id', 'pendienteId', 'fecha', 'nota', 'hecho', 'completado', 'actualizado'] },
  ejercicios:  { hoja: 'Ejercicios',  cols: ['id', 'nombre', 'datos', 'actualizado'] },
  sesiones:    { hoja: 'Sesiones',    cols: ['id', 'ejercicioId', 'fecha', 'datos', 'actualizado'] },
  config:      { hoja: 'Config',      cols: ['id', 'valor', 'actualizado'] }
};
var JSON_COLS = { pasos: [], rep: null, datos: null };
var BOOL_COLS = { core: 1, hecho: 1, importante: 1, repGenerada: 1, repetir: 1 };
var NUM_COLS  = { dur: 1, tolA: 1, tolD: 1, ida: 1, vuelta: 1, orden: 1, monto: 1, actualizado: 1 };

/* ------------------------------------------------------------ web app */

function doGet(e) {
  return responder_(function () {
    var p = (e && e.parameter) || {};
    validar_(p.token);
    if (p.accion === 'ping') return { ok: true };
    if (p.accion === 'cargar') return { ok: true, datos: leerTodo_() };
    throw new Error('Acción desconocida.');
  });
}

function doPost(e) {
  return responder_(function () {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    validar_(b.token);
    if (b.accion === 'guardar') return { ok: true, aplicadas: aplicar_(b.ops || []) };
    throw new Error('Acción desconocida.');
  });
}

function responder_(fn) {
  var out;
  try { out = fn(); } catch (err) { out = { ok: false, error: String((err && err.message) || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function validar_(token) {
  var real = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!real || !token || String(token) !== real) throw new Error('No autorizado.');
}

/* ------------------------------------------------------------- hojas */

function libro_() { return SpreadsheetApp.getActive(); }

function hoja_(clave) {
  var def = ENTIDADES[clave], libro = libro_(), sh = libro.getSheetByName(def.hoja);
  if (!sh) {
    sh = libro.insertSheet(def.hoja);
    sh.getRange(1, 1, sh.getMaxRows(), def.cols.length).setNumberFormat('@');   // todo como texto: sin fechas ni horas automáticas
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leer_(clave) {
  var def = ENTIDADES[clave], valores = hoja_(clave).getDataRange().getValues();
  if (valores.length < 2) return [];
  var cab = valores[0], out = [];
  for (var r = 1; r < valores.length; r++) {
    if (!valores[r][0]) continue;
    var o = {};
    cab.forEach(function (c, i) { if (def.cols.indexOf(c) >= 0) o[c] = decodificar_(c, valores[r][i]); });
    out.push(o);
  }
  return out;
}

function decodificar_(col, v) {
  if (col in JSON_COLS) {
    if (v === '' || v === null) return JSON_COLS[col];
    try { return JSON.parse(v); } catch (e) { return JSON_COLS[col]; }
  }
  if (BOOL_COLS[col]) return v === true || v === 'TRUE' || v === 'true';
  if (NUM_COLS[col]) return Number(v) || 0;
  return v === null ? '' : String(v);
}

function codificar_(col, v) {
  if (v === undefined || v === null) return '';
  if (col in JSON_COLS) return JSON.stringify(v);
  if (BOOL_COLS[col]) return v ? 'TRUE' : '';
  return String(v);
}

function escribir_(clave, filas) {
  var def = ENTIDADES[clave], sh = hoja_(clave);
  var datos = [def.cols].concat(filas.map(function (f) { return def.cols.map(function (c) { return codificar_(c, f[c]); }); }));
  sh.clearContents();
  if (sh.getMaxRows() < datos.length) sh.insertRowsAfter(sh.getMaxRows(), datos.length - sh.getMaxRows());
  sh.getRange(1, 1, datos.length, def.cols.length).setNumberFormat('@').setValues(datos);
}

function leerTodo_() {
  var out = {};
  Object.keys(ENTIDADES).forEach(function (k) { out[k] = leer_(k); });
  return out;
}

/* Aplica cambios: gana la versión con `actualizado` más reciente. */
function aplicar_(ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var porEntidad = {}, n = 0;
    ops.forEach(function (op) {
      if (!op || !ENTIDADES[op.entidad] || !op.fila || !op.fila.id) return;
      (porEntidad[op.entidad] = porEntidad[op.entidad] || []).push(op);
    });
    Object.keys(porEntidad).forEach(function (clave) {
      var def = ENTIDADES[clave], mapa = {}, orden = [];
      leer_(clave).forEach(function (f) { mapa[f.id] = f; orden.push(f.id); });
      porEntidad[clave].forEach(function (op) {
        var id = String(op.fila.id), previo = mapa[id], t = Number(op.fila.actualizado) || 0;
        if (previo && t < (Number(previo.actualizado) || 0)) return;
        if (op.op === 'borrar') { delete mapa[id]; n++; return; }
        var limpio = {};
        def.cols.forEach(function (c) { if (c in op.fila) limpio[c] = op.fila[c]; });
        limpio.id = id; limpio.actualizado = t;
        if (!previo) orden.push(id);
        mapa[id] = limpio; n++;
      });
      escribir_(clave, orden.filter(function (id) { return mapa[id]; }).map(function (id) { return mapa[id]; }));
    });
    return n;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------- configuración */

/** Ejecútala una vez desde el editor: crea las pestañas y el token. */
function configurar() {
  Object.keys(ENTIDADES).forEach(hoja_);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  Logger.log('Pestañas listas. Tu token es: ' + props.getProperty('TOKEN'));
  if (APP_URL) verEnlace();
}

/* Dirección de la app en GitHub Pages; se llena al publicar (ej. https://tu-usuario.github.io/enzo/). */
var APP_URL = 'https://spmdavidmdsg-netizen.github.io/enzo/';

/** Muestra tu enlace de conexión. Ábrelo una vez en la Mac y otra en el iPhone y quedan conectados. */
function verEnlace() {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token) { Logger.log('Aún no hay token: ejecuta configurar.'); return; }
  if (!APP_URL) { Logger.log('Falta APP_URL en Code.gs (la dirección de GitHub Pages).'); return; }
  Logger.log('Tu enlace de conexión (no lo compartas): ' + APP_URL + '#conectar=' + token);
}

/** Muestra el token en el registro de ejecución, por si lo necesitas en otro dispositivo. */
function verToken() {
  Logger.log(PropertiesService.getScriptProperties().getProperty('TOKEN') || 'Aún no hay token: ejecuta configurar.');
}
