/* Simulador local del backend: ejecuta backend/Code.gs tal cual, con hojas en memoria.
   Sirve para probar la app sin tocar la cuenta de Google.
   Uso: node dev/simulador-gas.js [puerto]   (token de prueba: "prueba") */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const PUERTO = Number(process.argv[2] || 4301);
const hojas = {};
const props = { TOKEN: 'prueba' };

function hojaFalsa(nombre) {
  let datos = [];
  const rango = (r, c, nr, nc) => ({
    setNumberFormat() { return this; },
    setFontWeight() { return this; },
    setValues(v) { for (let i = 0; i < v.length; i++) { datos[r - 1 + i] = datos[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) datos[r - 1 + i][c - 1 + j] = v[i][j]; } return this; }
  });
  return {
    getName: () => nombre,
    getMaxRows: () => Math.max(1000, datos.length),
    getRange: rango,
    setFrozenRows() {},
    insertRowsAfter() {},
    clearContents() { datos = []; },
    getDataRange: () => ({ getValues: () => datos.filter(f => f && f.some(x => x !== '' && x !== undefined)).map(f => f.map(x => (x === undefined ? '' : x))) })
  };
}

const contexto = {
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hojaFalsa(n)) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ texto: s, setMimeType() { return this; } }) },
  Utilities: { getUuid: () => crypto.randomUUID() },
  Logger: { log: m => console.log('[Logger]', m) },
  JSON, Object, Number, String, Error
};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8'), contexto);

http.createServer((req, res) => {
  const cab = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    const out = contexto.doGet({ parameter: Object.fromEntries(u.searchParams) });
    res.writeHead(200, cab); res.end(out.texto); return;
  }
  if (req.method === 'POST') {
    let cuerpo = '';
    req.on('data', d => { cuerpo += d; });
    req.on('end', () => { const out = contexto.doPost({ postData: { contents: cuerpo } }); res.writeHead(200, cab); res.end(out.texto); });
    return;
  }
  res.writeHead(405, cab); res.end('{}');
}).listen(PUERTO, '127.0.0.1', () => console.log('Simulador de Apps Script en http://127.0.0.1:' + PUERTO + '/exec'));
