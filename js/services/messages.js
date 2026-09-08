// services/messages.js
// Plantillas de mensajes (4 niveles de mora) con placeholders dinámicos.
// Plantillas proporcionadas por el Profesor Haziel Macias.

import { classifyMora } from './mora.js';
import { formatMXN }    from '../utils/dates.js';

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

// ============ PLANTILLAS ============ //

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

const TPL_MORA1 = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

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

const TPL_MORA3 = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

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

const TPL_MORA5 = `Hola {nombre}, espero que te encuentres muy bien. Te saluda el Profesor Haziel Macias.

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
 * @param {{id:string, name:string, paymentDay:1|15}} player
 * @param {{year:number, month:number, amount:number}} payment
 * @param {Date} [today]
 * @returns {{ level: string, text: string }}
 */
export function renderMessage(player, payment, today = new Date()) {
  const level = classifyMora(player, today);
  const diasAtraso = Math.max(0, today.getDate() - player.paymentDay);

  const vars = {
    nombre:      firstName(player.name),
    monto:       formatMXN(payment?.amount ?? 0),
    diasAtraso:  diasAtraso || '',
    banco:       BANK_INFO.banco,
    titular:     BANK_INFO.titular,
    clabe:       BANK_INFO.clabe,
    concepto:    BANK_INFO.concepto,
  };

  let text;
  switch (level) {
    case 'recordatorio': text = fill(TPL_RECORDATORIO, vars); break;
    case 'mora1':        text = fill(TPL_MORA1, vars); break;
    case 'mora3':        text = fill(TPL_MORA3, vars); break;
    case 'mora5':        text = fill(TPL_MORA5, vars); break;
    default:             text = '';
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
