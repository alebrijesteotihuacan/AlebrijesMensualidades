// services/messages.js
// Plantillas de mensajes (5 niveles: recordatorio_proximo, recordatorio, adeudo1, adeudo3, adeudo5)
// + generación de imagen CLABE.
// Plantillas proporcionadas por el Profesor Haziel Macias.

import { classifyAdeudo } from './adeudo.js';
import { formatMXN }      from '../utils/dates.js';

/** Datos bancarios del club (constantes del mensaje). */
export const BANK_INFO = Object.freeze({
  banco:  'Banorte',
  titular:'Haziel Macias',
  clabe:  '0725 8001 2420 3994 00',
  concepto: 'Mensualidad',
});

/** Devuelve el primer nombre del jugador. */
function firstName(fullName = '') {
  const trimmed = String(fullName).trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

/** Reemplaza {placeholders} en una plantilla. */
function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

/**
 * Clasifica el nivel del mensaje para un jugador.
 * Niveles:
 *   - 'recordatorio_proximo' → 1-3 días ANTES del día de pago
 *   - 'recordatorio'         → día de pago (sin atraso)
 *   - 'adeudo1'              → 1-2 días de atraso
 *   - 'adeudo3'              → 3-4 días de atraso
 *   - 'adeudo5'              → 5+ días de atraso
 */
export function classifyMessageLevel(player, today = new Date()) {
  const pd = Number(player?.paymentDay);
  if (!pd || pd < 1 || pd > 31) return classifyAdeudo(player, today);

  const day = today.getDate();
  // Aún no llega el día de pago
  if (day < pd) {
    const daysUntil = pd - day;
    if (daysUntil <= 3) return 'recordatorio_proximo';
    return 'recordatorio';
  }
  // Día de pago o después: usa clasificador de adeudo
  return classifyAdeudo(player, today);
}

/** Devuelve el día del mes en que le toca pagar este mes al jugador. */
function dueDayThisMonth(player, today) {
  const pd = Number(player?.paymentDay);
  if (!pd) return null;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(pd, lastDay);
}

/** Devuelve un texto relativo tipo "hoy", "mañana", "en 3 días". */
function relativeDay(daysFromToday) {
  if (daysFromToday === 0) return 'hoy';
  if (daysFromToday === 1) return 'mañana';
  return `en ${daysFromToday} días`;
}

// ============ PLANTILLAS ============ //

const TPL_RECORDATORIO_PROXIMO = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

Te escribo por este medio para recordarte amablemente que tu fecha de pago de la mensualidad es {diasTexto}:

Monto: {monto}

📅 Fecha de pago: {fechaPago}

Para que puedas realizar tu transferencia con tiempo, te comparto los datos oficiales de la cuenta:

Banco: {banco}
Titular: {titular}
CLABE Interbancaria: {clabe}
Concepto de Pago: {concepto}

⚠️ Nota: Una vez realizada tu transferencia, te pido de favor que me compartas tu comprobante por este chat privado para poder registrarlo adecuadamente.

Muchas gracias por tu atención y tu puntualidad de siempre. ¡Que sigas teniendo una excelente tarde y mucho éxito! 🌟✨`;

const TPL_RECORDATORIO = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

Te escribo por este medio para recordarte amablemente sobre el pago de tu mensualidad:

Monto: {monto}

📅 Fecha límite de pago: Hoy es tu fecha límite.
Para realizar tu transferencia, te comparto los datos oficiales de la cuenta:

Banco: {banco}
Titular: {titular}
CLABE Interbancaria: {clabe}
Concepto de Pago: {concepto}

⚠️ Nota: Una vez realizada tu transferencia, te pido de favor que me compartas tu comprobante por este chat privado para poder registrarlo adecuadamente.

Muchas gracias por tu atención y tu puntualidad de siempre. ¡Que sigas teniendo una excelente tarde y mucho éxito! 🌟✨`;

const TPL_ADEUDO1 = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

Te escribo por este medio para comunicarme contigo respecto al pago de tu mensualidad:

Monto: {monto}

📅 Fecha límite de pago: Se encuentra registrado con 1 día de atraso.
Para regularizar tu situación, te comparto los datos oficiales de la cuenta:

Banco: {banco}
Titular: {titular}
CLABE Interbancaria: {clabe}
Concepto de Pago: {concepto}

⚠️ Nota: Una vez que realices tu depósito, te pido de favor que me compartas tu comprobante por este chat privado para poder actualizar tu registro de manera inmediata.

Muchas gracias por tu atención y comprensión. ¡Que sigas teniendo una excelente tarde! 🌟✨`;

const TPL_ADEUDO3 = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

Te escribo por este medio para comunicarme contigo respecto al pago de tu mensualidad:

Monto: {monto}

📅 Fecha límite de pago: Se encuentra registrado con 3 días de atraso.
Te pido de tu apoyo para regularizar tu situación a la brevedad posible y así poder continuar con tus actividades sin contratiempos.

Para realizar tu transferencia, te dejo aquí los datos oficiales de la cuenta:

Banco: {banco}
Titular: {titular}
CLABE Interbancaria: {clabe}
Concepto de Pago: {concepto}

⚠️ Nota: Una vez que realices tu depósito, te pido de favor que me compartas tu comprobante por este chat privado para poder actualizar tu registro de manera inmediata.

Muchas gracias por tu atención y comprensión. ¡Que sigas teniendo una excelente tarde! 🌟✨`;

const TPL_ADEUDO5 = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

Te escribo por este medio para comunicarme contigo respecto al pago de tu mensualidad:

Monto: {monto}

📅 Fecha límite de pago: Se encuentra registrado con {diasAtraso} días de atraso.

De igual manera, te comento que por indicaciones administrativas del club, es necesario estar al corriente con tu pago para poder continuar participando en los entrenamientos, por lo que por el momento no podrás incorporarte a las prácticas hasta regularizar tu situación.

Para realizar tu transferencia y ponerte al corriente a la brevedad, te dejo aquí los datos oficiales de la cuenta:

Banco: {banco}
Titular: {titular}
CLABE Interbancaria: {clabe}
Concepto de Pago: {concepto}

⚠️ Nota: Una vez que realices tu depósito, te pido de favor que me compartas tu comprobante por este chat privado para poder actualizar tu registro de manera inmediata y que puedas reincorporarte sin inconveniente.

Muchas gracias por tu atención y comprensión. ¡Que sigas teniendo una excelente tarde! 🌟✨`;

/**
 * Renderiza el mensaje para un jugador pendiente.
 * @param {{id:string, name:string, paymentDay:1|31}} player
 * @param {{year:number, month:number, amount:number}} payment
 * @param {Date} [today]
 * @returns {{ level: string, text: string }}
 */
export function renderMessage(player, payment, today = new Date()) {
  const level = classifyMessageLevel(player, today);

  // Calcular días hasta / desde el día de pago de este mes
  const dueDay = dueDayThisMonth(player, today);
  const daysDiff = dueDay != null ? dueDay - today.getDate() : 0;
  const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay || 1);
  const fechaPago = dueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  const diasAtraso = Math.max(0, -daysDiff);

  const vars = {
    nombre:      firstName(player.name),
    monto:       formatMXN(payment?.amount ?? 0),
    diasTexto:   relativeDay(daysDiff),
    fechaPago,
    diasAtraso:  diasAtraso || '',
    banco:       BANK_INFO.banco,
    titular:     BANK_INFO.titular,
    clabe:       BANK_INFO.clabe,
    concepto:    BANK_INFO.concepto,
  };

  let text;
  switch (level) {
    case 'recordatorio_proximo': text = fill(TPL_RECORDATORIO_PROXIMO, vars); break;
    case 'recordatorio':         text = fill(TPL_RECORDATORIO, vars); break;
    case 'adeudo1':              text = fill(TPL_ADEUDO1, vars); break;
    case 'adeudo3':              text = fill(TPL_ADEUDO3, vars); break;
    case 'adeudo5':              text = fill(TPL_ADEUDO5, vars); break;
    default:                     text = '';
  }

  return { level, text };
}

/** Copia un texto al portapapeles (con fallback). */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ============ IMAGEN CLABE ============ //

/** URL de la imagen CLABE pre-diseñada en /assets. */
export const CLABE_IMAGE_URL = 'assets/clabe.png';

/** Cache del Blob de la imagen para no re-fetchear en cada copy. */
let _clabeBlobPromise = null;

/**
 * Devuelve un Blob PNG con la imagen CLABE oficial del club (cacheado).
 * @returns {Promise<Blob>}
 */
export function fetchClabeBlob() {
  if (_clabeBlobPromise) return _clabeBlobPromise;
  _clabeBlobPromise = fetch(CLABE_IMAGE_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${CLABE_IMAGE_URL} (${r.status})`);
      return r.blob();
    });
  return _clabeBlobPromise;
}

/**
 * Copia la imagen CLABE al portapapeles. Si el navegador no soporta imagen
 * en clipboard, descarga el archivo como fallback.
 * @returns {Promise<{ok: true, method: 'clipboard'|'download'}>}
 */
export async function copyClabeImage() {
  const blob = await fetchClabeBlob();

  // Intentar copiar al portapapeles
  if (
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return { ok: true, method: 'clipboard' };
    } catch (e) {
      // Algunos navegadores fallan silenciosamente; caemos al fallback
      console.warn('Clipboard image write no soportado, usando descarga', e);
    }
  }

  // Fallback: descarga
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `datos-pago-${BANK_INFO.banco.toLowerCase()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, method: 'download' };
}

/**
 * Copia texto + imagen CLABE al portapapeles usando ClipboardItem con
 * múltiples representaciones. WhatsApp Web/Desktop y otras apps modernas
 * permiten pegar ambas (texto o imagen según el contexto).
 *
 * Si el navegador no soporta múltiples representations, copia primero el
 * texto y luego intenta copiar la imagen (la segunda puede sobrescribir
 * según el navegador). Devuelve el método usado.
 *
 * @param {string} text  Texto del mensaje de cobro.
 * @returns {Promise<{ok:true, method:'multi'|'text-only'|'image-download'|'image-only', imageOk:boolean}>}
 */
export async function copyMessageAndImage(text) {
  const blob = await fetchClabeBlob();

  // Camino ideal: ClipboardItem con ambos tipos en un solo write
  if (
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard?.write
  ) {
    try {
      const item = new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'image/png': blob,
      });
      await navigator.clipboard.write([item]);
      return { ok: true, method: 'multi', imageOk: true };
    } catch (e) {
      console.warn('ClipboardItem multi-type falló, intentando sequential', e);
    }
  }

  // Fallback A: copiar texto, luego imagen (la imagen puede sobreescribir)
  let imageOk = false;
  try {
    await copyToClipboard(text);
  } catch (e) { /* sigue */ }

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      imageOk = true;
      return { ok: true, method: 'image-only', imageOk: true };
    } catch (e) { /* sigue al fallback de descarga */ }
  }

  // Fallback B: descargar imagen para que el usuario la adjunte manualmente
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `datos-pago-${BANK_INFO.banco.toLowerCase()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, method: 'image-download', imageOk: false };
}
