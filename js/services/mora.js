// services/mora.js
// Clasificador de mensajes según días de mora.
// Reglas:
//   mora = 0      → 'recordatorio'
//   mora = 1-2    → 'mora1'
//   mora = 3-4    → 'mora3'
//   mora >= 5     → 'mora5'

import { daysMora } from '../utils/dates.js';

/**
 * @param {{paymentDay:1|15}} player
 * @param {Date} [today]
 * @returns {'recordatorio'|'mora1'|'mora3'|'mora5'}
 */
export function classifyMora(player, today = new Date()) {
  const d = daysMora(player, today);
  if (d <= 0) return 'recordatorio';
  if (d <= 2) return 'mora1';
  if (d <= 4) return 'mora3';
  return 'mora5';
}

/** Etiqueta humana del nivel de mora */
export function moraLabel(level) {
  switch (level) {
    case 'recordatorio': return 'Recordatorio';
    case 'mora1':        return 'Mora 1 día';
    case 'mora3':        return 'Mora 3 días';
    case 'mora5':        return 'No podrá entrenar';
    default:             return '—';
  }
}

/** Color Tailwind para badges */
export function moraBadgeClass(level) {
  switch (level) {
    case 'recordatorio': return 'badge badge-info';
    case 'mora1':        return 'badge badge-pending';
    case 'mora3':        return 'badge badge-mora';
    case 'mora5':        return 'badge badge-mora';
    default:             return 'badge badge-neutral';
  }
}
