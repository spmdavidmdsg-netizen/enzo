/* Dirección de la aplicación web de Apps Script.
   No es secreta: sin el token no da acceso a nada. El token nunca va en el código.
   En la Mac, mientras pruebas en localhost, Enzo usa el simulador local (npm run simulador). */
const PRODUCCION = 'https://script.google.com/macros/s/AKfycbwFm3W7Dnd9-_sv7mgnsk_I-eTBmpD9g-y_bj5wz0Ab_K23acnXEk0oj20Pecbp-bCk/exec';

export const API_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://127.0.0.1:4301/exec' : PRODUCCION;
