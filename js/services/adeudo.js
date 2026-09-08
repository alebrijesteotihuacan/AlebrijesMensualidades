// services/adeudo.js
// Clasificador de adeudos según días de atraso.
// Reglas:
//   dias = 0      → 'recordatorio'
//   dias = 1-2    → 'adeudo1'
//   dias = 3-4    → 'adeudo3'
//   dias >= 5     → 'adeudo5'

import { daysOverdue } from '../utils/dates.js';

/**
 * @param {{paymentDay:1|31}} player
 * @param {Date} [today]
 * @returns {'recordatorio'|'adeudo1'|'adeudo3'|'adeudo5'}
 */
export function classifyAdeudo(player, today = new Date()) {
  const d = daysOverdue(player, today);
  if (d <= 0) return 'recordatorio';
  if (d <= 2) return 'adeudo1';
  if (d <= 4) return 'adeudo3';
  return 'adeudo5';
}

/** Etiqueta humana del nivel de adeudo */
export function adeudoLabel(level) {
  switch (level) {
    case 'recordatorio': return 'Recordatorio';
    case 'adeudo1':     return 'Adeudo 1 día';
    case 'adeudo3':     return 'Adeudo 3 días';
    case 'adeudo5':     return 'No podrá entrenar';
    default:            return '—';
  }
}

/** Color Tailwind para badges */
export function adeudoBadgeClass(level) {
  switch (level) {
    case 'recordatorio': return 'badge badge-info';
    case 'adeudo1':     return 'badge badge-pending';
    case 'adeudo3':     return 'badge badge-adeudo';
    case 'adeudo5':     return 'badge badge-adeudo';
    default:            return 'badge badge-neutral';
  }
}
