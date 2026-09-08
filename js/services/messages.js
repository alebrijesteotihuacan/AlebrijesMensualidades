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

/**
 * Genera una imagen PNG con los datos bancarios del club (Banco, Titular, CLABE, Concepto).
 * Usa Canvas API; funciona sin librerías externas.
 * @returns {Promise<Blob>}
 */
export async function generateClabeImage() {
  const W = 720, H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Header oscuro
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, W, 80);

  // Texto header: marca
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 24px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Alebrijes Mensualidad', 32, 40);

  // Texto header: subtítulo derecha
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#A1A1AA';
  ctx.textAlign = 'right';
  ctx.fillText('DATOS PARA TRANSFERENCIA', W - 32, 40);
  ctx.textAlign = 'left';

  // Filas de información bancaria
  const rows = [
    { label: 'Banco',                  value: BANK_INFO.banco,    size: 'normal' },
    { label: 'Titular',                value: BANK_INFO.titular,   size: 'normal' },
    { label: 'CLABE Interbancaria',    value: BANK_INFO.clabe,     size: 'large', mono: true },
    { label: 'Concepto de pago',       value: BANK_INFO.concepto,  size: 'normal' },
  ];

  const startY = 128;
  const rowHeight = 76;

  rows.forEach((row, i) => {
    const y = startY + i * rowHeight;

    // Label
    ctx.fillStyle = '#71717A';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText(row.label.toUpperCase(), 32, y);

    // Value
    ctx.fillStyle = '#09090B';
    if (row.size === 'large' && row.mono) {
      ctx.font = '600 28px "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';
    } else {
      ctx.font = '500 17px Inter, system-ui, sans-serif';
    }
    ctx.fillText(row.value, 32, y + 30);

    // Separator
    ctx.fillStyle = '#F4F4F5';
    ctx.fillRect(32, y + 60, W - 64, 1);
  });

  // Footer
  ctx.fillStyle = '#71717A';
  ctx.font = '400 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Una vez realizada tu transferencia, comparte el comprobante por este chat.', W / 2, H - 22);
  ctx.textAlign = 'left';

  // Convertir a Blob PNG
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png');
  });
}

/**
 * Copia la imagen CLABE al portapapeles. Si el navegador no soporta imagen
 * en clipboard, descarga el archivo como fallback.
 * @returns {Promise<{ok: true, method: 'clipboard'|'download'}>}
 */
export async function copyClabeImage() {
  const blob = await generateClabeImage();

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
